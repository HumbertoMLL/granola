import { expect, test } from "@playwright/test";

test("Pacientes usa filtros aplicados y abre el expediente y la hoja de medición", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login?next=/app/pacientes");
  await page.getByLabel("Correo").fill("karla@granola.demo");
  await page.getByLabel("Contraseña").fill("granola-demo-2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/app\/pacientes/);
  await expect(
    page.getByRole("heading", { name: "Pacientes", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Buscar por nombre o WhatsApp").fill("Ana");
  await page.getByRole("button", { name: "Con correo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Quitar filtro Con correo" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Pacientes", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Limpiar todo", exact: true }).click();
  await expect(page.getByLabel("Buscar por nombre o WhatsApp")).toHaveValue("");
  await page.getByLabel("Buscar por nombre o WhatsApp").fill("Luis Pérez");
  await page.getByRole("link", { name: "Ver expediente", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Luis Pérez", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Antropometría" }).click();
  await expect(
    page.getByRole("heading", { name: "Todavía no hay mediciones" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nueva medición", exact: true })
    .click();
  const sheet = page.getByRole("dialog", {
    name: "Nueva medición",
    exact: true,
  });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Peso (kg)")).toBeVisible();
  await sheet.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(sheet).toHaveCount(0);
});
