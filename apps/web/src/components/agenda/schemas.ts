import { z } from "zod";

import { parseTimeToMinutes } from "@granola/core/scheduling";

/** Schemas zod compartidos por formularios (cliente) y server actions de la agenda. */

export const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(80, "Máximo 80 caracteres"),
  description: z.string().trim().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
  durationMin: z.coerce.number().int("Debe ser entero").min(10, "Mínimo 10 min").max(480, "Máximo 8 horas"),
  /** En pesos; se guarda en centavos. */
  priceMxn: z.coerce.number().min(0, "No puede ser negativo").max(100_000, "Demasiado alto"),
  modality: z.enum(["online", "presencial", "ambas"]),
  location: z.string().trim().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  paymentMode: z.enum(["prepaid", "at_visit", "optional"]),
  isActive: z.coerce.boolean(),
});

export type ServiceInput = z.input<typeof serviceSchema>;

export const ruleSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRe, "Hora inválida"),
    endTime: z.string().regex(timeRe, "Hora inválida"),
  })
  .refine((r) => parseTimeToMinutes(r.endTime) > parseTimeToMinutes(r.startTime), {
    message: "La hora de fin debe ser mayor que la de inicio",
    path: ["endTime"],
  });

export type RuleInput = z.infer<typeof ruleSchema>;

export const overrideSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    startTime: z.string().regex(timeRe, "Hora inválida").nullable(),
    endTime: z.string().regex(timeRe, "Hora inválida").nullable(),
    isBlocked: z.boolean(),
  })
  .refine((o) => (o.startTime === null) === (o.endTime === null), {
    message: "Indica inicio y fin, o ninguno para el día completo",
    path: ["endTime"],
  })
  .refine((o) => o.isBlocked || (o.startTime !== null && o.endTime !== null), {
    message: "Una ventana extra necesita horario",
    path: ["startTime"],
  })
  .refine(
    (o) => o.startTime === null || o.endTime === null || parseTimeToMinutes(o.endTime) > parseTimeToMinutes(o.startTime),
    { message: "La hora de fin debe ser mayor que la de inicio", path: ["endTime"] },
  );

export type OverrideInput = z.infer<typeof overrideSchema>;
