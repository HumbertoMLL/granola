import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

test("en escritorio la vista Día permite avanzar y volver un día", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/login?next=/app/agenda");
  await page.getByLabel("Correo").fill("karla@granola.demo");
  await page.getByLabel("Contraseña").fill("granola-demo-2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app\/agenda/);
  const date = page
    .getByRole("group", { name: "Herramientas de agenda" })
    .getByRole("heading", { level: 2 });
  const initial = await date.textContent();
  await page
    .getByRole("button", { name: "Día siguiente", exact: true })
    .click();
  await expect(date).not.toHaveText(initial!);
  await page.getByRole("button", { name: "Día anterior", exact: true }).click();
  await expect(date).toHaveText(initial!);
});

/** Los cuatro archivos quedan disponibles como artefactos del PR a 390 px. */
const capture = (name: string) =>
  fileURLToPath(new URL(`../../../docs/ux-captures/${name}`, import.meta.url));

async function mobileCapture(page: Page, name: string) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: capture(name), animations: "disabled" });
}

test("Karla consulta Día, cambia a Semana y abre una cita en la hoja inferior", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/karla");
  await expect(
    page.getByRole("link", { name: "Agendar consulta", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Próximo horario:/)).toBeVisible();
  await mobileCapture(page, "01-perfil-390.png");

  await page.goto("/karla/agendar");
  await page
    .getByRole("radio", { name: /Seguimiento/ })
    .locator("..")
    .click();
  await expect(page.getByRole("radio", { name: /Seguimiento/ })).toBeChecked();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "¿Qué día te queda?" }),
  ).toBeVisible();
  await page.locator("button[aria-pressed]:enabled").first().click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "¿A qué hora?" }),
  ).toBeVisible();
  await expect(page.getByRole("radio").first()).toBeAttached();
  await mobileCapture(page, "02-reserva-390.png");

  await page.goto("/login?next=/app/agenda");
  await page.getByLabel("Correo").fill("karla@granola.demo");
  await page.getByLabel("Contraseña").fill("granola-demo-2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/app\/agenda/);
  await expect(
    page.getByRole("region", { name: "Agenda del día" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Luis Pérez/ })).toBeInViewport(
    { ratio: 0.8 },
  );
  await mobileCapture(page, "03-agenda-dia-390.png");
  await page
    .getByRole("radio", { name: "Semana", exact: true })
    .locator("..")
    .click();
  await expect(
    page.getByRole("region", { name: "Agenda de la semana" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Luis Pérez/ }).click();
  const sheet = page.getByRole("dialog", { name: "Luis Pérez", exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Abrir Meet" })).toBeVisible();
  await expect(
    sheet.getByRole("link", { name: "WhatsApp al paciente" }),
  ).toBeVisible();
  await mobileCapture(page, "04-agenda-semana-390.png");
  await sheet.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByRole("button", { name: "Pendientes de pago", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Quitar filtro Pendientes de pago" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar filtros", exact: true })
    .click();
  await page.getByRole("button", { name: "Limpiar todo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Quitar filtro Pendientes de pago" }),
  ).toHaveCount(0);
});

test("el navegador vuelve al paso anterior conservando los datos del paciente", async ({
  page,
}) => {
  await page.goto("/karla/agendar");
  await page
    .getByRole("radio", { name: /Seguimiento/ })
    .locator("..")
    .click();
  await expect(page.getByRole("radio", { name: /Seguimiento/ })).toBeChecked();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "¿Qué día te queda?" }),
  ).toBeVisible();
  await page.locator("button[aria-pressed]:enabled").first().click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "¿A qué hora?" }),
  ).toBeVisible();
  await page.getByRole("radio").first().locator("..").click();
  await expect(page.getByRole("radio").first()).toBeChecked();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Nombre completo").fill("Conservar mi nombre");
  await page.getByLabel("WhatsApp", { exact: true }).fill("5512344321");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "¿A qué hora?" }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel("Nombre completo")).toHaveValue(
    "Conservar mi nombre",
  );
  await expect(page.getByLabel("WhatsApp", { exact: true })).toHaveValue(
    "5512344321",
  );
  await expect(
    page.getByRole("button", { name: "+ Agregar correo" }),
  ).toBeVisible();
});

test("si otra paciente ocupa el horario, vuelve a Hora sin perder datos", async ({
  browser,
}) => {
  const first = await browser.newPage();
  await first.goto("/karla/agendar");
  await first
    .getByRole("radio", { name: /Seguimiento/ })
    .locator("..")
    .click();
  await expect(first.getByRole("radio", { name: /Seguimiento/ })).toBeChecked();
  await first.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    first.getByRole("heading", { name: "¿Qué día te queda?" }),
  ).toBeVisible();
  await first.locator("button[aria-pressed]:enabled").first().click();
  await first.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    first.getByRole("heading", { name: "¿A qué hora?" }),
  ).toBeVisible();
  await first.getByRole("radio").first().locator("..").click();
  await expect(first.getByRole("radio").first()).toBeChecked();
  await first.getByRole("button", { name: "Continuar", exact: true }).click();
  await first.getByLabel("Nombre completo").fill("Paciente que conserva datos");
  await first.getByLabel("WhatsApp", { exact: true }).fill("5512349001");
  await first.getByRole("checkbox").check();
  const second = await browser.newPage();
  await second.goto(first.url());
  await second
    .getByLabel("Nombre completo")
    .fill("Paciente que gana el horario");
  await second.getByLabel("WhatsApp", { exact: true }).fill("5512349002");
  await second.getByRole("checkbox").check();
  await second.getByRole("button", { name: "Confirmar cita" }).click();
  await second.waitForURL(/\/karla\/agendar\/listo/);
  await first.getByRole("button", { name: "Confirmar cita" }).click();
  await expect(
    first.getByRole("heading", { name: "¿A qué hora?" }),
  ).toBeVisible();
  await expect(
    first.getByRole("alert").filter({ hasText: "se acaba de ocupar" }),
  ).toContainText("se acaba de ocupar");
  await expect(
    first.getByRole("heading", { name: "¿A qué hora?" }),
  ).toBeVisible();
  await first.getByRole("radio").first().locator("..").click();
  await expect(first.getByRole("radio").first()).toBeChecked();
  await first.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(first.getByLabel("Nombre completo")).toHaveValue(
    "Paciente que conserva datos",
  );
  await expect(first.getByLabel("WhatsApp", { exact: true })).toHaveValue(
    "5512349001",
  );
  await first.close();
  await second.close();
});
