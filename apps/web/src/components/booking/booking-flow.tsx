"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { MapPin, ShieldCheck } from "lucide-react";

import {
  Badge,
  Button,
  Input,
  FormField as Field,
  Stepper,
  SegmentedControl,
  EmptyState,
  Textarea,
  cn,
  toast,
} from "@granola/ui";
import { formatTimeInTz, ymdInTz } from "@granola/core/scheduling";

import { createBooking, fetchSlots } from "@/app/[slug]/agendar/actions";
import { bookingSchema } from "@/components/booking/booking-schema";
import {
  MODALITY_LABEL,
  PAYMENT_MODE_LABEL,
  formatDuration,
  formatPrice,
  formatCalendarDate,
  formatShortDate,
  formatTimezone,
  type Modality,
  type PaymentMode,
} from "@/components/booking/format";
import {
  DEFAULT_DIAL_CODE,
  normalizePhoneE164,
} from "@/components/booking/phone";
import {
  SlotPicker,
  useDetectedTimezone,
  type SlotIso,
} from "@/components/booking/slot-picker";

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

export function BookingFlow({
  slug,
  nutritionistTimezone,
  services,
  nowIso,
  initialServiceId,
}: Props) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const serviceId = params.get("servicio") ?? initialServiceId;
  const service = services.find((s) => s.id === serviceId);
  const [tzOverride, setTzOverride] = React.useState<string | null>(null);
  const detectedTz = useDetectedTimezone(nutritionistTimezone);
  const timezone = tzOverride ?? detectedTz;
  const [loaded, setLoaded] = React.useState<{
    serviceId: string;
    slots: SlotIso[];
  } | null>(null);
  const [revision, refreshSlots] = React.useReducer((n: number) => n + 1, 0);
  const [message, setMessage] = React.useState("");
  const [form, setForm] = React.useState<FormState>({
    name: "",
    dialCode: DEFAULT_DIAL_CODE,
    phone: "",
    email: "",
    consent: false,
    modality: "online",
    paymentMethod: "card",
    notes: "",
  });
  const slots =
    service && loaded?.serviceId === service.id ? loaded.slots : null;
  const date = params.get("fecha");
  const validDate = slots?.some(
    (s) => ymdInTz(new Date(s.startsAt), timezone) === date,
  );
  const slot = slots?.find(
    (s) =>
      s.startsAt === params.get("hora") &&
      ymdInTz(new Date(s.startsAt), timezone) === date,
  );
  const requested = Number(params.get("paso") ?? (service ? 2 : 1));
  const step = !service
    ? 1
    : !Number.isInteger(requested)
      ? 2
      : Math.max(
          1,
          Math.min(
            requested,
            !date || (slots !== null && !validDate) ? 2 : !slot ? 3 : 4,
          ),
        );

  function navigate(
    next: number,
    changes: Record<string, string | null> = {},
    replace = false,
  ) {
    const search = new URLSearchParams(params.toString());
    search.set("paso", String(next));
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) search.delete(key);
      else search.set(key, value);
    }
    // La API nativa se integra con useSearchParams en Next y conserva el estado del formulario.
    window.history[replace ? "replaceState" : "pushState"](
      null,
      "",
      `${pathname}?${search}`,
    );
  }

  const selectedServiceId = service?.id;
  React.useEffect(() => {
    if (!selectedServiceId) return;
    let cancelled = false;
    fetchSlots({ slug, serviceId: selectedServiceId })
      .then((res) => {
        if (cancelled) return;
        if (res.ok)
          setLoaded({ serviceId: selectedServiceId, slots: res.slots });
        else {
          setLoaded({ serviceId: selectedServiceId, slots: [] });
          toast.error(res.error);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded({ serviceId: selectedServiceId, slots: [] });
          toast.error("No pudimos cargar los horarios. Intenta de nuevo.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug, selectedServiceId, revision]);

  if (services.length === 0)
    return (
      <EmptyState
        title="Todavía no hay servicios para agendar"
        description="Vuelve pronto o escríbele directamente."
        action={
          <Button variant="outline" asChild>
            <Link href={`/${slug}`}>Volver al perfil</Link>
          </Button>
        }
      />
    );

  const summary = [
    service?.name,
    date ? formatCalendarDate(date) : null,
    slot ? formatTimeInTz(new Date(slot.startsAt), timezone) : null,
    service ? formatPrice(service.priceCents, service.currency) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      data-booking-flow
      className="grid gap-8 pb-32 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12 lg:pb-8"
    >
      <aside
        aria-label="Resumen de tu cita"
        className="hidden self-start border-r border-border pr-8 lg:sticky lg:top-24 lg:block"
      >
        <p className="text-sm text-muted-foreground">Tu consulta</p>
        <h2 className="mt-2 text-xl font-semibold">
          {service?.name ?? "Servicio por elegir"}
        </h2>
        {service ? (
          <>
            <p className="mt-3 text-xl font-medium tabular-nums">
              {formatPrice(service.priceCents, service.currency)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatDuration(service.durationMin)} ·{" "}
              {MODALITY_LABEL[service.modality]}
            </p>
            {service.description ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {service.description}
              </p>
            ) : null}
          </>
        ) : null}
        {date ? (
          <div className="mt-6 border-t border-border pt-6">
            <p className="font-medium">{formatCalendarDate(date)}</p>
            {slot ? (
              <p className="mt-1 tabular-nums">
                {formatTimeInTz(new Date(slot.startsAt), timezone)}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-muted-foreground">
              {formatTimezone(timezone)}
            </p>
          </div>
        ) : null}
      </aside>
      <div className="flex min-w-0 flex-col gap-6">
        <Stepper
          steps={["Servicio", "Fecha", "Hora", "Tus datos"]}
          currentStep={step - 1}
        />
        {message ? (
          <p
            role="alert"
            className="rounded-md bg-destructive-soft p-3 text-sm text-destructive-ink"
          >
            {message}
          </p>
        ) : null}
        {step === 1 ? (
          <>
            <h1 className="text-xl font-semibold">¿Qué consulta necesitas?</h1>
            <fieldset className="divide-y divide-border border-y border-border">
              <legend className="sr-only">Servicio</legend>
              {services.map((s) => (
                <label
                  key={s.id}
                  className={cn(
                    "flex min-h-16 cursor-pointer items-start gap-3 py-4 transition-colors hover:bg-secondary/40",
                    service?.id === s.id && "bg-primary-soft/30",
                  )}
                >
                  <input
                    type="radio"
                    name="service"
                    value={s.id}
                    checked={service?.id === s.id}
                    className="mt-1 size-4 shrink-0 accent-primary"
                    onChange={() => {
                      setForm((f) => ({
                        ...f,
                        modality:
                          s.modality === "presencial" ? "presencial" : "online",
                      }));
                      setMessage("");
                      navigate(1, { servicio: s.id, fecha: null, hora: null });
                    }}
                  />
                  <ServiceSummary service={s} />
                </label>
              ))}
            </fieldset>
          </>
        ) : null}
        {(step === 2 || step === 3) && service ? (
          <>
            <h1 className="text-xl font-semibold">
              {step === 2 ? "¿Qué día te queda?" : "¿A qué hora?"}
            </h1>
            <SlotPicker
              slots={slots}
              timezone={timezone}
              nowIso={nowIso}
              selected={slot?.startsAt ?? null}
              mode={step === 2 ? "date" : "time"}
              selectedDate={date}
              onDateSelect={(fecha) => navigate(2, { fecha, hora: null }, true)}
              onTimezoneChange={(tz) => {
                setTzOverride(tz);
                navigate(2, { fecha: null, hora: null });
              }}
              onSelect={(s) => {
                setMessage("");
                navigate(3, { hora: s.startsAt }, true);
              }}
            />
            {slots?.length === 0 ? (
              <Button variant="outline" onClick={() => refreshSlots()}>
                Reintentar horarios
              </Button>
            ) : null}
          </>
        ) : null}
        {step === 4 && service && slot ? (
          <BookingForm
            slug={slug}
            service={service}
            slot={slot}
            timezone={timezone}
            nutritionistTimezone={nutritionistTimezone}
            form={form}
            setForm={setForm}
            onBack={() => navigate(3)}
            onConflict={(error) => {
              setMessage(error);
              setLoaded(null);
              refreshSlots();
              navigate(3, { hora: null }, true);
            }}
          />
        ) : null}
        {step < 4 ? (
          <BookingActions summary={summary}>
            <Button
              variant="ghost"
              size="lg"
              onClick={() =>
                step === 1 ? router.push(`/${slug}`) : navigate(step - 1)
              }
            >
              Atrás
            </Button>
            <Button
              size="lg"
              className="flex-1"
              disabled={step === 1 ? !service : step === 2 ? !validDate : !slot}
              onClick={() => navigate(step + 1)}
            >
              Continuar
            </Button>
          </BookingActions>
        ) : null}
      </div>
    </div>
  );
}

function BookingActions({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static lg:mt-2 lg:border-0 lg:bg-transparent lg:p-0">
      <div className="mx-auto w-full max-w-[480px] space-y-3 lg:max-w-none">
        {summary ? (
          <p className="truncate text-sm text-muted-foreground lg:hidden">
            {summary}
          </p>
        ) : null}
        <div className="flex items-center gap-3">{children}</div>
      </div>
    </div>
  );
}

function ServiceSummary({ service }: { service: BookingService }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="flex items-start justify-between gap-3">
        <span className="text-base font-semibold">{service.name}</span>
        <span className="shrink-0 text-base font-medium tabular-nums">
          {formatPrice(service.priceCents, service.currency)}
        </span>
      </span>
      {service.description ? (
        <span className="mt-1 block text-sm text-muted-foreground">
          {service.description}
        </span>
      ) : null}
      <span className="mt-2 block text-sm text-muted-foreground">
        {formatDuration(service.durationMin)} ·{" "}
        {MODALITY_LABEL[service.modality]} ·{" "}
        {PAYMENT_MODE_LABEL[service.paymentMode]}
      </span>
    </span>
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
  onConflict,
  form,
  setForm,
}: {
  slug: string;
  service: BookingService;
  slot: SlotIso;
  timezone: string;
  nutritionistTimezone: string;
  onBack: () => void;
  onConflict: (message: string) => void;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const [showEmail, setShowEmail] = React.useState(!!form.email);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const start = new Date(slot.startsAt);
  const differentTz = timezone !== nutritionistTimezone;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      slug,
      serviceId: service.id,
      startsAt: slot.startsAt,
      modality: service.modality === "ambas" ? form.modality : service.modality,
      name: form.name,
      dialCode: form.dialCode,
      phone: form.phone,
      email: form.email,
      consent: form.consent as true,
      timezone,
      paymentMethod:
        service.paymentMode === "prepaid" ? form.paymentMethod : undefined,
      notes: form.notes.trim() || undefined,
    };
    const parsed = bookingSchema.safeParse(input);
    const fe: Record<string, string> = {};
    if (!parsed.success)
      for (const i of parsed.error.issues)
        fe[String(i.path[0] ?? "_")] ??= i.message;
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
        if (
          res.error.includes("se acaba de ocupar") ||
          res.error.includes("horario")
        )
          onConflict(res.error);
      }
    });
  }

  return (
    <form
      id="booking-form"
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-6"
    >
      <h1 className="text-xl font-semibold">Tus datos</h1>
      {differentTz ? (
        <p className="text-sm text-muted-foreground">
          En {formatTimezone(nutritionistTimezone)} serán las{" "}
          {formatTimeInTz(start, nutritionistTimezone)}.
        </p>
      ) : null}

      <Field label="Nombre completo" error={errors.name}>
        <Input
          required
          autoComplete="name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="María Pérez"
          aria-invalid={!!errors.name}
        />
      </Field>

      <Field
        label="WhatsApp"
        error={errors.phone}
        hint="Ahí te llega la confirmación y los recordatorios."
      >
        <div className="flex gap-2">
          <span className="flex h-11 items-center rounded-md border border-border px-3 text-sm">
            +52
          </span>
          <Input
            required
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

      {!showEmail ? (
        <Button
          type="button"
          variant="ghost"
          className="w-fit"
          onClick={() => setShowEmail(true)}
        >
          + Agregar correo
        </Button>
      ) : (
        <>
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
        </>
      )}

      <details>
        <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground">
          + Agregar nota (opcional)
        </summary>
        <div className="mt-3">
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
        </div>
      </details>

      {service.modality === "ambas" ? (
        <Field label="¿Cómo prefieres tu consulta?">
          <SegmentedControl
            label="Modalidad"
            value={form.modality}
            onValueChange={(value) =>
              set("modality", value as FormState["modality"])
            }
            options={[
              { value: "online", label: "En línea" },
              { value: "presencial", label: "Presencial" },
            ]}
          />
          {form.modality === "presencial" && service.location ? (
            <p className="text-sm text-muted-foreground">{service.location}</p>
          ) : null}
        </Field>
      ) : service.modality === "presencial" && service.location ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4" /> {service.location}
        </p>
      ) : null}

      {service.paymentMode === "prepaid" ? (
        <Field
          label="Forma de pago"
          hint={`Se cobra ${formatPrice(service.priceCents, service.currency)} al confirmar.`}
        >
          <SegmentedControl
            label="Forma de pago"
            value={form.paymentMethod}
            onValueChange={(value) =>
              set("paymentMethod", value as FormState["paymentMethod"])
            }
            options={[
              { value: "card", label: "Tarjeta" },
              { value: "spei", label: "SPEI" },
              { value: "oxxo", label: "OXXO" },
            ]}
          />
        </Field>
      ) : service.priceCents > 0 ? (
        <Badge variant="secondary" className="w-fit">
          {PAYMENT_MODE_LABEL[service.paymentMode]} ·{" "}
          {formatPrice(service.priceCents, service.currency)}
        </Badge>
      ) : null}

      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 border-t pt-4 text-sm",
          errors.consent ? "border-destructive" : "border-border",
        )}
      >
        <input
          type="checkbox"
          required
          aria-invalid={!!errors.consent}
          aria-describedby={errors.consent ? "consent-error" : undefined}
          className="mt-0.5 size-4 shrink-0 accent-primary"
          checked={form.consent}
          onChange={(e) => set("consent", e.target.checked)}
        />
        <span>
          Acepto el{" "}
          <Link
            href="/privacidad"
            target="_blank"
            className="font-semibold text-primary underline"
          >
            aviso de privacidad
          </Link>{" "}
          y que mis datos de salud se traten para agendar y dar seguimiento a mi
          consulta.
        </span>
      </label>
      {errors.consent ? (
        <p
          id="consent-error"
          role="alert"
          className="-mt-3 text-sm text-destructive-ink"
        >
          {errors.consent}
        </p>
      ) : null}

      <BookingActions
        summary={`${service.name} · ${formatShortDate(start, timezone)} · ${formatTimeInTz(start, timezone)} · ${formatPrice(service.priceCents, service.currency)}`}
      >
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={onBack}
          disabled={pending}
        >
          Atrás
        </Button>
        <Button type="submit" size="lg" loading={pending} className="flex-1">
          {service.paymentMode === "prepaid"
            ? "Continuar al pago"
            : "Confirmar cita"}
        </Button>
      </BookingActions>
      <p className="inline-flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Tus datos solo los ve tu
        nutrióloga.
      </p>
    </form>
  );
}
