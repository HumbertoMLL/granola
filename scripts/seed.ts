// Seed de desarrollo: nutrióloga demo con servicios, disponibilidad, 2 pacientes,
// 3 citas (pasada completed, hoy confirmed, futura pending_payment), un pago en
// efectivo y una reseña pública 5★.
// Uso: pnpm db:seed   (lee DATABASE_URL de apps/web/.env.local)
// Idempotente: todo se busca por claves estables (email, slug, nombre de servicio,
// teléfono, cancel_token, provider_ref, appointment_id) y se actualiza en vez de duplicar.
// Las fechas de las citas se recalculan en cada corrida (relativas a hoy).

import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../apps/web/.env.local"), quiet: true });

// Import dinámico para que dotenv cargue antes de que @granola/db lea DATABASE_URL.
const { and, db, eq, users, accounts, nutritionists, services, availabilityRules, patients, appointments, payments, reviews } =
  await import("@granola/db");

const DEMO_EMAIL = "karla@granola.demo";
const DEMO_PASSWORD = "granola-demo-2026";
const DEMO_SLUG = "karla";
const DEMO_TZ = "America/Mexico_City";

type ServiceInsert = typeof services.$inferInsert;

/** YYYY-MM-DD de hoy en la zona del nutri. */
function todayYmd(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/**
 * Instante UTC para "hoy + days, a las hour:00" en CDMX. México no tiene horario
 * de verano desde 2022: UTC-6 fijo, así que no hace falta resolver DST aquí.
 */
function cdmx(days: number, hour: number, minute = 0): Date {
  const [y, m, d] = todayYmd(DEMO_TZ).split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days, hour + 6, minute));
}

async function main() {
  console.log("→ Seed: Karla Demo");

  // 1. Usuario demo con password (también puede entrar por magic link).
  const [user] = await db
    .insert(users)
    .values({ name: "Karla Demo", email: DEMO_EMAIL, emailVerified: true })
    .onConflictDoUpdate({ target: users.email, set: { name: "Karla Demo", updatedAt: new Date() } })
    .returning();
  if (!user) throw new Error("No se pudo crear el usuario demo");

  // 1b. Credencial email+password para Better Auth (providerId "credential").
  const { hashPassword } = await import("better-auth/crypto");
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [cred] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")))
    .limit(1);
  if (cred) {
    await db.update(accounts).set({ password: passwordHash, updatedAt: new Date() }).where(eq(accounts.id, cred.id));
  } else {
    await db.insert(accounts).values({ userId: user.id, accountId: user.id, providerId: "credential", password: passwordHash });
  }
  console.log(`  login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

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

  // 3. Servicios: upsert por nombre. No se borran (las citas los referencian con FK restrict).
  const demoServices: Omit<ServiceInsert, "nutritionistId">[] = [
    {
      name: "Primera consulta",
      description: "Historia clínica, antropometría y plan inicial.",
      durationMin: 60,
      priceCents: 80000,
      currency: "MXN",
      modality: "ambas",
      location: "Consultorio Roma Norte, CDMX",
      paymentMode: "prepaid",
      isActive: true,
      sortOrder: 0,
    },
    {
      name: "Seguimiento",
      description: "Revisión de avances y ajuste del plan.",
      durationMin: 30,
      priceCents: 50000,
      currency: "MXN",
      modality: "online",
      location: null,
      paymentMode: "optional",
      isActive: true,
      sortOrder: 1,
    },
  ];
  const serviceIds: Record<string, string> = {};
  for (const svc of demoServices) {
    const existing = await db.query.services.findFirst({
      where: and(eq(services.nutritionistId, nutri.id), eq(services.name, svc.name)),
      columns: { id: true },
    });
    if (existing) {
      await db.update(services).set({ ...svc, updatedAt: new Date() }).where(eq(services.id, existing.id));
      serviceIds[svc.name] = existing.id;
    } else {
      const [row] = await db.insert(services).values({ ...svc, nutritionistId: nutri.id }).returning({ id: services.id });
      if (!row) throw new Error(`No se pudo crear el servicio ${svc.name}`);
      serviceIds[svc.name] = row.id;
    }
  }
  const primera = serviceIds["Primera consulta"]!;
  const seguimiento = serviceIds["Seguimiento"]!;

  // 4. Disponibilidad L–V 9:00–14:00 y 16:00–19:00 (hora local del nutri).
  await db.delete(availabilityRules).where(eq(availabilityRules.nutritionistId, nutri.id));
  const weekdays = [1, 2, 3, 4, 5]; // lunes a viernes
  await db.insert(availabilityRules).values(
    weekdays.flatMap((weekday) => [
      { nutritionistId: nutri.id, weekday, startTime: "09:00", endTime: "14:00" },
      { nutritionistId: nutri.id, weekday, startTime: "16:00", endTime: "19:00" },
    ]),
  );

  // 5. Pacientes demo (con consentimiento LFPDPPP). Upsert por teléfono dentro del nutri.
  const demoPatients = [
    { name: "Ana López", phoneWa: "+525511111111", email: "ana@paciente.demo" },
    { name: "Luis Pérez", phoneWa: "+525522222222", email: null },
  ];
  const patientIds: string[] = [];
  for (const p of demoPatients) {
    const existing = await db.query.patients.findFirst({
      where: and(eq(patients.nutritionistId, nutri.id), eq(patients.phoneWa, p.phoneWa)),
      columns: { id: true },
    });
    if (existing) {
      await db.update(patients).set({ name: p.name, email: p.email, updatedAt: new Date() }).where(eq(patients.id, existing.id));
      patientIds.push(existing.id);
    } else {
      const [row] = await db
        .insert(patients)
        .values({
          nutritionistId: nutri.id,
          name: p.name,
          phoneWa: p.phoneWa,
          email: p.email,
          consentAt: new Date(),
          consentIp: "127.0.0.1",
          source: "manual",
        })
        .returning({ id: patients.id });
      if (!row) throw new Error(`No se pudo crear el paciente ${p.name}`);
      patientIds.push(row.id);
    }
  }
  const [ana, luis] = patientIds as [string, string];

  // 6. Citas. cancel_token fijo (≥16 chars, UNIQUE) = clave de idempotencia.
  const demoAppointments: (typeof appointments.$inferInsert)[] = [
    {
      // Pasada y completada: tiene pago en efectivo y reseña.
      cancelToken: "seed-karla-completada-0001",
      nutritionistId: nutri.id,
      patientId: ana,
      serviceId: primera,
      startsAt: cdmx(-7, 10),
      endsAt: cdmx(-7, 11),
      status: "completed",
      modality: "presencial",
      meetUrl: null,
      patientTimezone: DEMO_TZ,
    },
    {
      // Hoy, confirmada, en línea.
      cancelToken: "seed-karla-hoy-confirmada-0002",
      nutritionistId: nutri.id,
      patientId: luis,
      serviceId: seguimiento,
      startsAt: cdmx(0, 18),
      endsAt: cdmx(0, 18, 30),
      status: "confirmed",
      modality: "online",
      meetUrl: "https://meet.google.com/abc-defg-hij",
      patientTimezone: "America/Tijuana",
    },
    {
      // Futura, esperando pago OXXO/SPEI.
      cancelToken: "seed-karla-pendiente-pago-0003",
      nutritionistId: nutri.id,
      patientId: ana,
      serviceId: primera,
      startsAt: cdmx(3, 10),
      endsAt: cdmx(3, 11),
      status: "pending_payment",
      modality: "online",
      meetUrl: null,
      patientTimezone: DEMO_TZ,
    },
  ];
  const apptIds: string[] = [];
  for (const a of demoAppointments) {
    const [row] = await db
      .insert(appointments)
      .values(a)
      .onConflictDoUpdate({
        target: appointments.cancelToken,
        set: {
          patientId: a.patientId,
          serviceId: a.serviceId,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
          status: a.status,
          modality: a.modality,
          meetUrl: a.meetUrl,
          patientTimezone: a.patientTimezone,
          cancelledAt: null,
          cancelReason: null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: appointments.id });
    if (!row) throw new Error(`No se pudo crear la cita ${a.cancelToken}`);
    apptIds.push(row.id);
  }
  const [completedId] = apptIds as [string, string, string];

  // 7. Pago en efectivo de la cita completada. provider_ref UNIQUE = idempotencia.
  const paidAt = cdmx(-7, 11);
  await db
    .insert(payments)
    .values({
      appointmentId: completedId,
      provider: "cash",
      providerRef: "seed-cash-karla-0001",
      amountCents: 80000,
      currency: "MXN",
      status: "paid",
      method: "cash",
      paidAt,
    })
    .onConflictDoUpdate({
      target: payments.providerRef,
      set: { appointmentId: completedId, amountCents: 80000, status: "paid", paidAt, updatedAt: new Date() },
    });

  // 8. Reseña pública 5★ (una por cita: appointment_id UNIQUE).
  const reviewText = "Karla me explicó todo sin regaños y el plan sí lo puedo seguir. ¡Súper recomendada!";
  await db
    .insert(reviews)
    .values({
      nutritionistId: nutri.id,
      patientId: ana,
      appointmentId: completedId,
      rating: 5,
      text: reviewText,
      isPublic: true,
      verified: true,
    })
    .onConflictDoUpdate({
      target: reviews.appointmentId,
      set: { rating: 5, text: reviewText, isPublic: true, verified: true },
    });

  console.log(`✓ Lista: /${DEMO_SLUG} (user ${user.id}, nutri ${nutri.id})`);
  console.log(`  2 pacientes, 3 citas, 1 pago en efectivo, 1 reseña 5★.`);
  console.log(`  Reseña ya hecha: /resena/seed-karla-completada-0001 · Detalle: /app/agenda/${completedId}`);
  console.log(`  Entra con magic link usando ${DEMO_EMAIL} (el URL sale en la consola de next dev).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
