import { test } from "node:test";
import assert from "node:assert/strict";
import { NeonApi, deletePreview, preparePreview } from "./neon-preview.ts";

const parent = { id: "br-production", name: "production", default: true };
const preview = { id: "br-preview", name: "pr-42", parent_id: parent.id };
const connection =
  "postgresql://user:fake@ep-test.us-east-1.aws.neon.tech/neondb?sslmode=require";
function fixture(responses: { body?: unknown; status?: number }[]) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const request: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
    });
    const response = responses.shift();
    assert.ok(response, "Petición HTTP inesperada");
    return response.status === 204
      ? new Response(null, { status: 204 })
      : Response.json(response.body ?? {}, { status: response.status ?? 200 });
  };
  return {
    calls,
    api: new NeonApi("project", "fake-key", request, async () => {}),
  };
}
const databases = { databases: [{ name: "neondb", owner_name: "owner" }] };

test("crea pr-42 desde production con compute y TTL, y solicita una URL directa", async () => {
  const { api, calls } = fixture([
    { body: { branches: [parent] } },
    { body: { branch: preview } },
    { body: databases },
    { body: { uri: connection } },
  ]);
  assert.equal((await preparePreview(api, 42)).databaseUrl, connection);
  const creation = calls.find((call) => call.method === "POST")?.body as {
    branch: { name: string; parent_id: string; expires_at: string };
    endpoints: { type: string }[];
  };
  assert.equal(creation.branch.name, "pr-42");
  assert.equal(creation.branch.parent_id, parent.id);
  assert.ok(new Date(creation.branch.expires_at).getTime() > Date.now());
  assert.deepEqual(creation.endpoints, [{ type: "read_write" }]);
  assert.match(calls.at(-1)!.url, /pooled=false/);
});
test("reutiliza el branch sin crearlo otra vez y soporta paginación", async () => {
  const { api, calls } = fixture([
    { body: { branches: [parent], pagination: { next: "next" } } },
    { body: { branches: [preview] } },
    { body: databases },
    { body: { uri: connection } },
  ]);
  assert.equal((await preparePreview(api, 42)).branchId, preview.id);
  assert.equal(calls.filter((call) => call.method === "POST").length, 0);
  assert.match(calls[1]!.url, /cursor=next/);
});
test("no migra un pr de otro padre ni sustituye producción por un branch cualquiera", async () => {
  const wrongParent = fixture([
    { body: { branches: [parent, { ...preview, parent_id: "br-other" }] } },
  ]);
  await assert.rejects(preparePreview(wrongParent.api, 42), /padre esperado/);
  await assert.rejects(
    preparePreview(fixture([{ body: { branches: [] } }]).api, 42),
    /No existe el branch padre/,
  );
});
test("cierra solo el preview exacto; cierre repetido no falla", async () => {
  const { api, calls } = fixture([
    {
      body: {
        branches: [
          parent,
          preview,
          { ...preview, name: "pr-420", id: "br-other" },
        ],
      },
    },
    { status: 204 },
  ]);
  await deletePreview(api, 42);
  assert.equal(
    calls.at(-1)!.url,
    "https://console.neon.tech/api/v2/projects/project/branches/br-preview",
  );
  assert.equal(calls.at(-1)!.method, "DELETE");
  await deletePreview(fixture([{ body: { branches: [] } }]).api, 42);
});
test("se niega a borrar un branch raíz o predeterminado", async () => {
  await assert.rejects(
    deletePreview(
      fixture([{ body: { branches: [{ ...preview, default: true }] } }]).api,
      42,
    ),
    /Me niego/,
  );
  await assert.rejects(
    deletePreview(
      fixture([{ body: { branches: [{ id: "br-root", name: "pr-42" }] } }]).api,
      42,
    ),
    /Me niego/,
  );
});
test("tolera arranque temporal de Neon; errores HTTP no filtran el cuerpo ni la key", async () => {
  const { api } = fixture([{ status: 503 }, { body: { branches: [parent] } }]);
  assert.equal((await api.branches()).length, 1);
  await assert.rejects(
    fixture([
      { status: 401, body: { password: "never-print" } },
    ]).api.branches(),
    (error) => {
      assert.equal((error as Error).message, "Neon GET /branches: HTTP 401");
      return true;
    },
  );
});
test("rechaza conexiones al pooler o fuera de Neon", async () => {
  for (const uri of [
    connection.replace("ep-test.", "ep-test-pooler."),
    connection.replace("aws.neon.tech", "example.com"),
  ]) {
    const { api } = fixture([
      { body: { branches: [parent, preview] } },
      { body: databases },
      { body: { uri } },
    ]);
    await assert.rejects(preparePreview(api, 42), /conexión directa/);
  }
});

test("no migra producción si una respuesta de creación devuelve otro branch", async () => {
  const { api } = fixture([
    { body: { branches: [parent] } },
    { body: { branch: parent } },
  ]);
  await assert.rejects(preparePreview(api, 42), /no se migra/);
});
