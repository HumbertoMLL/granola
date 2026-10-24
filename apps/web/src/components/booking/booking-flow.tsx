"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Clock, CreditCard, MapPin, ShieldCheck, Video } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
  toast,
} from "@granola/ui";
import { formatDateInTz, formatTimeInTz, timeZoneLabel } from "@granola/core/scheduling";

import { createBooking, fetchSlots } from "@/app/[slug]/agendar/actions";
import { bookingSchema } from "@/components/booking/booking-schema";
import {
  MODALITY_LABEL,
  PAYMENT_MODE_LABEL,
  formatDuration,
  formatPrice,
  type Modality,
  type PaymentMode,
} from "@/components/booking/format";
import { DEFAULT_DIAL_CODE, DIAL_CODES, normalizePhoneE164 } from "@/components/booking/phone";
import { SlotPicker, useDetectedTimezone, type SlotIso } from "@/components/booking/slot-picker";

export type BookingService = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  currency: string;
  modality: Modality;
  location: string | null;
  paymentMode: PaymentMode;
};

type Props = {
  slug: string;
  nutritionistTimezone: string;
  services: BookingService[];
  nowIso: string;
  /** Preselecciona servicio (?servicio=id). */
  initialServiceId?: string;
};

type Step = "service" | "slot" | "form";

export function BookingFlow({ slug, nutritionistTimezone, services, nowIso, initialServiceId }: Props) {
  const initialService = services.find((s) => s.id === initialServiceId) ?? (services.length === 1 ? services[0] : undefined);
  const [service, setService] = React.useState<BookingService | undefined>(initialService);
  const [step, setStep] = React.useState<Step>(initialService ? "slot" : "service");
  const [tzOverride, setTzOverride] = React.useState<string | null>(null);
  const detectedTz = useDetectedTimezone(nutritionistTimezone);
  const timezone = tzOverride ?? detectedTz;
  const [loaded, setLoaded] = React.useState<{ serviceId: string; slots: SlotIso[] } | null>(null);
  const [slot, setSlot] = React.useState<SlotIso | null>(null);
  // null mientras carga el servicio actual.
  const slots = service && loaded?.serviceId === service.id ? loaded.slots : null;

  // Carga slots cuando cambia el servicio (setState solo en el callback async).
  React.useEffect(() => {
    if (!service) return;
    let cancelled = false;
    const id = service.id;
    fetchSlots({ slug, serviceId: id }).then((res) => {
      if (cancelled) return;
      if (res.ok) setLoaded({ serviceId: id, slots: res.slots });
      else {
        setLoaded({ serviceId: id, slots: [] });
        toast.error(res.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug, service]);

  if (services.length === 0) {
    return (
      <Card className="items-center gap-2 py-10 text-center">
        <p className="font-semibold">Todavía no hay servicios para agendar</p>
        <p className="text-sm text-muted-foreground">Vuelve pronto o escríbele directamente.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Steps step={step} />

      {step === "service" ? (
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-extrabold tracking-tight">¿Qué consulta necesitas?</h1>
          <ul className="flex flex-col gap-2">
            {services.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setService(s);
                    setSlot(null);
                    setStep("slot");
                  }}
                  className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition-colors hover:border-primary"
                >
                  <ServiceSummary service={s} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {step === "slot" && service ? (
        <div className="flex flex-col gap-4">
          <BackLink
            onClick={() => {
              setStep("service");
            }}
            label={services.length > 1 ? "Cambiar servicio" : undefined}
          />
          <Card className="gap-2 p-4">
            <ServiceSummary service={service} compact />
          </Card>
          <h1 className="text-xl font-extrabold tracking-tight">Elige día y hora</h1>
          <SlotPicker
            slots={slots}
            timezone={timezone}
            onTimezoneChange={setTzOverride}
            selected={slot?.startsAt ?? null}
            onSelect={(s) => {
              setSlot(s);
              setStep("form");
            }}
            nowIso={nowIso}
          />
        </div>
      ) : null}

      {step === "form" && service && slot ? (
        <BookingForm
          slug={slug}
          service={service}
          slot={slot}
          timezone={timezone}
          nutritionistTimezone={nutritionistTimezone}
          onBack={() => setStep("slot")}
        />
      ) : null}
    </div>
  );
}

function Steps({ step }: { step: Step }) {
  const items: { key: Step; label: string }[] = [
    { key: "service", label: "Servicio" },
    { key: "slot", label: "Horario" },
    { key: "form", label: "Tus datos" },
  ];
  const idx = items.findIndex((i) => i.key === step);
  return (
    <ol className="flex items-center gap-2 text-xs font-semibold">
      {items.map((it, i) => (
        <li key={it.key} className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full border text-[11px]",
              i < idx && "border-primary bg-primary text-primary-foreground",
              i === idx && "border-primary text-primary",
              i > idx && "border-border text-muted-foreground",
            )}
          >
            {i < idx ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className={cn(i === idx ? "text-foreground" : "text-muted-foreground")}>{it.label}</span>
          {i < items.length - 1 ? <span className="h-px w-4 bg-border" /> : null}
        </li>
      ))}
    </ol>
  );
}

function BackLink({ onClick, label = "Regresar" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> {label}
    </button>
  );
}

function ServiceSummary({ service, compact = false }: { service: BookingService; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{service.name}</p>
        <p className="shrink-0 font-bold text-primary">{formatPrice(service.priceCents, service.currency)}</p>
      </div>
      {!compact && service.description ? (
        <p className="text-sm text-muted-foreground">{service.description}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" /> {formatDuration(service.durationMin)}
        </span>
        <span className="inline-flex items-center gap-1">
          {service.modality === "online" ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}
          {MODALITY_LABEL[service.modality]}
        </span>
        {!compact ? (
          <span className="inline-flex items-center gap-1">
            <CreditCard className="size-3.5" /> {PAYMENT_MODE_LABEL[service.paymentMode]}
          </span>
        ) : null}
      </div>
    </div>
  );
}

type FormState = {
  name: string;
  dialCode: string;
  phone: string;
  email: string;
  consent: boolean;
  modality: "online" | "presencial";
  paymentMethod: "card" | "spei" | "oxxo";
  notes: string;
};

const NOTES_MAX = 500;

function BookingForm({
  slug,
  service,
  slot,
  timezone,
  nutritionistTimezone,
  onBack,
}: {
  slug: string;
  service: BookingService;
  slot: SlotIso;
  timezone: string;
  nutritionistTimezone: string;
  onBack: () => void;
}) {
  const [form, setForm] = React.useState<FormState>({
    name: "",
    dialCode: DEFAULT_DIAL_CODE,
    phone: "",
    email: "",
    consent: false,
    modality: service.modality === "presencial" ? "presencial" : "online",
    paymentMethod: "card",
    notes: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  const differentTz = timezone !== nutritionistTimezone;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      slug,
      serviceId: service.id,
      startsAt: slot.startsAt,
      modality: form.modality,
      name: form.name,
      dialCode: form.dialCode,
      phone: form.phone,
      email: form.email,
      consent: form.consent as true,
      timezone,
      paymentMethod: service.paymentMode === "prepaid" ? form.paymentMethod : undefined,
      notes: form.notes.trim() || undefined,
    };
    const parsed = bookingSchema.safeParse(input);
    const fe: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) fe[String(i.path[0] ?? "_")] ??= i.message;
    const phone = normalizePhoneE164(form.phone, form.dialCode);
    if (!phone.ok) fe.phone ??= phone.error;
    if (Object.keys(fe).length) {
      setErrors(fe);
      return;
    }
    setErrors({});
    startTransition(async () => {
      // Si todo sale bien, la action redirige y nunca regresa.
      const res = await createBooking(input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        if (res.error.includes("horario")) onBack();
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <BackLink onClick={onBack} label="Cambiar horario" />

      <Card className="gap-1 p-4">
        <p className="text-sm text-muted-foreground">{service.name}</p>
        <p className="text-lg font-bold capitalize">{formatDateInTz(start, timezone)}</p>
        <p className="font-semibold tabular-nums">
          {formatTimeInTz(start, timezone)} – {formatTimeInTz(end, timezone)}{" "}
          <span className="text-sm font-normal text-muted-foreground">({timeZoneLabel(timezone)})</span>
        </p>
        {differentTz ? (
          <p className="text-xs text-muted-foreground">
            Hora de la nutrióloga: {formatTimeInTz(start, nutritionistTimezone)} ({timeZoneLabel(nutritionistTimezone)}).
          </p>
        ) : null}
      </Card>

      <h1 className="text-xl font-extrabold tracking-tight">Tus datos</h1>

      <Field label="Nombre completo" error={errors.name}>
        <Input
          autoComplete="name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="María Pérez"
          aria-invalid={!!errors.name}
        />
      </Field>

      <Field label="WhatsApp" error={errors.phone} hint="Ahí te llega la confirmación y los recordatorios.">
        <div className="flex gap-2">
          <Select value={form.dialCode} onValueChange={(v) => set("dialCode", v)}>
            <SelectTrigger className="w-28 shrink-0" aria-label="Lada">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIAL_CODES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span aria-hidden>{c.flag}</span> +{c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="55 1234 5678"
            aria-invalid={!!errors.phone}
          />
        </div>
      </Field>

      <Field label="Correo (opcional)" error={errors.email}>
        <Input
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="maria@correo.com"
          aria-invalid={!!errors.email}
        />
      </Field>

      <Field
        label="¿Algo que deba saber tu nutrióloga? (opcional)"
        error={errors.notes}
        hint={`${form.notes.length}/${NOTES_MAX}`}
      >
        <Textarea
          value={form.notes}
          maxLength={NOTES_MAX}
          rows={3}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Objetivo, alergias, si es tu primera consulta…"
          aria-invalid={!!errors.notes}
        />
      </Field>

      {service.modality === "ambas" ? (
        <Field label="¿Cómo prefieres tu consulta?">
          <div className="grid grid-cols-2 gap-2">
            {(["online", "presencial"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set("modality", m)}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold",
                  form.modality === m ? "border-primary bg-primary-soft text-primary" : "border-border bg-card",
                )}
              >
                {m === "online" ? <Video className="size-4" /> : <MapPin className="size-4" />}
                {MODALITY_LABEL[m]}
              </button>
            ))}
          </div>
          {form.modality === "presencial" && service.location ? (
            <p className="text-xs text-muted-foreground">{service.location}</p>
          ) : null}
        </Field>
      ) : service.modality === "presencial" && service.location ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4" /> {service.location}
        </p>
      ) : null}

      {service.paymentMode === "prepaid" ? (
        <Field label="Forma de pago" hint={`Se cobra ${formatPrice(service.priceCents, service.currency)} al confirmar.`}>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["card", "Tarjeta"],
                ["spei", "SPEI"],
                ["oxxo", "OXXO"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => set("paymentMethod", m)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-semibold",
                  form.paymentMethod === m ? "border-primary bg-primary-soft text-primary" : "border-border bg-card",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      ) : service.priceCents > 0 ? (
        <Badge variant="secondary" className="w-fit">
          {PAYMENT_MODE_LABEL[service.paymentMode]} · {formatPrice(service.priceCents, service.currency)}
        </Badge>
      ) : null}

      <label className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm", errors.consent ? "border-destructive" : "border-border")}>
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          checked={form.consent}
          onChange={(e) => set("consent", e.target.checked)}
        />
        <span>
          Acepto el{" "}
          <Link href="/privacidad" target="_blank" className="font-semibold text-primary underline">
            aviso de privacidad
          </Link>{" "}
          y que mis datos de salud se traten para agendar y dar seguimiento a mi consulta.
        </span>
      </label>
      {errors.consent ? <p className="-mt-3 text-xs text-destructive">{errors.consent}</p> : null}

      <Button type="submit" size="lg" loading={pending} className="w-full">
        {service.paymentMode === "prepaid" ? "Continuar al pago" : "Confirmar cita"}
      </Button>
      <p className="inline-flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Tus datos solo los ve tu nutrióloga.
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
