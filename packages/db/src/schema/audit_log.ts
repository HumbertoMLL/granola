import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Bitácora de accesos a datos sensibles (LFPDPPP). Solo inserts, nunca updates.
// actor_id es texto libre (uuid de user, "system", "webhook:stripe"…) para no
// bloquear el log cuando el actor no es un usuario.
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").notNull(),
    /** p. ej. patient.read, patient.export, appointment.cancel */
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    ip: text("ip"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_entity_entity_id_idx").on(t.entity, t.entityId),
    index("audit_log_actor_id_at_idx").on(t.actorId, t.at),
  ],
);
