import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryTestDb, seedAppointment, seedNutritionist, seedPatient, seedService } from "@granola/db/testing";

import { auditLog, db, eq, nutritionists, payments, users } from "@/lib/db";
import { requireNutritionist } from "@/lib/session";
import { TEST_CLIENT_IP } from "@/test/next-mocks";

import { updateTimezone } from "../agenda/actions";
import { exportAccount, saveAccount } from "./actions";

vi.mock("@/lib/inngest-client", () => ({ sendEvent: vi.fn(async () => true) }));
// La sesión (Better Auth + cookies) es frontera: decidimos quién está logueada.
vi.mock("@/lib/session", () => ({ requireNutritionist: vi.fn() }));

type Seeded = Awaited<ReturnType<typeof seedNutritionist>>;

/** Cada llamada relee la fila, como hace requireNutritionist en un request real. */
function loginAs({ user, nutritionist }: Seeded) {
  vi.mocked(requireNutritionist).mockImplementation(async () => {
    const fresh = await db.query.nutritionists.findFirst({ where: eq(nutritionists.id, nutritionist.id) });
    return { user: { ...user, image: user.image ?? null }, nutritionist: fresh! };
  });
}

async function seedPaidAppointment(nutritionistId: string, patientName: string) {
  const patient = await seedPatient({ nutritionistId, name: patientName });
  const appt = await seedAppointment({ nutritionistId, patientId: patient.id });
  await db.insert(payments).values({
    appointmentId: appt.id,
    provider: "cash",
    amountCents: 65000,
    status: "paid",
    method: "cash",
    paidAt: new Date(),
  });
  return { patient, appt };
}

describe("Configuración de cuenta", () => {
  let a: Seeded;
  let b: Seeded;

  beforeEach(async () => {
    a = await seedNutritionist({ slug: "nutri-a", displayName: "Ana Nutri", email: "ana@granola.test" });
    b = await seedNutritionist({ slug: "nutri-b", displayName: "Beto Nutri" });
    loginAs(a);
  });

  describe("Cuando exporta sus datos", () => {
    it("el JSON trae solo lo de la nutrióloga en sesión (perfil, servicios, disponibilidad, pacientes, citas y pagos)", async () => {
      await seedService({ nutritionistId: a.nutritionist.id, name: "Consulta A" });
      const own = await seedPaidAppointment(a.nutritionist.id, "Paciente de A");
      await seedService({ nutritionistId: b.nutritionist.id, name: "Consulta B" });
      await seedPaidAppointment(b.nutritionist.id, "Paciente de B");

      const data = JSON.parse(await exportAccount()) as Record<string, unknown> & {
        nutritionist: { id: string; email: string; slug: string };
        services: { name: string; nutritionistId: string }[];
        availability: { rules: unknown[]; overrides: unknown[] };
        patients: { id: string; name: string }[];
        appointments: { id: string }[];
        payments: { appointmentId: string; amountCents: number }[];
      };

      expect(data.nutritionist).toMatchObject({ id: a.nutritionist.id, email: "ana@granola.test", slug: "nutri-a" });
      // seedService + el servicio que crea seedAppointment: ambos de A, ninguno de B.
      expect(data.services.every((s) => s.nutritionistId === a.nutritionist.id)).toBe(true);
      expect(data.services.map((s) => s.name)).toContain("Consulta A");
      expect(data.services.map((s) => s.name)).not.toContain("Consulta B");
      expect(data.availability.rules).toHaveLength(7);
      expect(data.patients.map((p) => p.name)).toEqual(["Paciente de A"]);
      expect(data.appointments.map((x) => x.id)).toEqual([own.appt.id]);
      expect(data.payments).toEqual([expect.objectContaining({ appointmentId: own.appt.id, amountCents: 65000 })]);

      // Llaves de acceso fuera del export.
      const raw = JSON.stringify(data);
      expect(raw).not.toContain(own.appt.cancelToken);
      expect(raw).not.toContain("googleRefreshTokenEnc");
      expect(raw).not.toContain("stripeRequirements");
    });

    it("registra account.export en audit_log con actor, IP y conteos", async () => {
      await seedPaidAppointment(a.nutritionist.id, "Paciente de A");

      await exportAccount();

      const rows = await db.select().from(auditLog).where(eq(auditLog.action, "account.export"));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId: a.user.id,
        entity: "nutritionist",
        entityId: a.nutritionist.id,
        ip: TEST_CLIENT_IP,
        meta: { patients: 1, appointments: 1, payments: 1 },
      });
    });
  });

  describe("Cuando cambia su zona horaria", () => {
    it("persiste en nutritionists.timezone", async () => {
      expect(await updateTimezone("America/Bogota")).toEqual({ ok: true });
      const [row] = await db
        .select({ timezone: nutritionists.timezone })
        .from(nutritionists)
        .where(eq(nutritionists.id, a.nutritionist.id));
      expect(row?.timezone).toBe("America/Bogota");
    });

    it("rechaza una zona inválida sin tocar la guardada", async () => {
      expect(await updateTimezone("Mars/Olympus")).toMatchObject({ ok: false });
      const [row] = await queryTestDb<{ timezone: string }>("SELECT timezone FROM nutritionists WHERE id = $1", [
        a.nutritionist.id,
      ]);
      expect(row?.timezone).toBe("America/Mexico_City");
    });
  });

  describe("Cuando cambia su nombre", () => {
    it("actualiza nombre público y users.name sin pisar el tema que Mi página guardó después de cargar", async () => {
      // Mi página guarda un tema mientras Configuración tenía una copia vieja de la fila.
      await db
        .update(nutritionists)
        .set({ theme: { preset: "menta", showReviews: false } })
        .where(eq(nutritionists.id, a.nutritionist.id));

      expect(await saveAccount({ name: "Ana María" })).toEqual({ ok: true });

      const [n] = await db.select().from(nutritionists).where(eq(nutritionists.id, a.nutritionist.id));
      const [u] = await db.select().from(users).where(eq(users.id, a.user.id));
      expect(n).toMatchObject({ displayName: "Ana María", slug: "nutri-a", theme: { preset: "menta", showReviews: false } });
      expect(u?.name).toBe("Ana María");
      // B intacta.
      const [nb] = await db.select().from(nutritionists).where(eq(nutritionists.id, b.nutritionist.id));
      expect(nb?.displayName).toBe("Beto Nutri");
    });
  });
});
