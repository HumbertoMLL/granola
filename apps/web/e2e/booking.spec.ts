import { expect, test } from "@playwright/test";

import { closeTestDb, findLatestAppointmentByPatientPhone } from "@granola/db/testing";

/**
 * Flujo estrella de punta a punta (sin mocks): la paciente agenda en /karla/agendar,
 * la nutri la ve en su agenda y la paciente cancela desde el link de su cita.
 * Datos: seed demo (karla@granola.demo / granola-demo-2026) que corre e2e/prepare.mts.
 */
const PATIENT_NAME = "Paciente E2E Playwright";
const PATIENT_PHONE_NATIONAL = "55 1234 0000";
const PATIENT_PHONE_E164 = "+525512340000";

test.afterAll(async () => {
  await closeTestDb();
});

test("una paciente agenda Seguimiento, la nutri la ve en su agenda y la paciente cancela", async ({ browser }) => {
  // --- 1. Paciente agenda ---------------------------------------------------------
  const patient = await browser.newPage();
  await patient.goto("/karla/agendar");

  await patient.getByRole("button", { name: /Seguimiento/ }).click();
  await expect(patient.getByRole("heading", { name: "Elige día y hora" })).toBeVisible();

  // Primer horario del primer día con disponibilidad (los botones de hora dicen "10:00", "4:30 p.m.", …).
  const firstSlot = patient.getByRole("button", { name: /^\d{1,2}:\d{2}/ }).first();
  await expect(firstSlot).toBeVisible();
  await firstSlot.click();

  await expect(patient.getByRole("heading", { name: "Tus datos" })).toBeVisible();
  await patient.getByPlaceholder("María Pérez").fill(PATIENT_NAME);
  await patient.getByPlaceholder("55 1234 5678").fill(PATIENT_PHONE_NATIONAL);
  await patient.getByRole("checkbox").check();
  await patient.getByRole("button", { name: "Confirmar cita" }).click();

  await patient.waitForURL(/\/karla\/agendar\/listo\?cita=/);
  await expect(patient.getByRole("heading", { name: /Listo, Paciente/ })).toBeVisible();

  const appt = await findLatestAppointmentByPatientPhone(PATIENT_PHONE_E164);
  expect(appt, "la cita debe existir en la DB").not.toBeNull();
  expect(appt!.status).toBe("confirmed");
  expect(new URL(patient.url()).searchParams.get("cita")).toBe(appt!.cancelToken);
  await patient.close();

  // --- 2. La nutri entra y ve la cita en su agenda -----------------------------------
  const nutriContext = await browser.newContext();
  const nutri = await nutriContext.newPage();
  await nutri.goto("/login?next=/app/agenda");
  await nutri.getByLabel("Correo").fill("karla@granola.demo");
  await nutri.getByLabel("Contraseña").fill("granola-demo-2026");
  await nutri.getByRole("button", { name: "Entrar" }).click();
  await nutri.waitForURL(/\/app\/agenda/);
  await expect(nutri.getByRole("link", { name: PATIENT_NAME })).toBeVisible();
  await nutriContext.close();

  // --- 3. La paciente cancela desde el link de su cita --------------------------------
  const patientAgain = await browser.newPage();
  await patientAgain.goto(`/cita/${encodeURIComponent(appt!.cancelToken)}`);
  await patientAgain.getByRole("button", { name: "Cancelar cita" }).click();
  await patientAgain.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect(patientAgain.getByText("Cita cancelada").first()).toBeVisible();

  await expect
    .poll(async () => (await findLatestAppointmentByPatientPhone(PATIENT_PHONE_E164))?.status)
    .toBe("cancelled");
  await patientAgain.close();
});

test("el link Meet persistido aparece en la confirmación y en el detalle de la cita", async ({ page }) => {
  const { db, eq, nutritionists, appointments } = await import("@granola/db");
  const { seedAppointment } = await import("@granola/db/testing");
  const nutri = await db.query.nutritionists.findFirst({ where: eq(nutritionists.slug, "karla") });
  expect(nutri).toBeTruthy();
  const startsAt = new Date(Date.now() + 5 * 86_400_000);
  const appt = await seedAppointment({ nutritionistId: nutri!.id, status: "confirmed", modality: "online", startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000) });
  // Google está mockeado en integración. Aquí se prueba la salida persistida del job,
  // sin conectar una cuenta Google real ni depender de los sleeps de Inngest.
  const meet = "https://meet.google.com/abc-defg-hij";
  await db.update(appointments).set({ meetUrl: meet, googleEventId: "e2e-google-event" }).where(eq(appointments.id, appt.id));
  await page.goto(`/karla/agendar/listo?cita=${encodeURIComponent(appt.cancelToken)}`);
  await expect(page.getByRole("link", { name: "Entrar a la videollamada" })).toHaveAttribute("href", meet);
  await page.goto(`/cita/${encodeURIComponent(appt.cancelToken)}`);
  await expect(page.getByRole("link", { name: "Entrar a la videollamada" })).toHaveAttribute("href", meet);
});
