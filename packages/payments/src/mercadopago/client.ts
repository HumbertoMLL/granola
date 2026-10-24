import { MercadoPagoConfig, Payment } from "mercadopago";

import { requireEnv } from "../env";

let _config: MercadoPagoConfig | undefined;

/**
 * MVP: una sola cuenta de Mercado Pago (la de Granola, `MP_ACCESS_TOKEN`).
 * El dinero de SPEI/OXXO entra a Granola y se liquida al nutri fuera de banda.
 * F1.5: marketplace OAuth (cada nutri autoriza su cuenta → `nutritionists.mp_user_id`)
 * y el pago se crea con el access token del nutri + `application_fee: 0`.
 */
export function getMercadoPago(): MercadoPagoConfig {
  if (_config) return _config;
  _config = new MercadoPagoConfig({
    accessToken: requireEnv("mercadopago", "MP_ACCESS_TOKEN"),
    options: { timeout: 10_000 },
  });
  return _config;
}

export function getMpPayments(): Payment {
  return new Payment(getMercadoPago());
}
