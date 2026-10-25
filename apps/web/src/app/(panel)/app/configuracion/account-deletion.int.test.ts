import { beforeEach, describe, expect, it, vi } from "vitest";

import { app as apiV1 } from "@granola/api";
import { hashPassword } from "@granola/auth/password";
import { seedAppointment, seedNutritionist, seedPatient } from "@granola/db/testing";
import { findAccountsDueForPurge, purgeAccount } from "@granola/jobs";

import { auth } from "@/lib/auth";
import { getPublicNutritionistBySlug } from "@/lib/booking";
import {
  accounts,
  appointments,
  auditLog,
  db,
  eq,
  nutritionists,
  patients,
  payments,
  sessions,
  users,
  waMessages,
} from "@/lib/db";
import { sendEvent } from "@/lib/inngest-client";
import { getPublicProfile } from "@/lib/public-profile";
import { requireNutritionist } from "@/lib/session";
import { RedirectSignal, TEST_CLIENT_IP } from "@/test/next-mocks";

import { cancelAccountDeletion, requestAccountDeletion } from "./account-deletion";

vi.mock("@/lib/inngest-client", () => ({ sendEvent: vi.fn(async () => true) }));
// Frontera: Better Auth lee la cookie. Aquí decidimos quién tiene sesión; el resto
// (requireNutritionist real, verificación de contraseña contra `accounts`) corre de verdad.
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

const DAY = 86_400_000;
const PASSWORD_A = "contraseña-de-ana-2026";
const PASSWORD_B = "contraseña-de-beto-2026";

type Seeded = Awaited<ReturnType<typeof seedNutritionist>>;

async function seedWithPassword(slug: string, password: string): Promise<Seeded> {
  const seeded = await seedNutritionist({ slug, displayName: `Nutri ${slug}` });
  await db.insert(accounts).values({
    accountId: seeded.user.id,
    providerId: "credential",
    userId: seeded.user.id,
    password: await hashPassword(password),
  });
  await db.insert(sessions).values({
    token: `tok-${slug}`,
    userId: seeded.user.id,
    expiresAt: new Date(Date.now() + 30 * DAY),
  });
  return seeded;
}

function loginAs({ user }: Seeded) {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { ...user, image: user.image ?? null },
    session: { id: "s", token: "t", userId: user.id, expiresAt: new Date(Date.now() + DAY) },
  } as never);
}

async function nutriRow(id: string) {
  const [row] = await db.select().from(nutritionists).where(eq(nutritionists.id, id));
  return row!;
}

async function statusOf(id: string) {
  const [row] = await db.select().from(appointments).where(eq(appointments.id, id));
  return row!;
}

describe("Borrado lógico de cuenta", () => {
  let a: Seeded;
  let b: Seeded;

  beforeEach(async () => {
    a = await seedWithPassword("ana-nutri", PASSWORD_A);
    b = await seedWithPassword("beto-nutri", PASSWORD_B);
    loginAs(a);
  });

  describe("Cuando pide eliminar su cuenta", () => {
    it("con contraseña incorrecta falla y no toca nada", async () => {
      const future = await seedAppointment({ nutritionistId: a.nutritionist.id });

      const res = await requestAccountDeletion({ password: "otra-cosa", confirmation: "ELIMINAR" });

      expect(res).toEqual({ ok: false, error: "La contraseña no es correcta" });
      expect(await nutriRow(a.nutritionist.id)).toMatchObject({ deletedAt: null, deletionScheduledFor: null });
      expect((await statusOf(future.id)).status).toBe("confirmed");
      expect(await db.select().from(auditLog)).toHaveLength(0);
      expect(sendEvent).not.toHaveBeenCalled();
    });

    it("sin escribir ELIMINAR falla aunque la contraseña sea correcta", async () => {
      const res = await requestAccountDeletion({ password: PASSWORD_A, confirmation: "eliminar" });
      expect(res).toMatchObject({ ok: false });
      expect((await nutriRow(a.nutritionist.id)).deletedAt).toBeNull();
    });

    it("con contraseña correcta marca fechas, audita con IP, cancela citas futuras, emite eventos y cierra sesiones", async () => {
      const future = await seedAppointment({ nutritionistId: a.nutritionist.id, status: "confirmed" });
      const pendingPay = await seedAppointment({
        nutritionistId: a.nutritionist.id,
        status: "pending_payment",
        startsAt: new Date(Date.now() + 5 * DAY),
      });
      const past = await seedAppointment({
        nutritionistId: a.nutritionist.id,
        status: "completed",
        startsAt: new Date(Date.now() - 5 * DAY),
      });
      const ofB = await seedAppointment({ nutritionistId: b.nutritionist.id, status: "confirmed" });

      const before = Date.now();
      const res = await requestAccountDeletion({ password: PASSWORD_A, confirmation: "ELIMINAR" });
      expect(res).toMatchObject({ ok: true });

      const n = await nutriRow(a.nutritionist.id);
      expect(n.deletedAt).toBeInstanceOf(Date);
      expect(n.deletionScheduledFor!.getTime() - n.deletedAt!.getTime()).toBe(30 * DAY);
      expect(n.deletedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
      const [u] = await db.select().from(users).where(eq(users.id, a.user.id));
      expect(u!.deletedAt).toBeInstanceOf(Date);

      const [audit] = await db.select().from(auditLog).where(eq(auditLog.action, "account.delete_requested"));
      expect(audit).toMatchObject({
        actorId: a.user.id,
        entity: "nutritionist",
        entityId: a.nutritionist.id,
        ip: TEST_CLIENT_IP,
        meta: { cancelledAppointments: 2 },
      });

      expect(await statusOf(future.id)).toMatchObject({ status: "cancelled", cancelReason: expect.stringContaining("cerró su cuenta") });
      expect((await statusOf(pendingPay.id)).status).toBe("cancelled");
      expect((await statusOf(past.id)).status).toBe("completed");
      expect((await statusOf(ofB.id)).status).toBe("confirmed");

      expect(sendEvent).toHaveBeenCalledTimes(2);
      for (const id of [future.id, pendingPay.id]) {
        expect(sendEvent).toHaveBeenCalledWith({
          name: "appointment/cancelled",
          data: { appointmentId: id, nutritionistId: a.nutritionist.id, by: "nutritionist" },
        });
      }

      // Sesiones de A revocadas; las de B intactas.
      expect(await db.select().from(sessions).where(eq(sessions.userId, a.user.id))).toHaveLength(0);
      expect(await db.select().from(sessions).where(eq(sessions.userId, b.user.id))).toHaveLength(1);
      // Nada se borró: la fila del nutri y sus credenciales siguen (para poder cancelar).
      expect(await db.select().from(accounts).where(eq(accounts.userId, a.user.id))).toHaveLength(1);
    });

    it("después, el panel solo deja ver /cuenta-eliminada", async () => {
      await requestAccountDeletion({ password: PASSWORD_A, confirmation: "ELIMINAR" });

      await expect(requireNutritionist()).rejects.toEqual(new RedirectSignal("/cuenta-eliminada"));
      await expect(requestAccountDeletion({ password: PASSWORD_A, confirmation: "ELIMINAR" })).rejects.toBeInstanceOf(
        RedirectSignal,
      );
      const allowed = await requireNutritionist({ allowPendingDeletion: true });
      expect(allowed.nutritionist.id).toBe(a.nutritionist.id);
    });
  });

  describe("Cuando la cuenta está marcada", () => {
    beforeEach(async () => {
      await requestAccountDeletion({ password: PASSWORD_A, confirmation: "ELIMINAR" });
    });

    it("la página pública, el booking y la API pública dan 404; el slug sigue reservado", async () => {
      expect(await getPublicProfile("ana-nutri")).toBeNull();
      expect(await getPublicNutritionistBySlug("ana-nutri")).toBeNull();
      const res = await apiV1.request("/api/v1/public/ana-nutri");
      expect(res.status).toBe(404);
      // Nadie más puede tomar el slug mientras dure la gracia (unique sigue ocupado).
      await expect(seedNutritionist({ slug: "ana-nutri" })).rejects.toThrow();
    });

    it("cancelar dentro de la gracia revierte, audita y la página pública vuelve", async () => {
      const res = await cancelAccountDeletion();
      expect(res).toEqual({ ok: true });

      expect(await nutriRow(a.nutritionist.id)).toMatchObject({ deletedAt: null, deletionScheduledFor: null });
      const [u] = await db.select().from(users).where(eq(users.id, a.user.id));
      expect(u!.deletedAt).toBeNull();
      expect(await db.select().from(auditLog).where(eq(auditLog.action, "account.delete_cancelled"))).toHaveLength(1);
      expect(await getPublicProfile("ana-nutri")).toMatchObject({ slug: "ana-nutri" });
      expect((await requireNutritionist()).nutritionist.id).toBe(a.nutritionist.id);
    });

    it("cancelar con la gracia vencida falla", async () => {
      await db
        .update(nutritionists)
        .set({ deletionScheduledFor: new Date(Date.now() - DAY) })
        .where(eq(nutritionists.id, a.nutritionist.id));

      expect(await cancelAccountDeletion()).toMatchObject({ ok: false });
      expect((await nutriRow(a.nutritionist.id)).deletedAt).toBeInstanceOf(Date);
    });
  });

  describe("Cuando vence la gracia y corre account/purge", () => {
    it("anonimiza contacto y accesos, conserva citas y pagos, libera el slug y audita", async () => {
      const patient = await seedPatient({ nutritionistId: a.nutritionist.id, name: "Lucía Pérez", email: "lucia@example.com" });
      const done = await seedAppointment({
        nutritionistId: a.nutritionist.id,
        patientId: patient.id,
        status: "completed",
        startsAt: new Date(Date.now() - 10 * DAY),
      });
      await db.insert(payments).values({
        appointmentId: done.id,
        provider: "cash",
        amountCents: 70000,
        status: "paid",
        method: "cash",
        paidAt: new Date(),
      });
      await db.insert(waMessages).values({
        nutritionistId: a.nutritionist.id,
        patientId: patient.id,
        direction: "outbound",
        template: "cita_confirmada",
        payload: { to: patient.phoneWa, body: "Hola Lucía" },
      });
      const patientOfB = await seedPatient({ nutritionistId: b.nutritionist.id, name: "Paciente de Beto" });

      await requestAccountDeletion({ password: PASSWORD_A, confirmation: "ELIMINAR" });
      expect(await findAccountsDueForPurge(new Date())).toEqual([]); // gracia vigente
      expect(await purgeAccount(a.nutritionist.id)).toMatchObject({ purged: false, reason: "gracia vigente" });

      // Pasan los 30 días.
      const later = new Date(Date.now() + 31 * DAY);
      expect(await findAccountsDueForPurge(later)).toEqual([a.nutritionist.id]);
      expect(await purgeAccount(a.nutritionist.id, later)).toMatchObject({ purged: true, patients: 1 });

      const [p] = await db.select().from(patients).where(eq(patients.id, patient.id));
      expect(p).toMatchObject({ name: "Paciente", phoneWa: null, email: null });
      const [u] = await db.select().from(users).where(eq(users.id, a.user.id));
      expect(u).toMatchObject({ email: `deleted+${a.user.id}@granola.invalid`, name: "Cuenta eliminada" });
      const n = await nutriRow(a.nutritionist.id);
      expect(n).toMatchObject({ displayName: "Cuenta eliminada", slug: `eliminada-${a.nutritionist.id}`, phoneWa: null });
      expect(n.purgedAt).toBeInstanceOf(Date);
      expect(await db.select().from(sessions).where(eq(sessions.userId, a.user.id))).toHaveLength(0);
      expect(await db.select().from(accounts).where(eq(accounts.userId, a.user.id))).toHaveLength(0);
      const [wa] = await db.select().from(waMessages).where(eq(waMessages.nutritionistId, a.nutritionist.id));
      expect(wa!.payload).toEqual({});

      // Retención legal: cita y pago siguen, ligados a la nutri anonimizada.
      expect(await statusOf(done.id)).toMatchObject({ status: "completed", nutritionistId: a.nutritionist.id });
      const pays = await db.select().from(payments).where(eq(payments.appointmentId, done.id));
      expect(pays).toEqual([expect.objectContaining({ amountCents: 70000, status: "paid" })]);

      const [audit] = await db.select().from(auditLog).where(eq(auditLog.action, "account.purged"));
      expect(audit).toMatchObject({ actorId: "system:account-purge", entityId: a.nutritionist.id });

      // Idempotente y sin efectos sobre B.
      expect(await purgeAccount(a.nutritionist.id, later)).toMatchObject({ purged: false, reason: "ya purgada" });
      expect(await findAccountsDueForPurge(later)).toEqual([]);
      const [pb] = await db.select().from(patients).where(eq(patients.id, patientOfB.id));
      expect(pb!.name).toBe("Paciente de Beto");
      // El slug quedó libre.
      await expect(seedNutritionist({ slug: "ana-nutri" })).resolves.toBeTruthy();
    });
  });

  describe("Aislamiento entre nutriólogas", () => {
    it("Beto no puede borrar la cuenta de Ana: con la contraseña de Ana falla y Ana queda intacta", async () => {
      const futureA = await seedAppointment({ nutritionistId: a.nutritionist.id });
      loginAs(b);

      expect(await requestAccountDeletion({ password: PASSWORD_A, confirmation: "ELIMINAR" })).toMatchObject({ ok: false });
      expect((await nutriRow(a.nutritionist.id)).deletedAt).toBeNull();
      expect((await nutriRow(b.nutritionist.id)).deletedAt).toBeNull();

      // Con su propia contraseña solo se marca Beto.
      expect(await requestAccountDeletion({ password: PASSWORD_B, confirmation: "ELIMINAR" })).toMatchObject({ ok: true });
      expect((await nutriRow(b.nutritionist.id)).deletedAt).toBeInstanceOf(Date);
      expect((await nutriRow(a.nutritionist.id)).deletedAt).toBeNull();
      expect((await statusOf(futureA.id)).status).toBe("confirmed");
      expect(await db.select().from(sessions).where(eq(sessions.userId, a.user.id))).toHaveLength(1);
    });
  });
});
