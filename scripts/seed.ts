// Seed de desarrollo: una nutrióloga demo con servicios y disponibilidad.
// Uso: pnpm db:seed   (lee DATABASE_URL de apps/web/.env.local)
// Idempotente: si ya existe el slug "karla", actualiza en vez de duplicar.

import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../apps/web/.env.local"), quiet: true });

// Import dinámico para que dotenv cargue antes de que @granola/db lea DATABASE_URL.
const { db, eq, users, nutritionists, services, availabilityRules } = await import("@granola/db");

const DEMO_EMAIL = "karla@granola.demo";
const DEMO_SLUG = "karla";

async function main() {
  console.log("→ Seed: Karla Demo");

  // 1. Usuario (sin password: entra por magic link).
  const [user] = await db
    .insert(users)
    .values({ name: "Karla Demo", email: DEMO_EMAIL, emailVerified: true })
    .onConflictDoUpdate({ target: users.email, set: { name: "Karla Demo", updatedAt: new Date() } })
    .returning();
  if (!user) throw new Error("No se pudo crear el usuario demo");

  // 2. Perfil de nutrióloga.
  const [nutri] = await db
    .insert(nutritionists)
    .values({
      userId: user.id,
      slug: DEMO_SLUG,
      displayName: "Karla Demo",
      bio: "Nutrióloga clínica. Consulta online y presencial en CDMX. Sin dietas de hambre.",
      phoneWa: "+525500000000",
      timezone: "America/Mexico_City",
      links: [
        { label: "Instagram", url: "https://instagram.com/karla.demo" },
        { label: "TikTok", url: "https://tiktok.com/@karla.demo" },
      ],
      theme: { primary: "#6B8E23" },
      plan: "trial",
      onboardingStep: 99,
    })
    .onConflictDoUpdate({
      target: nutritionists.userId,
      set: { slug: DEMO_SLUG, displayName: "Karla Demo", updatedAt: new Date() },
    })
    .returning();
  if (!nutri) throw new Error("No se pudo crear la nutrióloga demo");

  // 3. Servicios (se reemplazan completos para que el seed sea repetible).
  await db.delete(services).where(eq(services.nutritionistId, nutri.id));
  await db.insert(services).values([
    {
      nutritionistId: nutri.id,
      name: "Primera consulta",
      description: "Historia clínica, antropometría y plan inicial.",
      durationMin: 60,
      priceCents: 80000,
      currency: "MXN",
      modality: "ambas",
      location: "Consultorio Roma Norte, CDMX",
      paymentMode: "prepaid",
      sortOrder: 0,
    },
    {
      nutritionistId: nutri.id,
      name: "Seguimiento",
      description: "Revisión de avances y ajuste del plan.",
      durationMin: 30,
      priceCents: 50000,
      currency: "MXN",
      modality: "online",
      paymentMode: "optional",
      sortOrder: 1,
    },
  ]);

  // 4. Disponibilidad L–V 9:00–14:00 y 16:00–19:00 (hora local del nutri).
  await db.delete(availabilityRules).where(eq(availabilityRules.nutritionistId, nutri.id));
  const weekdays = [1, 2, 3, 4, 5]; // lunes a viernes
  await db.insert(availabilityRules).values(
    weekdays.flatMap((weekday) => [
      { nutritionistId: nutri.id, weekday, startTime: "09:00", endTime: "14:00" },
      { nutritionistId: nutri.id, weekday, startTime: "16:00", endTime: "19:00" },
    ]),
  );

  console.log(`✓ Lista: /${DEMO_SLUG} (user ${user.id}, nutri ${nutri.id})`);
  console.log(`  Entra con magic link usando ${DEMO_EMAIL} (el URL sale en la consola de next dev).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
