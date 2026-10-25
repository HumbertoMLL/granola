import { db, sql } from "./index";
/** Sin caché de proceso: expansión instalada antes de activar el uso. Compatible con rollback. */
export async function documentsReady(): Promise<boolean> {
  const result = await db.execute(sql`select to_regclass('public.documents') is not null and to_regclass('public.reports') is not null as ready`);
  return result.rows[0]?.ready === true;
}
