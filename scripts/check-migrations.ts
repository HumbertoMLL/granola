import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

const journalSchema = z.object({
  entries: z.array(
    z
      .object({
        idx: z.number().int().nonnegative(),
        when: z.number().int(),
        tag: z.string().regex(/^\d+_[\w-]+$/),
      })
      .passthrough(),
  ),
});
type Entry = z.infer<typeof journalSchema>["entries"][number];
const migrationRoot = "packages/db/migrations";
const journalPath = `${migrationRoot}/meta/_journal.json`;

export function validateHistory(
  previous: Entry[],
  current: Entry[],
  newSqlFiles: Set<string>,
  schemaChanged: boolean,
) {
  if (!isDeepStrictEqual(current.slice(0, previous.length), previous)) {
    throw new Error(
      "No modifiques ni borres entradas de migraciones existentes.",
    );
  }
  const tags = new Set<string>();
  current.forEach((entry, index) => {
    if (
      entry.idx !== index ||
      tags.has(entry.tag) ||
      (index > 0 && entry.when <= current[index - 1]!.when)
    ) {
      throw new Error(
        "El journal debe tener índices consecutivos, tags únicos y timestamps crecientes.",
      );
    }
    tags.add(entry.tag);
  });
  const added = current.slice(previous.length);
  if (schemaChanged && added.length === 0) {
    throw new Error(
      "Cambió packages/db/src/schema sin una migración nueva. Ejecuta pnpm db:generate y revisa el SQL.",
    );
  }
  if (
    added.some(
      (entry) => !newSqlFiles.has(`${migrationRoot}/${entry.tag}.sql`),
    ) ||
    added.length !== newSqlFiles.size
  ) {
    throw new Error(
      "Cada migración nueva necesita su SQL nuevo y una entrada nueva en el journal.",
    );
  }
}

/** El orden de claves JSON y los UUID de snapshots no representan cambios DDL. */
export function schemaState(value: unknown) {
  const object = z
    .record(z.string(), z.unknown())
    .parse(JSON.parse(JSON.stringify(value)) as unknown);
  return Object.fromEntries(
    Object.entries(object).filter(
      ([key]) => !["id", "prevId", "_meta", "internal"].includes(key),
    ),
  );
}

export async function checkMigrations(root: string, requestedBase?: string) {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const base = requestedBase
    ? /^0+$/.test(requestedBase)
      ? git("hash-object", "-t", "tree", "/dev/null")
      : git("rev-parse", "--verify", `${requestedBase}^{commit}`)
    : git("merge-base", "origin/main", "HEAD");
  const changed = git(
    "diff",
    "--name-only",
    "-z",
    base,
    "--",
    "packages/db/src/schema",
  )
    .split("\0")
    .filter(Boolean);
  const untracked = git(
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    "packages/db/src/schema",
  )
    .split("\0")
    .filter(Boolean);
  const baseline = git(
    "ls-tree",
    "-r",
    "--name-only",
    base,
    "--",
    migrationRoot,
  )
    .split("\n")
    .filter(Boolean);
  // Los snapshots y SQL ya publicados son inmutables; el journal solo puede crecer.
  for (const file of baseline.filter((file) => file !== journalPath)) {
    if (
      git("show", `${base}:${file}`) !==
      readFileSync(path.join(root, file), "utf8").trim()
    ) {
      throw new Error(`No edites migraciones existentes: ${file}`);
    }
  }
  const previous = baseline.includes(journalPath)
    ? journalSchema.parse(JSON.parse(git("show", `${base}:${journalPath}`)))
        .entries
    : [];
  const current = journalSchema.parse(
    JSON.parse(readFileSync(path.join(root, journalPath), "utf8")),
  ).entries;
  const files = git(
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    migrationRoot,
  )
    .split("\0")
    .filter(Boolean);
  const newSql = new Set(
    files.filter((file) => file.endsWith(".sql") && !baseline.includes(file)),
  );
  validateHistory(
    previous,
    current,
    newSql,
    changed.length + untracked.length > 0,
  );
  for (const entry of current) {
    if (
      !readFileSync(
        path.join(root, migrationRoot, `${entry.tag}.sql`),
        "utf8",
      ).trim()
    )
      throw new Error(`SQL vacío: ${entry.tag}`);
  }
  const latest = current.at(-1);
  if (!latest) throw new Error("Falta el snapshot de migraciones.");
  const snapshot = JSON.parse(
    readFileSync(
      path.join(
        root,
        migrationRoot,
        "meta",
        `${String(latest.idx).padStart(4, "0")}_snapshot.json`,
      ),
      "utf8",
    ),
  ) as unknown;
  const dbRequire = createRequire(path.join(root, "packages/db/package.json"));
  const { generateDrizzleJson } = dbRequire("drizzle-kit/api") as {
    generateDrizzleJson: (schema: Record<string, unknown>) => unknown;
  };
  const schema = (await import(
    pathToFileURL(path.join(root, "packages/db/src/schema/index.ts")).href
  )) as Record<string, unknown>;
  if (
    !isDeepStrictEqual(
      schemaState(snapshot),
      schemaState(generateDrizzleJson(schema)),
    )
  ) {
    throw new Error(
      "El schema no coincide con el último snapshot. Genera y revisa una migración nueva con pnpm db:generate.",
    );
  }
  execFileSync(
    "pnpm",
    ["--filter", "@granola/db", "exec", "drizzle-kit", "check"],
    { cwd: root, stdio: "inherit" },
  );
  console.log("Migraciones y schema coherentes (sin conectar a la DB).");
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  checkMigrations(
    path.resolve(path.dirname(scriptPath), ".."),
    process.env.MIGRATIONS_BASE_REF,
  ).catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Falló la revisión de migraciones.",
    );
    process.exitCode = 1;
  });
}
