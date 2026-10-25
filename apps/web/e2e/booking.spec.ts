import { expect, test } from "@playwright/test";

import {
  closeTestDb,
  findLatestAppointmentByPatientPhone,
} from "@granola/db/testing";

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

test("una paciente agenda Seguimiento, la nutri la ve en su agenda y la paciente cancela", async ({
  browser,
}) => {
  // --- 1. Paciente agenda ---------------------------------------------------------
  const patient = await browser.newPage();
  await patient.goto("/karla/agendar");

  await patient
    .getByRole("radio", { name: /Seguimiento/ })
    .locator("..")
    .click();
  await expect(
    patient.getByRole("radio", { name: /Seguimiento/ }),
  ).toBeChecked();
  await patient.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    patient.getByRole("heading", { name: "¿Qué día te queda?" }),
  ).toBeVisible();
  await expect(
    patient.getByRole("heading", { name: "¿Qué día te queda?" }),
  ).toBeVisible();
  await patient.locator("button[aria-pressed]:enabled").first().click();
  await patient.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    patient.getByRole("heading", { name: "¿A qué hora?" }),
  ).toBeVisible();

  // Primer horario del primer día con disponibilidad (los botones de hora dicen "10:00", "4:30 p.m.", …).
  const firstSlot = patient.getByRole("radio").first();
  await expect(firstSlot).toBeVisible();
  await firstSlot.locator("..").click();
  await patient.getByRole("button", { name: "Continuar", exact: true }).click();

  await expect(
    patient.getByRole("heading", { name: "Tus datos" }),
  ).toBeVisible();
  await patient.getByLabel("Nombre completo").fill(PATIENT_NAME);
  await patient
    .getByLabel("WhatsApp", { exact: true })
    .fill(PATIENT_PHONE_NATIONAL);
  await patient.getByRole("checkbox").check();
  await patient.getByRole("button", { name: "Confirmar cita" }).click();

  await patient.waitForURL(/\/karla\/agendar\/listo\?cita=/);
  await expect(
    patient.getByRole("heading", { name: /Listo, Paciente/ }),
  ).toBeVisible();

  const appt = await findLatestAppointmentByPatientPhone(PATIENT_PHONE_E164);
  expect(appt, "la cita debe existir en la DB").not.toBeNull();
  expect(appt!.status).toBe("confirmed");
  expect(new URL(patient.url()).searchParams.get("cita")).toBe(
    appt!.cancelToken,
  );
  await patient.close();

  // --- 2. La nutri entra y ve la cita en su agenda -----------------------------------
  const nutriContext = await browser.newContext();
  const nutri = await nutriContext.newPage();
  await nutri.goto("/login?next=/app/agenda");
  await nutri.getByLabel("Correo").fill("karla@granola.demo");
  await nutri.getByLabel("Contraseña").fill("granola-demo-2026");
  await nutri.getByRole("button", { name: "Entrar" }).click();
  await nutri.waitForURL(/\/app\/agenda/);
  await nutri
    .getByRole("radio", { name: "Semana", exact: true })
    .locator("..")
    .click();
  const appointment = nutri.getByRole("button", {
    name: new RegExp(PATIENT_NAME),
  });
  // La primera disponibilidad podría caer en la próxima semana.
  if (!(await appointment.count()))
    await nutri.getByRole("button", { name: "Semana siguiente" }).click();
  await expect(appointment).toBeVisible();
  await appointment.click();
  await expect(nutri.getByRole("dialog", { name: PATIENT_NAME })).toBeVisible();
  await nutriContext.close();

  // --- 3. La paciente cancela desde el link de su cita --------------------------------
  const patientAgain = await browser.newPage();
  await patientAgain.goto(`/cita/${encodeURIComponent(appt!.cancelToken)}`);
  await patientAgain.getByRole("button", { name: "Cancelar cita" }).click();
  await patientAgain.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect(patientAgain.getByText("Cita cancelada").first()).toBeVisible();

  await expect
    .poll(
      async () =>
        (await findLatestAppointmentByPatientPhone(PATIENT_PHONE_E164))?.status,
    )
    .toBe("cancelled");
  await patientAgain.close();
});
