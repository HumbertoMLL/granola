# @granola/payments

Stripe Connect (tarjeta) + Mercado Pago (SPEI/OXXO) + efectivo. Ver PLAN.md §2 (filas de pagos), §5 y §7.

```
src/
  index.ts          createCheckout() (contrato) + re-exports
  types.ts          CreateCheckoutInput / Result
  status.ts         mapeo puro proveedor → payments.status + idempotencia (tests)
  transitions.ts    applyPaymentTransition(providerRef, next): UPDATE idempotente + confirmar cita
  cash.ts           markCashPaid() — "Marcar pagado en efectivo"
  queries.ts        listas y totales para /app/cobros (siempre por nutritionist_id)
  stripe/           client, connect (Express), checkout (destination charge), webhook
  mercadopago/      client, checkout (pago directo clabe/oxxo), signature (x-signature), webhook, instructions
```

Sin `STRIPE_SECRET_KEY` / `MP_ACCESS_TOKEN` todo compila y el panel carga; las llamadas al proveedor lanzan
`PaymentsNotConfiguredError` con mensaje claro.

## Flujo

1. Booking llama `createCheckout({ method: "card" | "spei" | "oxxo", … })`.
2. Se inserta `payments` (`pending`) → se crea la sesión/pago en el proveedor → se guarda `providerRef`
   (session.id / id de pago MP) **antes** de devolver `url`.
3. El paciente paga. El webhook verifica firma, llama `applyPaymentTransition(providerRef, next)`:
   `UPDATE payments … WHERE provider_ref = $1 AND status <> $next RETURNING` → si no devuelve fila ya se
   procesó (regla dura #3). Si `next === "paid"` confirma la cita (`pending_payment → confirmed`) y el route
   emite `appointment/confirmed`.

## Decisiones

**Destination charges, no direct charges.** `payment_intent_data.transfer_data.destination = acct_nutri`,
`application_fee_amount: 0`, `on_behalf_of = acct_nutri`. Un solo webhook y secret (plataforma), reembolsos
y disputas desde Granola, y el nutri sigue siendo merchant of record y absorbe la comisión de Stripe.
Direct charges (header `Stripe-Account`) daría lo mismo económicamente pero exige webhooks Connect por
cuenta y pasar `stripeAccount` en cada lectura.

**Express, no Standard/Custom.** Onboarding y dashboard hospedados por Stripe; Granola guarda solo `acct_…`.

**Expiraciones.** Tarjeta 1 h (sesión de Checkout). SPEI 24 h (transferencia inmediata; libera el slot
pronto). OXXO 48 h (hay que ir a la tienda; 24 h deja fuera a quien agenda de noche). Las expiraciones
se guardan como `expired` (el enum lo tiene) y los rechazos como `failed`, para que el nutri distinga.

**MP pago directo (`/v1/payments`), no Checkout Pro.** Queremos la CLABE/referencia en nuestra página y
mandarla por WhatsApp. `payment_method_id` = `clabe` (SPEI) u `oxxo`. `external_reference` = paymentId,
`notification_url` = `/api/webhooks/mercadopago`. OXXO devuelve el `ticket_url` de MP; SPEI devuelve
`/pago/[paymentId]` (página propia con la CLABE).

**MP exige `payer.email`.** Si el paciente solo dejó WhatsApp, se genera `${digitos}@sin-correo.granola.app`
(dominio nuestro para que cualquier correo de MP rebote donde controlamos).

**MP con la cuenta de Granola (MVP).** `MP_ACCESS_TOKEN` único; el dinero entra a Granola y se liquida al
nutri fuera de banda. F1.5: marketplace OAuth → `nutritionists.mp_user_id`, pago creado con el token del
nutri y `application_fee: 0`.

**Firma de MP** se valida a mano (`mercadopago/signature.ts`, HMAC-SHA256 del manifest
`id:…;request-id:…;ts:…;`) para testearla con fixtures y no depender de internals del SDK. Tolerancia 5 min.

**El webhook de MP no trae estado**: siempre se hace `GET /v1/payments/{id}` (así nadie puede inyectar un
`approved`).

## Columnas que faltan en el schema (no se tocó `packages/db`)

- `payments.provider_data jsonb` — guardar CLABE/referencia/ticket_url de MP (hoy `/pago/[id]` consulta
  a la API de MP en cada carga) y el `payment_intent` de Stripe.
- `nutritionists.stripe_charges_enabled boolean`, `stripe_payouts_enabled boolean`,
  `stripe_requirements jsonb` — persistir lo que llega en `account.updated` (hoy el panel llama a
  `accounts.retrieve` en cada render y el webhook solo loggea).
- Opcional: `payments.failure_reason text` (status_detail de MP / last_payment_error de Stripe).

## Qué configurar

**Stripe (dashboard → Connect):** activar Connect, tipo Express, país MX, branding. Webhook de la cuenta
plataforma en `https://<dominio>/api/webhooks/stripe` con `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
`checkout.session.expired`; y en el listener "Connected accounts" `account.updated`. Copiar el signing
secret a `STRIPE_WEBHOOK_SECRET`. Return/refresh URLs: `/api/connect/stripe/return` y `/refresh`
(se generan desde `NEXT_PUBLIC_APP_URL`).

**Mercado Pago (Tus integraciones → crear app "Granola", modelo Pagos online → Checkout API):** copiar
`Access Token` de producción a `MP_ACCESS_TOKEN`; en Webhooks dar de alta
`https://<dominio>/api/webhooks/mercadopago` con el evento **Pagos** y copiar la clave secreta a
`MP_WEBHOOK_SECRET`. En la cuenta hay que tener habilitados SPEI (`clabe`) y OXXO como medios de pago.

## Tests

```bash
pnpm --filter @granola/payments test
```

Cubren el mapeo de estados (Stripe y MP), la idempotencia, la firma `x-signature` de MP con fixtures y la
firma `Stripe-Signature` (payload firmado, secret erróneo, tampering, replay).
