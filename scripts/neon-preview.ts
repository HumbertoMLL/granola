import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const branchSchema = z.object({
  id: z.string().startsWith("br-"),
  name: z.string(),
  parent_id: z.string().nullish(),
  default: z.boolean().optional(),
});
const branchesSchema = z.object({
  branches: z.array(branchSchema),
  pagination: z.object({ next: z.string().optional().nullable() }).optional(),
});
type Branch = z.infer<typeof branchSchema>;
type Fetch = typeof fetch;

export class NeonApi {
  constructor(
    private projectId: string,
    private key: string,
    private request: Fetch = fetch,
    private pause = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {}

  async call(
    endpoint: string,
    method = "GET",
    body?: unknown,
  ): Promise<unknown> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const response = await this.request(
        `https://console.neon.tech/api/v2/projects/${encodeURIComponent(this.projectId)}${endpoint}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${this.key}`,
            "Content-Type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      // Crear/borrar nunca se reintenta automáticamente; GET tolera el arranque del compute.
      if (
        method === "GET" &&
        [409, 423, 429, 500, 502, 503, 504].includes(response.status) &&
        attempt < 5
      ) {
        await this.pause(2000 * (attempt + 1));
        continue;
      }
      // Nunca imprimir respuestas crudas: pueden contener credenciales o datos.
      if (!response.ok)
        throw new Error(
          `Neon ${method} ${endpoint.split("?")[0]}: HTTP ${response.status}`,
        );
      return response.status === 204 ? null : response.json();
    }
    throw new Error("Neon no quedó disponible a tiempo.");
  }

  async branches(): Promise<Branch[]> {
    const result: Branch[] = [];
    let cursor: string | undefined;
    do {
      const query = new URLSearchParams({
        limit: "100",
        ...(cursor ? { cursor } : {}),
      });
      const page = branchesSchema.parse(await this.call(`/branches?${query}`));
      result.push(...page.branches);
      cursor = page.pagination?.next ?? undefined;
    } while (cursor);
    return result;
  }
}

export async function preparePreview(
  api: NeonApi,
  prNumber: number,
  parentName = "production",
  databaseName = "neondb",
) {
  const branches = await api.branches();
  const parent = branches.find((branch) => branch.name === parentName);
  if (!parent)
    throw new Error(
      `No existe el branch padre ${parentName}. Configura NEON_PARENT_BRANCH si producción tiene otro nombre.`,
    );
  const name = `pr-${z.number().int().positive().parse(prNumber)}`;
  let branch = branches.find((branch) => branch.name === name);
  if (branch && (branch.parent_id !== parent.id || branch.default))
    throw new Error("El branch existente no es un preview del padre esperado.");
  if (!branch) {
    const result = z.object({ branch: branchSchema }).parse(
      await api.call("/branches", "POST", {
        branch: {
          name,
          parent_id: parent.id,
          expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        },
        endpoints: [{ type: "read_write" }],
      }),
    );
    branch = result.branch;
  }
  if (
    branch.name !== name ||
    branch.parent_id !== parent.id ||
    branch.default
  ) {
    throw new Error(
      "Neon no devolvió el preview solicitado; no se migra ese branch.",
    );
  }
  const databases = z
    .object({
      databases: z.array(
        z.object({ name: z.string(), owner_name: z.string() }),
      ),
    })
    .parse(
      await api.call(`/branches/${encodeURIComponent(branch.id)}/databases`),
    );
  const database = databases.databases.find(
    (database) => database.name === databaseName,
  );
  if (!database)
    throw new Error(
      `No existe la base ${databaseName} en el preview. Configura NEON_DATABASE_NAME.`,
    );
  const query = new URLSearchParams({
    branch_id: branch.id,
    database_name: database.name,
    role_name: database.owner_name,
    pooled: "false",
  });
  const connection = z
    .object({ uri: z.url().refine((value) => !/[\r\n]/.test(value)) })
    .parse(await api.call(`/connection_uri?${query}`));
  const url = new URL(connection.uri);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname.endsWith(".neon.tech") ||
    url.hostname.includes("-pooler")
  )
    throw new Error("Neon debe devolver una conexión directa válida.");
  return { branchId: branch.id, databaseUrl: connection.uri };
}

export async function deletePreview(api: NeonApi, prNumber: number) {
  const name = `pr-${z.number().int().positive().parse(prNumber)}`;
  const branch = (await api.branches()).find((branch) => branch.name === name);
  if (!branch) return;
  if (branch.default || !branch.parent_id)
    throw new Error("Me niego a borrar un branch raíz o predeterminado.");
  await api.call(`/branches/${encodeURIComponent(branch.id)}`, "DELETE");
}

async function main() {
  const env = z
    .object({
      NEON_API_KEY: z.string().min(1),
      NEON_PROJECT_ID: z.string().min(1),
      GITHUB_EVENT_PATH: z.string().min(1),
    })
    .parse(process.env);
  const event = z
    .object({ number: z.number().int().positive(), action: z.string() })
    .parse(JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")));
  const api = new NeonApi(env.NEON_PROJECT_ID, env.NEON_API_KEY);
  const closed =
    process.env.PREVIEW_CLOSED === undefined
      ? event.action === "closed"
      : z.enum(["true", "false"]).parse(process.env.PREVIEW_CLOSED) === "true";
  if (closed) {
    await deletePreview(api, event.number);
    console.log(`Preview pr-${event.number} eliminado (o ya inexistente).`);
    return;
  }
  const preview = await preparePreview(
    api,
    event.number,
    process.env.NEON_PARENT_BRANCH || "production",
    process.env.NEON_DATABASE_NAME || "neondb",
  );
  if (!process.env.GITHUB_ENV || !process.env.GITHUB_OUTPUT)
    throw new Error("Este comando requiere un runner de GitHub Actions.");
  console.log(`::add-mask::${preview.databaseUrl}`);
  appendFileSync(
    process.env.GITHUB_ENV,
    `DATABASE_URL=${preview.databaseUrl}\n`,
  );
  const consoleUrl = `https://console.neon.tech/app/projects/${encodeURIComponent(env.NEON_PROJECT_ID)}/branches/${encodeURIComponent(preview.branchId)}`;
  appendFileSync(process.env.GITHUB_OUTPUT, `console_url=${consoleUrl}\n`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    // Zod no incluye el payload recibido en este mensaje.
    console.error(
      error instanceof Error
        ? error.message
        : "Falló el ciclo de vida del preview Neon.",
    );
    process.exitCode = 1;
  });
}
