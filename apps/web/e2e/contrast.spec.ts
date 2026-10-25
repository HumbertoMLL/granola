import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectContrast(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  const results = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
}

for (const width of [390, 1280]) {
  test(`perfil y cuatro pasos de reserva tienen contraste AA a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/karla");
    await expect(
      page.getByRole("link", { name: "Agendar consulta", exact: true }),
    ).toBeVisible();
    await expectContrast(page);
    await page.goto("/karla/agendar");
    await page
      .getByRole("radio", { name: /Seguimiento/ })
      .first()
      .locator("..")
      .click();
    await expectContrast(page);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "¿Qué día te queda?" }),
    ).toBeVisible();
    await expectContrast(page);
    await page.locator("button[aria-pressed]:enabled").first().click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.getByRole("radio").first()).toBeVisible();
    await expectContrast(page);
    await page.getByRole("radio").first().locator("..").click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.getByLabel("Nombre completo")).toBeVisible();
    await expectContrast(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });

  test(`dashboard tiene contraste AA a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await page.getByLabel("Correo").fill("karla@granola.demo");
    await page.getByLabel("Contraseña").fill("granola-demo-2026");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL("**/app");
    await expect(page.getByText("Ingresos · MXN")).toBeVisible();
    await expectContrast(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}
