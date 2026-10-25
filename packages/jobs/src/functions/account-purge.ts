import { inngest } from "../client";
import { findAccountsDueForPurge, purgeAccount } from "../lib/account-purge";
import { avatarPrefix, deleteR2Prefix } from "../lib/r2";

/**
 * account/purge → anonimiza las cuentas cuya gracia de 30 días venció (ADR 0015).
 * Cron diario a las 03:00 de CDMX; también se puede disparar con el evento
 * `account/purge` desde el dashboard de Inngest. Cada cuenta es un step propio:
 * si una falla, las demás no se repiten al reintentar.
 */
export const accountPurge = inngest.createFunction(
  { id: "account-purge", name: "Cuentas: purge tras 30 días de gracia", retries: 3, concurrency: 1 },
  [{ cron: "TZ=America/Mexico_City 0 3 * * *" }, { event: "account/purge" }],
  async ({ step }) => {
    const due = await step.run("buscar-cuentas-vencidas", () => findAccountsDueForPurge(new Date()));
    const results = [];
    for (const nutritionistId of due) {
      const db = await step.run(`anonimizar-${nutritionistId}`, () => purgeAccount(nutritionistId));
      const r2 = db.purged
        ? await step.run(`borrar-avatar-${nutritionistId}`, () => deleteR2Prefix(avatarPrefix(nutritionistId)))
        : null;
      results.push({ db, r2 });
    }
    return { checked: due.length, results };
  },
);
