import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, Clock, Landmark, Store } from "lucide-react";

import { Badge, Button, Card, Skeleton } from "@granola/ui";
import { getMpInstructionsForPayment, PaymentsNotConfiguredError } from "@granola/payments";

import { CopyButton } from "@/components/cobros/copy-button";
import { formatMoney } from "@/components/cobros/format";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Instrucciones de pago",
  robots: { index: false, follow: false },
};

/**
 * Página pública que el paciente abre tras elegir SPEI (y como respaldo para
 * OXXO). Sin sesión: el `paymentId` (uuid) actúa como capability token. Solo
 * muestra datos del pago, nunca del expediente.
 *
 * Los datos (CLABE, banco, referencia, ficha) salen de `payments.provider_data`,
 * guardado al crear el cobro. Solo si está vacío (pagos anteriores a la
 * migración 0001) `getMpInstructionsForPayment` consulta a MP y lo rellena.
 */
export default function PagoPage({ params }: { params: Promise<{ paymentId: string }> }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex justify-center">
        <Logo size={32} />
      </div>
      <Suspense fallback={<Skeleton className="h-80" />}>
        <PagoContent params={params} />
      </Suspense>
    </main>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function PagoContent({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  if (!UUID_RE.test(paymentId)) notFound();

  let result: Awaited<ReturnType<typeof getMpInstructionsForPayment>>;
  try {
    result = await getMpInstructionsForPayment(paymentId);
  } catch (err) {
    if (err instanceof PaymentsNotConfiguredError) {
      return <ErrorCard text="Los pagos por SPEI/OXXO no están disponibles en este momento." />;
    }
    console.error("[pago]", err);
    return <ErrorCard text="No pudimos cargar las instrucciones. Intenta de nuevo en un momento." />;
  }
  if (!result.ok) notFound();

  const { payment, instructions } = result;
  const amount = formatMoney(payment.amountCents, payment.currency);

  if (payment.status === "paid") {
    return (
      <Card className="items-center gap-3 text-center">
        <CheckCircle2 className="size-10 text-primary" />
        <h1 className="text-xl font-extrabold tracking-tight">Pago recibido</h1>
        <p className="text-sm text-muted-foreground">
          Recibimos tu pago de {amount}. Tu cita está confirmada; te llega la confirmación por WhatsApp.
        </p>
      </Card>
    );
  }

  if (payment.status === "expired" || payment.status === "failed") {
    return (
      <Card className="items-center gap-3 text-center">
        <Clock className="size-10 text-muted-foreground" />
        <h1 className="text-xl font-extrabold tracking-tight">
          {payment.status === "expired" ? "Esta referencia venció" : "El pago no se pudo completar"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Vuelve a la página de tu nutriólogo/a y agenda de nuevo para generar una referencia nueva.
        </p>
      </Card>
    );
  }

  if (!instructions) {
    return <ErrorCard text="No encontramos los datos de este pago. Escríbele a tu nutriólogo/a." />;
  }

  const expires = instructions.expiresAt ?? payment.expiresAt;
  const expiresLabel = expires
    ? new Intl.DateTimeFormat("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Mexico_City",
      }).format(expires)
    : null;

  return (
    <Card className="gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-[#8a5a0b]">
          {instructions.method === "spei" ? <Landmark className="size-5" /> : <Store className="size-5" />}
        </div>
        <Badge variant="accent">Pendiente de pago</Badge>
      </div>

      <div>
        <h1 className="text-xl font-extrabold tracking-tight">
          {instructions.method === "spei" ? "Paga por transferencia SPEI" : "Paga en OXXO"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu cita queda confirmada en cuanto se acredite el pago. Te avisamos por WhatsApp.
        </p>
      </div>

      <Field label="Monto exacto" value={amount} copy={String(payment.amountCents / 100)} />

      {instructions.method === "spei" ? (
        <>
          {instructions.clabe ? <Field label="CLABE" value={instructions.clabe} copy={instructions.clabe} mono /> : null}
          {instructions.bankName ? <Field label="Banco" value={instructions.bankName} /> : null}
          <Field label="Beneficiario" value="Granola" />
          <p className="text-xs text-muted-foreground">
            Desde la app de tu banco: transferencia SPEI a la CLABE de arriba, por el monto exacto. Se acredita en
            minutos. Si tu banco pide concepto, pon tu nombre.
          </p>
        </>
      ) : (
        <>
          {instructions.reference ? (
            <Field label="Referencia" value={instructions.reference} copy={instructions.reference} mono />
          ) : null}
          <p className="text-xs text-muted-foreground">
            En caja di que vas a pagar un servicio de Mercado Pago, muestra la referencia o el código de barras y
            paga el monto exacto. OXXO cobra una comisión de $15 MXN; el pago se acredita en 1–2 horas hábiles.
          </p>
        </>
      )}

      {expiresLabel ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4" /> Vence el {expiresLabel}
        </p>
      ) : null}

      {instructions.ticketUrl ? (
        <Button asChild variant={instructions.method === "oxxo" ? "primary" : "outline"}>
          <a href={instructions.ticketUrl} target="_blank" rel="noreferrer">
            {instructions.method === "oxxo" ? "Ver ficha de pago con código de barras" : "Ver comprobante en Mercado Pago"}
          </a>
        </Button>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">Pagos procesados por Mercado Pago.</p>
    </Card>
  );
}

function Field({ label, value, copy, mono }: { label: string; value: string; copy?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
        <p className={mono ? "font-mono text-base tracking-wide break-all" : "font-semibold"}>{value}</p>
      </div>
      {copy ? <CopyButton value={copy} /> : null}
    </div>
  );
}

function ErrorCard({ text }: { text: string }) {
  return (
    <Card className="items-center gap-2 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </Card>
  );
}
