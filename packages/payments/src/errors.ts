/**
 * Se lanza cuando falta una variable de entorno de pagos (STRIPE_SECRET_KEY,
 * MP_ACCESS_TOKEN, …). El código compila y el panel carga sin keys; solo las
 * operaciones que hablan con el proveedor fallan, con mensaje claro.
 */
export class PaymentsNotConfiguredError extends Error {
  readonly provider: "stripe" | "mercadopago";
  readonly envVar: string;

  constructor(provider: "stripe" | "mercadopago", envVar: string) {
    super(
      `${provider === "stripe" ? "Stripe" : "Mercado Pago"} no está configurado: falta ${envVar}. ` +
        "Copia .env.example a apps/web/.env.local y pega la credencial.",
    );
    this.name = "PaymentsNotConfiguredError";
    this.provider = provider;
    this.envVar = envVar;
  }
}

/** Firma de webhook inválida o ausente. El route handler responde 400. */
export class WebhookSignatureError extends Error {
  constructor(provider: "stripe" | "mercadopago", reason: string) {
    super(`Firma de webhook de ${provider} inválida: ${reason}`);
    this.name = "WebhookSignatureError";
  }
}

/** Datos de negocio inconsistentes (cita sin nutri conectado, pago inexistente, etc.). */
export class PaymentsError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PaymentsError";
    this.code = code;
  }
}
