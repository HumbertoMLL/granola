import { describe, expect, it } from "vitest";

import { fakeCancelToken, seedAppointment, seedNutritionist, seedService } from "@granola/db/testing";

import { db, reviews } from "@/lib/db";

import { getPublicProfile, RESERVED_SLUGS } from "./public-profile";

/** Datos que jamás deben salir en la página pública. */
const SECRETS = {
  email: "karla.privada@granola.test",
  stripeAccountId: "acct_test_secreto_123",
  googleRefreshTokenEnc: "enc:refresh-token-secreto",
  mpUserId: "mp-user-secreto-987",
  cancelToken: fakeCancelToken(),
  patientPhone: "+525598765432",
  patientEmail: "paciente.privada@granola.test",
};

async function seedFullProfile(theme: { showWhatsApp?: boolean; showReviews?: boolean } = {}) {
  const { nutritionist } = await seedNutritionist({
    slug: "karla-test",
    displayName: "Karla Test",
    email: SECRETS.email,
    stripeAccountId: SECRETS.stripeAccountId,
    googleRefreshTokenEnc: SECRETS.googleRefreshTokenEnc,
    mpUserId: SECRETS.mpUserId,
    phoneWa: "+525500001111",
    theme,
  });
  const service = await seedService({ nutritionistId: nutritionist.id, name: "Seguimiento" });
  await seedService({ nutritionistId: nutritionist.id, name: "Servicio oculto", isActive: false });
  const appt = await seedAppointment({
    nutritionistId: nutritionist.id,
    serviceId: service.id,
    cancelToken: SECRETS.cancelToken,
    startsAt: new Date(Date.now() - 7 * 86_400_000),
    status: "completed",
  });
  await db.insert(reviews).values({
    nutritionistId: nutritionist.id,
    patientId: appt.patientId,
    appointmentId: appt.id,
    rating: 5,
    text: "Muy buena consulta",
    isPublic: true,
    verified: true,
  });
  return nutritionist;
}

describe("Cuando alguien abre la página pública de una nutrióloga", () => {
  it("ve nombre, servicios activos y reseñas verificadas", async () => {
    await seedFullProfile();

    const profile = await getPublicProfile("karla-test");

    expect(profile).not.toBeNull();
    expect(profile!.displayName).toBe("Karla Test");
    expect(profile!.services.map((s) => s.name)).toEqual(["Seguimiento"]);
    expect(profile!.reviews).toHaveLength(1);
    expect(profile!.reviews[0]!.authorName).toBe("Paciente"); // solo el primer nombre
    expect(profile!.reviewStats).toEqual({ count: 1, average: 5 });
  });

  it("nunca expone email, stripeAccountId, googleRefreshTokenEnc, mpUserId ni cancel tokens", async () => {
    await seedFullProfile({ showWhatsApp: true });

    const profile = await getPublicProfile("karla-test");
    const serialized = JSON.stringify(profile);

    for (const [field, value] of Object.entries(SECRETS)) {
      expect(serialized, `se filtró ${field}`).not.toContain(value);
    }
    for (const key of ["email", "stripeAccountId", "googleRefreshTokenEnc", "mpUserId", "cancelToken", "userId", "id"]) {
      expect(profile).not.toHaveProperty(key);
    }
  });

  it("el WhatsApp de la nutri solo aparece si ella activó el botón", async () => {
    await seedFullProfile({ showWhatsApp: false });
    expect((await getPublicProfile("karla-test"))!.phoneWa).toBeNull();
  });

  it("un slug inexistente devuelve null", async () => {
    expect(await getPublicProfile("no-existe")).toBeNull();
  });

  it.each(["app", "login", "api", "cita", "admin", "pago"])(
    "el slug reservado '%s' devuelve null aunque exista una fila con ese slug",
    async (slug) => {
      expect(RESERVED_SLUGS as readonly string[]).toContain(slug);
      await seedNutritionist({ slug });

      expect(await getPublicProfile(slug)).toBeNull();
      expect(await getPublicProfile(slug.toUpperCase())).toBeNull();
    },
  );
});
