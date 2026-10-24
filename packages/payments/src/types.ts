/**
 * CONTRATO: el flujo de reserva (booking) llama createCheckout() y redirige al
 * `url` devuelto. Los webhooks (stripe/mercadopago) marcan el pago y emiten
 * `appointment/confirmed`. Implementación en ./stripe y ./mercadopago.
 */
export type CheckoutProvider = "stripe" | "mercadopago";
export type CheckoutMethod = "card" | "spei" | "oxxo";

export type CreateCheckoutInput = {
  appointmentId: string;
  nutritionistId: string;
  amountCents: number;
  currency: "MXN";
  method: CheckoutMethod;
  description: string;
  payer: { name: string; email?: string; phone?: string };
  /** A dónde vuelve el paciente tras pagar / cancelar. */
  successUrl: string;
  cancelUrl: string;
};

export type CreateCheckoutResult = {
  provider: CheckoutProvider;
  paymentId: string;
  url: string;
  /** Para OXXO/SPEI: hasta cuándo se puede pagar. */
  expiresAt?: Date;
};
