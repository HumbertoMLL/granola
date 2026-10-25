import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = fileURLToPath(new URL(".", import.meta.url));
import { writeFile } from "node:fs/promises";

test("InBody: subir, personalizar, generar y enviar en móvil", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login?next=/app/pacientes");
  await page.getByLabel("Correo").fill("karla@granola.demo");
  await page.getByLabel("Contraseña").fill("granola-demo-2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/app\/pacientes/);
  await page.getByLabel("Buscar por nombre o WhatsApp").fill("Luis Pérez");
  await page.getByRole("link", { name: "Ver expediente", exact: true }).click();
  await page.getByRole("tab", { name: "Documentos", exact: true }).click();
  await expect(page.getByText("Aún no hay documentos")).toBeVisible();
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page
    .getByRole("button", { name: "Subir documento", exact: true })
    .click();
  const upload = page.getByRole("dialog", {
    name: "Subir estudio",
    exact: true,
  });
  await upload
    .getByLabel("Archivo del estudio")
    .setInputFiles(path.join(here, "fixtures/inbody.pdf"));
  await upload.screenshot({
    path: "../../docs/inbody-captures/01-subida.png",
    animations: "disabled",
  });
  await upload
    .getByRole("button", { name: "Subir y extraer datos", exact: true })
    .click();
  await expect(
    page.getByText("Datos extraídos · por revisar", { exact: true }),
  ).toBeVisible({ timeout: 90_000 });
  await page.screenshot({
    path: "../../docs/inbody-captures/02-documentos.png",
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Revisar y personalizar", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Personalizar reporte",
    exact: true,
  });
  await editor
    .getByLabel("Comentario de Peso", { exact: true })
    .fill(
      "Revisado en consulta. Continuaremos el seguimiento de tu evolución.",
    );
  await editor.getByLabel("Mostrar Masa grasa", { exact: true }).uncheck();
  await editor
    .getByLabel("Mi interpretación", { exact: true })
    .fill(
      "Estudio ficticio revisado. Compararemos los siguientes resultados en consulta.",
    );
  await editor.getByLabel("Color de mi reporte").fill("#6b4fd8");
  await editor
    .getByLabel("Comentario de Peso", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "../../docs/inbody-captures/03-personalizacion.png",
    animations: "disabled",
  });
  await editor
    .getByRole("button", { name: "Guardar y ver vista previa", exact: true })
    .click();
  await expect(
    editor.getByRole("region", { name: "Vista previa del reporte" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../docs/inbody-captures/04-vista-previa.png",
    animations: "disabled",
  });
  await editor
    .getByRole("button", { name: "Generar PDF", exact: true })
    .click();
  await expect(
    editor.getByRole("heading", { name: "Enviar al paciente", exact: true }),
  ).toBeVisible({ timeout: 90_000 });
  const href = await editor
    .getByRole("link", { name: "Abrir PDF generado" })
    .getAttribute("href");
  const pdf = await context.request.get(href!);
  expect(pdf.ok()).toBe(true);
  const body = await pdf.body();
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  await writeFile(
    path.resolve(here, "../../../..", "inbody-reporte-qa.pdf"),
    body,
  );
  await editor
    .getByRole("button", { name: "Enviar al paciente", exact: true })
    .click();
  await expect(editor.getByRole("status")).toHaveText(
    "Modo de prueba: envío registrado, sin mensaje real.",
  );
  await page.screenshot({
    path: "../../docs/inbody-captures/05-envio.png",
    animations: "disabled",
  });
});
