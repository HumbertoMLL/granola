import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import {
  checkMigrations,
  schemaState,
  validateHistory,
} from "./check-migrations.ts";

const first = { idx: 0, when: 1, tag: "0000_init" };
const second = { idx: 1, when: 2, tag: "0001_add_column" };
const sql = "packages/db/migrations/0001_add_column.sql";

test("un cambio de schema sin migración falla aunque el journal sea válido", () => {
  assert.throws(
    () => validateHistory([first], [first], new Set(), true),
    /sin una migración nueva/,
  );
});
test("schema con SQL y journal nuevos pasa; un cambio ajeno al schema no exige migración", () => {
  validateHistory([first], [first, second], new Set([sql]), true);
  validateHistory([first], [first], new Set(), false);
});
test("un SQL suelto o un journal sin SQL no cuentan como migración", () => {
  assert.throws(
    () => validateHistory([first], [first, second], new Set(), true),
    /SQL nuevo/,
  );
  assert.throws(
    () => validateHistory([first], [first], new Set([sql]), false),
    /SQL nuevo/,
  );
});
test("no se pueden borrar ni reescribir migraciones ya publicadas", () => {
  assert.throws(
    () => validateHistory([first], [], new Set(), false),
    /No modifiques/,
  );
  assert.throws(
    () => validateHistory([first], [{ ...first, when: 9 }], new Set(), false),
    /No modifiques/,
  );
});
test("el journal rechaza timestamps repetidos, tags duplicados e índices con huecos", () => {
  for (const entry of [
    { ...second, when: 1 },
    { ...second, tag: first.tag },
    { ...second, idx: 3 },
  ]) {
    assert.throws(
      () => validateHistory([first], [first, entry], new Set([sql]), true),
      /journal/,
    );
  }
});
test("los UUID y orden JSON no importan; una columna sin reflejar en snapshot sí", () => {
  const stored = {
    id: "old",
    internal: {},
    tables: { table: { columns: { name: "text" } } },
    enums: {},
  };
  const generated = {
    enums: {},
    tables: { table: { columns: { name: "text" } } },
    id: "new",
  };
  assert.ok(isDeepStrictEqual(schemaState(stored), schemaState(generated)));
  assert.ok(
    !isDeepStrictEqual(
      schemaState(stored),
      schemaState({ ...generated, tables: {} }),
    ),
  );
});

test("el guard real detecta cambios unstaged, staged y nuevos con Git", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "granola-migration-guard-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  try {
    mkdirSync(path.join(root, "packages/db/src/schema"), { recursive: true });
    mkdirSync(path.join(root, "packages/db/migrations/meta"), {
      recursive: true,
    });
    const schemaFile = path.join(root, "packages/db/src/schema/index.ts");
    writeFileSync(schemaFile, "export const fixture = 1;\n");
    writeFileSync(
      path.join(root, "packages/db/migrations/meta/_journal.json"),
      JSON.stringify({ entries: [] }),
    );
    git("init", "--quiet");
    git("add", ".");
    git(
      "-c",
      "user.name=Prueba",
      "-c",
      "user.email=prueba@example.test",
      "commit",
      "--quiet",
      "-m",
      "Base",
    );
    const base = git("rev-parse", "HEAD");
    writeFileSync(schemaFile, "export const fixture = 2;\n");
    await assert.rejects(
      checkMigrations(root, base),
      /sin una migración nueva/,
    );
    git("add", ".");
    await assert.rejects(
      checkMigrations(root, base),
      /sin una migración nueva/,
    );
    git("reset", "--quiet", "HEAD", "--", ".");
    writeFileSync(schemaFile, "export const fixture = 1;\n");
    writeFileSync(
      path.join(root, "packages/db/src/schema/extra.ts"),
      "export const fixture = 3;\n",
    );
    await assert.rejects(
      checkMigrations(root, base),
      /sin una migración nueva/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
