import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { z } from "zod";

import { errorBody } from "./errors";

/**
 * `zValidator` con el error uniforme `{ error: { code: "validation_error", message } }`.
 * El mensaje junta los issues como `campo: mensaje`.
 */
export function validate<Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues
        .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
        .join("; ");
      return c.json(errorBody("validation_error", message || "Solicitud inválida"), 400);
    }
  });
}
