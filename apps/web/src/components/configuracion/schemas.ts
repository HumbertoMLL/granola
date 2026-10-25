import { z } from "zod";

export const accountSchema = z.object({ name: z.string().trim().min(2, "Escribe al menos 2 caracteres").max(60) });
export const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Escribe tu contraseña actual"),
  newPassword: z.string().min(8, "Usa al menos 8 caracteres").max(128),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { message: "Las contraseñas no coinciden", path: ["confirmPassword"] });
export const deleteAccountSchema = z.object({ confirmation: z.literal("ELIMINAR", { error: "Escribe ELIMINAR para confirmar" }) });
export const notificationSchema = z.object({ notifyNewBooking: z.boolean() });
