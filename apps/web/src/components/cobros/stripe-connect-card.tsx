"use client";

import { useActionState } from "react";
import { CreditCard, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge, Button, Card } from "@granola/ui";

import {
  connectStripeAction,
  openStripeDashboardAction,
  refreshStripeStatusAction,
  type ActionState,
} from "@/app/(panel)/app/cobros/actions";

/** Estado serializable que el server component lee de DB (flags de `nutritionists`). */
export type StripeCardState =
  | { kind: "not_configured" }
  | { kind: "disconnected" }
  | { kind: "error"; message: string }
  | {
      kind: "connected";
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      detailsSubmitted: boolean;
      currentlyDue: string[];
      pastDue: string[];
      disabledReason: string | null;
      /** ISO de la última sincronización con Stripe; null si nunca llegó. */
      syncedAt: string | null;
    };

const initial: ActionState = {};

/** Traducción aproximada de los `requirements` más comunes de Stripe. */
const REQUIREMENT_LABEL: Record<string, string> = {
  "external_account": "Cuenta bancaria (CLABE)",
  "individual.id_number": "RFC o CURP",
  "individual.verification.document": "Identificación oficial",
  "individual.address.line1": "Dirección",
  "individual.dob.day": "Fecha de nacimiento",
  "individual.phone": "Teléfono",
  "business_profile.url": "Sitio web o redes",
  "tos_acceptance.date": "Aceptar términos de Stripe",
};

function requirementLabel(key: string): string {
  if (REQUIREMENT_LABEL[key]) return REQUIREMENT_LABEL[key];
  const prefix = Object.keys(REQUIREMENT_LABEL).find((k) => key.startsWith(k.split(".")[0] ?? k));
  return prefix ? REQUIREMENT_LABEL[prefix] ?? key : key;
}

export function StripeConnectCard({ state, justReturned }: { state: StripeCardState; justReturned: boolean }) {
  const [connectState, connect, connecting] = useActionState(connectStripeAction, initial);
  const [dashState, openDashboard, opening] = useActionState(openStripeDashboardAction, initial);
  const [refreshState, refresh, refreshing] = useActionState(refreshStripeStatusAction, initial);
  const error = connectState.error ?? dashState.error ?? refreshState.error;

  return (
    <Card className="gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <CreditCard className="size-5" />
        </div>
        <StripeBadge state={state} />
      </div>

      <div>
        <p className="font-semibold">Tarjeta con Stripe</p>
        <p className="text-sm text-muted-foreground">
          El dinero llega directo a tu cuenta. Granola no cobra comisión; solo pagas la de Stripe
          (3.6% + $3 MXN por cobro).
        </p>
      </div>

      {justReturned && state.kind === "connected" && !state.chargesEnabled ? (
        <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-[#8a5a0b]">
          Stripe está revisando tus datos. Suele tardar unos minutos; da clic en «Actualizar estado».
        </p>
      ) : null}

      {state.kind === "connected" && (state.currentlyDue.length > 0 || state.pastDue.length > 0) ? (
        <div className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm">
          <p className="font-medium">Stripe necesita:</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {dedupe([...state.pastDue, ...state.currentlyDue].map(requirementLabel)).map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.kind === "connected" && state.syncedAt ? (
        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
          Última actualización:{" "}
          {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(state.syncedAt))}
        </p>
      ) : null}

      {state.kind === "not_configured" ? (
        <p className="text-sm text-muted-foreground">
          Stripe no está configurado en este entorno (falta <code>STRIPE_SECRET_KEY</code>).
        </p>
      ) : null}
      {state.kind === "error" ? <p className="text-sm text-destructive">{state.message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {state.kind === "disconnected" || state.kind === "not_configured" ? (
          <form action={connect}>
            <Button type="submit" size="sm" loading={connecting} disabled={state.kind === "not_configured"}>
              Conectar Stripe
            </Button>
          </form>
        ) : null}

        {state.kind === "connected" && !(state.chargesEnabled && state.payoutsEnabled) ? (
          <form action={connect}>
            <Button type="submit" size="sm" loading={connecting}>
              <ShieldCheck /> Completar verificación
            </Button>
          </form>
        ) : null}

        {state.kind === "connected" ? (
          <form action={refresh}>
            <Button type="submit" size="sm" variant="ghost" loading={refreshing}>
              <RefreshCw /> Actualizar estado
            </Button>
          </form>
        ) : null}

        {state.kind === "connected" && state.detailsSubmitted ? (
          <form action={openDashboard}>
            <Button type="submit" size="sm" variant="outline" loading={opening}>
              Ver mis depósitos <ExternalLink />
            </Button>
          </form>
        ) : null}
      </div>
    </Card>
  );
}

function StripeBadge({ state }: { state: StripeCardState }) {
  if (state.kind !== "connected") return <Badge variant="secondary">Sin conectar</Badge>;
  if (state.chargesEnabled && state.payoutsEnabled) return <Badge>Activo</Badge>;
  if (state.disabledReason) return <Badge variant="destructive">Restringido</Badge>;
  if (state.chargesEnabled) return <Badge variant="accent">Depósitos pendientes</Badge>;
  return <Badge variant="accent">Verificación pendiente</Badge>;
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}
