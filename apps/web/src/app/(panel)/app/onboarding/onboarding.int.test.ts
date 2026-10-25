import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedNutritionist } from "@granola/db/testing";

import { availabilityRules, db, eq, nutritionists, services } from "@/lib/db";
import { enforceOnboarding, PATHNAME_HEADER } from "@/lib/onboarding-gate";
import { requireNutritionist } from "@/lib/session";
import { RedirectSignal } from "@/test/next-mocks";

import { finishOnboarding, saveOnboardingAvailability, saveOnboardingProfile, saveOnboardingService } from "./actions";

vi.mock("@/lib/inngest-client", () => ({ sendEvent: vi.fn(async () => true) }));
vi.mock("@/lib/session", () => ({ requireNutritionist: vi.fn() }));

// El pathname llega como header que pone proxy.ts; aquí lo controla cada test.
const request = vi.hoisted(() => ({ pathname: "/app" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-granola-pathname": request.pathname, "x-forwarded-for": "203.0.113.7" }),
}));

type Seeded = Awaited<ReturnType<typeof seedNutritionist>>;

function loginAs({ user, nutritionist }: Seeded) {
  vi.mocked(requireNutritionist).mockImplementation(async () => {
    const fresh = await db.query.nutritionists.findFirst({ where: eq(nutritionists.id, nutritionist.id) });
    return { user: { ...user, image: user.image ?? null }, nutritionist: fresh! };
  });
}

async function stepOf(id: string) {
  const [row] = await db
    .select({ step: nutritionists.onboardingStep })
    .from(nutritionists)
    .where(eq(nutritionists.id, id));
  return row?.step;
}

describe("Onboarding de una nutrióloga nueva", () => {
  let n: Seeded;

  beforeEach(async () => {
    n = await seedNutritionist({ slug: "nueva-1234", availability: [] });
    await db.update(nutritionists).set({ onboardingStep: 0 }).where(eq(nutritionists.id, n.nutritionist.id));
    loginAs(n);
    request.pathname = "/app";
  });

  describe("Cuando completa el wizard", () => {
    it("onboarding_step avanza 0 → 1 → 2 → 3 → 4 y cada paso guarda lo suyo", async () => {
      expect(await saveOnboardingProfile({ displayName: "Karla Nutrióloga", slug: "karla-nutri" })).toEqual({ ok: true });
      expect(await stepOf(n.nutritionist.id)).toBe(1);
      const [profile] = await db.select().from(nutritionists).where(eq(nutritionists.id, n.nutritionist.id));
      expect(profile).toMatchObject({ displayName: "Karla Nutrióloga", slug: "karla-nutri" });

      expect(
        await saveOnboardingService({
          name: "Primera consulta",
          description: "",
          durationMin: 60,
          priceMxn: 650,
          modality: "online",
          location: "",
          paymentMode: "at_visit",
          isActive: true,
        }),
      ).toEqual({ ok: true });
      expect(await stepOf(n.nutritionist.id)).toBe(2);
      const svc = await db.select().from(services).where(eq(services.nutritionistId, n.nutritionist.id));
      expect(svc).toEqual([expect.objectContaining({ name: "Primera consulta", priceCents: 65000 })]);

      expect(
        await saveOnboardingAvailability([
          { weekday: 1, startTime: "09:00", endTime: "14:00" },
          { weekday: 1, startTime: "16:00", endTime: "19:00" },
        ]),
      ).toEqual({ ok: true });
      expect(await stepOf(n.nutritionist.id)).toBe(3);
      const rules = await db.select().from(availabilityRules).where(eq(availabilityRules.nutritionistId, n.nutritionist.id));
      expect(rules).toHaveLength(2);

      expect(await finishOnboarding()).toEqual({ ok: true });
      expect(await stepOf(n.nutritionist.id)).toBe(4);
    });

    it("no deja repetir el paso del servicio (no crea servicios duplicados)", async () => {
      await db.update(nutritionists).set({ onboardingStep: 2 }).where(eq(nutritionists.id, n.nutritionist.id));
      const res = await saveOnboardingService({
        name: "Otra",
        durationMin: 30,
        priceMxn: 0,
        modality: "online",
        paymentMode: "at_visit",
        isActive: true,
      });
      expect(res).toMatchObject({ ok: false });
      expect(await db.select().from(services).where(eq(services.nutritionistId, n.nutritionist.id))).toHaveLength(0);
      expect(await stepOf(n.nutritionist.id)).toBe(2);
    });

    it("un slug ocupado por otra nutrióloga no avanza el paso", async () => {
      await seedNutritionist({ slug: "ocupado" });
      const res = await saveOnboardingProfile({ displayName: "Karla", slug: "ocupado" });
      expect(res).toEqual({ ok: false, error: "Ese link ya está en uso" });
      expect(await stepOf(n.nutritionist.id)).toBe(0);
    });
  });

  describe("Cuando elige «Lo hago después»", () => {
    it("onboarding_step queda en 4 desde cualquier paso", async () => {
      expect(await finishOnboarding()).toEqual({ ok: true });
      expect(await stepOf(n.nutritionist.id)).toBe(4);
    });
  });

  describe("Gate server-side del panel", () => {
    it("con onboarding_step < 4 redirige cualquier ruta del panel a /app/onboarding", async () => {
      request.pathname = "/app/agenda";
      await expect(enforceOnboarding(2)).rejects.toEqual(new RedirectSignal("/app/onboarding"));
      request.pathname = "/app";
      await expect(enforceOnboarding(0)).rejects.toBeInstanceOf(RedirectSignal);
    });

    it("en /app/onboarding no redirige (sin bucle) y avisa que es la ruta del wizard", async () => {
      request.pathname = "/app/onboarding";
      await expect(enforceOnboarding(1)).resolves.toEqual({ onOnboardingRoute: true });
    });

    it("con onboarding_step ≥ 4 deja pasar", async () => {
      request.pathname = "/app/agenda";
      await expect(enforceOnboarding(4)).resolves.toEqual({ onOnboardingRoute: false });
    });

    it(`el header ${PATHNAME_HEADER} faltante cuenta como ruta del panel`, async () => {
      request.pathname = "";
      await expect(enforceOnboarding(0)).rejects.toBeInstanceOf(RedirectSignal);
    });
  });
});
