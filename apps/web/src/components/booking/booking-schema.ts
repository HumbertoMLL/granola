import { z } from "zod";

/** Validación del formulario público de reserva (cliente y server action). */
export const bookingSchema = z.object({
  slug: z.string().min(1).max(60),
  serviceId: z.uuid(),
  startsAt: z.iso.datetime(),
  modality: z.enum(["online", "presencial"]),
  name: z.string().trim().min(2, "Escribe tu nombre completo").max(120),
  dialCode: z.string().regex(/^\d{1,4}$/),
  phone: z.string().trim().min(6, "Escribe tu WhatsApp").max(25),
  email: z.union([z.literal(""), z.email("Correo inválido")]).optional(),
  consent: z.literal(true, { error: "Necesitamos tu consentimiento para agendar" }),
  /** Zona del paciente; solo para mensajes (no se guarda, no hay columna). */
  timezone: z.string().max(64).optional(),
  paymentMethod: z.enum(["card", "spei", "oxxo"]).optional(),
});

export type BookingInput = z.input<typeof bookingSchema>;
