import { expect, test } from "@playwright/test";

// UI real + server action + Postgres: la preferencia sobrevive una recarga.
test("la nutri cambia sus avisos de WhatsApp desde Configuración en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login?next=/app/configuracion");
  await page.getByLabel("Correo").fill("karla@granola.demo");
  await page.getByLabel("Contraseña").fill("granola-demo-2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/app\/configuracion/);

  const toggle = page.getByRole("switch", { name: "Avisarme por WhatsApp cuando agenden" });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeEnabled();
  await page.reload();
  await expect(toggle).not.toBeChecked();

  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect(toggle).toBeEnabled();
  await page.reload();
  await expect(toggle).toBeChecked();
});
