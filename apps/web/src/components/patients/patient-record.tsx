"use client";

import { DocumentsTab } from "./documents-tab";
import { getInbodyEvolution } from "@/app/(panel)/app/pacientes/document-actions";
import { apiResult } from "./api-result";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Skeleton,
  EmptyState,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@granola/ui";
import {
  calculateBmi,
  waistHeightRatio,
  waistHipRatio,
} from "@granola/core/nutrition";
import {
  createClinicalNote,
  deleteMeasurement,
  getPatientRecord,
} from "@/app/(panel)/app/pacientes/actions";
import { STATUS_LABEL } from "@/components/booking/format";
import { MeasurementChart } from "./measurement-chart";
import { MeasurementEditor, measurementFields } from "./measurement-editor";
import { NutritionCalculator } from "./nutrition-calculator";
import { noteSchema } from "./schemas";

type RecordResult = Awaited<ReturnType<typeof getPatientRecord>>;
type RecordData = Extract<RecordResult, { ok: true }>["data"];
const bmiLabels = {
  bajo_peso: "Bajo peso",
  normal: "Peso normal",
  sobrepeso: "Sobrepeso",
  obesidad_i: "Obesidad I",
  obesidad_ii: "Obesidad II",
  obesidad_iii: "Obesidad III",
};
const sexLabels = { f: "Femenino", m: "Masculino", otro: "Otro" };

export function PatientRecord({
  patientId,
  appointmentId,
}: {
  patientId: string;
  appointmentId?: string;
}) {
  const [result, setResult] = useState<RecordResult | null>(null);
  useEffect(() => {
    let active = true;
    void apiResult(getPatientRecord({ patientId, appointmentId })).then((r) => {
      if (active) setResult(r);
    });
    return () => {
      active = false;
    };
  }, [patientId, appointmentId]);
  const refresh = async () => {
    setResult(await apiResult(getPatientRecord({ patientId, appointmentId })));
  };
  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <Link href="/app/pacientes" className="text-sm font-medium text-primary">
        ← Pacientes
      </Link>
      {!result ? (
        <div
          role="status"
          aria-label="Cargando expediente"
          className="grid gap-3"
        >
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : !result.ok ? (
        <Card>
          <p role="alert">{result.error}</p>
          <Button onClick={() => void refresh()}>Reintentar</Button>
        </Card>
      ) : (
        <RecordContent key={patientId} data={result.data} refresh={refresh} />
      )}
    </div>
  );
}

function RecordContent({
  data,
  refresh,
}: {
  data: RecordData;
  refresh: () => Promise<void>;
}) {
  const {
    patient,
    measurements: rows,
    visits,
    charges,
    notes,
    timezone,
    appointmentId,
  } = data;
  const [evolution, setEvolution] = useState<Awaited<
    ReturnType<typeof getInbodyEvolution>
  > | null>(null);
  const refreshEvolution = () => {
    void apiResult(getInbodyEvolution(patient.id)).then(setEvolution);
  };
  useEffect(() => {
    void apiResult(getInbodyEvolution(patient.id)).then(setEvolution);
  }, [patient.id]);
  const inbodyRows =
    evolution?.ok && evolution.data.length >= 2 ? evolution.data : [];
  const [editor, setEditor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const date = (d: Date) =>
    new Intl.DateTimeFormat("es-MX", {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const birth = patient.birthDate;
  const age = birth
    ? Number(today.slice(0, 4)) -
      Number(birth.slice(0, 4)) -
      (today.slice(5) < birth.slice(5) ? 1 : 0)
    : undefined;
  const latest = rows[rows.length - 1];
  const bmi =
    latest?.weightKg && latest.heightCm && age !== undefined && age >= 18
      ? calculateBmi(Number(latest.weightKg), Number(latest.heightCm))
      : null;
  const upcoming = visits
    .filter((v) => v.startsAt >= now)
    .reverse()
    .slice(0, 5);
  const past = visits.filter((v) => v.startsAt < now).slice(0, 5);
  const visitList = (items: typeof visits) =>
    items.length ? (
      <ul className="grid gap-2">
        {items.map((v) => (
          <li key={v.id}>
            <Link
              href={`/app/agenda/${v.id}`}
              className="text-sm text-primary underline"
            >
              {date(v.startsAt)} · {STATUS_LABEL[v.status]}
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState
        title="Sin citas"
        description="Las consultas de este paciente aparecerán aquí."
        action={
          <Button variant="outline" asChild>
            <Link href="/app/agenda">Ver agenda</Link>
          </Button>
        }
      />
    );
  return (
    <>
      <header>
        <h1 className="text-3xl font-extrabold">{patient.name}</h1>
        <p className="text-sm text-muted-foreground">
          Expediente básico · zona horaria: {timezone}
        </p>
      </header>
      <Tabs defaultValue={appointmentId ? "history" : "summary"}>
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="measurements">Antropometría</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
        </TabsList>
        <TabsContent value="documents">
          <DocumentsTab patientId={patient.id} onChange={refreshEvolution} />
        </TabsContent>
        <TabsContent value="summary" className="grid gap-4">
          <Card>
            <h2 className="text-lg font-bold">Datos del paciente</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["WhatsApp", patient.phoneWa],
                ["Correo", patient.email],
                ["Nacimiento", birth],
                ["Sexo", patient.sex ? sexLabels[patient.sex] : null],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-words font-medium">
                    {value || "Sin registrar"}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="whitespace-pre-wrap text-sm">
              {patient.notes || "Sin notas generales."}
            </p>
            <p className="text-xs text-muted-foreground">
              Consentimiento expreso: {date(patient.consentAt)} · IP:{" "}
              {patient.consentIp}
            </p>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <h2 className="font-bold">Próximas citas</h2>
              {visitList(upcoming)}
            </Card>
            <Card>
              <h2 className="font-bold">Últimas citas</h2>
              {visitList(past)}
            </Card>
          </div>
          <Card>
            <h2 className="font-bold">Pagos</h2>
            {charges.length ? (
              <ul className="grid gap-2">
                {charges.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap justify-between gap-2 text-sm"
                  >
                    <span>{date(p.createdAt)}</span>
                    <span>
                      {new Intl.NumberFormat("es-MX", {
                        style: "currency",
                        currency: p.currency,
                      }).format(p.amountCents / 100)}{" "}
                      ·{" "}
                      {
                        {
                          paid: "Pagado",
                          pending: "Pendiente",
                          failed: "Fallido",
                          expired: "Expirado",
                          refunded: "Reembolsado",
                        }[p.status]
                      }
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Sin pagos registrados"
                description="Aquí verás los pagos de las consultas de este paciente."
                action={
                  <Button variant="outline" asChild>
                    <Link href="/app/cobros">Ver cobros</Link>
                  </Button>
                }
              />
            )}
          </Card>
        </TabsContent>
        <TabsContent value="measurements" className="grid gap-4">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Antropometría</h2>
              <Button onClick={() => setEditor("new")}>Nueva medición</Button>
            </div>
            <MeasurementChart
              rows={[...rows, ...inbodyRows].sort(
                (a, b) => a.measuredAt.getTime() - b.measuredAt.getTime(),
              )}
              timezone={timezone}
              includeComposition={inbodyRows.length >= 2}
            />
            {inbodyRows.length >= 2 && (
              <p className="text-xs text-muted-foreground">
                Incluye reportes InBody revisados; fecha de carga del estudio.
                Las mediciones manuales se conservan.
              </p>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              <p>
                IMC (OMS, adultos):{" "}
                <strong>
                  {bmi
                    ? `${bmi.value.toFixed(2)} · ${bmiLabels[bmi.classification]}`
                    : "Requiere edad adulta, peso y talla en la última medición"}
                </strong>
              </p>
              <p>
                Cintura/cadera:{" "}
                <strong>
                  {latest?.waistCm && latest.hipCm
                    ? waistHipRatio(
                        Number(latest.waistCm),
                        Number(latest.hipCm),
                      ).toFixed(2)
                    : "Sin datos"}
                </strong>
              </p>
              <p>
                Cintura/talla:{" "}
                <strong>
                  {latest?.waistCm && latest.heightCm
                    ? waistHeightRatio(
                        Number(latest.waistCm),
                        Number(latest.heightCm),
                      ).toFixed(2)
                    : "Sin datos"}
                </strong>
              </p>
            </div>
          </Card>
          <Sheet
            open={!!editor}
            onOpenChange={(open) => !open && setEditor(null)}
          >
            <SheetContent side="bottom" className="mx-auto max-w-lg">
              <SheetHeader>
                <SheetTitle>
                  {editor === "new" ? "Nueva medición" : "Editar medición"}
                </SheetTitle>
                <SheetDescription>
                  Registra las medidas del paciente.
                </SheetDescription>
              </SheetHeader>
              {editor && (
                <MeasurementEditor
                  key={editor}
                  patientId={patient.id}
                  row={rows.find((r) => r.id === editor)}
                  onCancel={() => setEditor(null)}
                  onSaved={async () => {
                    await refresh();
                    setEditor(null);
                  }}
                />
              )}
            </SheetContent>
          </Sheet>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <ul className="grid gap-3">
            {[...rows].reverse().map((r) => (
              <li key={r.id}>
                <Card className="gap-3">
                  <h3 className="font-bold">{date(r.measuredAt)}</h3>
                  <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    {measurementFields.map(([name, label]) => (
                      <div key={name}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd>{r[name] ?? "—"}</dd>
                      </div>
                    ))}
                  </dl>
                  {r.notes && (
                    <p className="whitespace-pre-wrap text-sm">{r.notes}</p>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditor(r.id)}
                    >
                      Editar
                    </Button>
                    <details className="relative">
                      <summary
                        aria-label="Más acciones de la medición"
                        className="cursor-pointer rounded-xl border border-border px-3 py-2 text-sm"
                      >
                        ⋯
                      </summary>
                      <div className="absolute right-0 z-10 rounded-xl border border-border bg-card p-2 shadow-float">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeleting(r.id)}
                        >
                          Borrar
                        </Button>
                      </div>
                    </details>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {!rows.length && (
            <EmptyState
              title="Todavía no hay mediciones"
              description="Registra la primera medición para ver su evolución."
              action={
                <Button variant="outline" onClick={() => setEditor("new")}>
                  Agregar medición
                </Button>
              }
            />
          )}
          <Card>
            <NutritionCalculator
              key={`${latest?.id}-${latest?.weightKg}-${latest?.heightCm}`}
              weight={latest?.weightKg}
              height={latest?.heightCm}
              age={age}
              sex={patient.sex}
            />
          </Card>
        </TabsContent>
        <TabsContent value="history" className="grid gap-4">
          <Card>
            <h2 className="text-lg font-bold">Agregar nota clínica</h2>
            <ClinicalNoteForm
              patientId={patient.id}
              appointmentId={appointmentId}
              refresh={refresh}
            />
          </Card>
          <h2 className="font-bold">Historial · más reciente primero</h2>
          {notes.length ? (
            <ul className="grid gap-3">
              {notes.map((n) => (
                <li key={n.id}>
                  <Card className="gap-2">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <strong className="capitalize">{n.kind}</strong>
                      <time dateTime={n.createdAt.toISOString()}>
                        {date(n.createdAt)}
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {n.body}
                    </p>
                    {n.appointmentId && (
                      <Link
                        href={`/app/agenda/${n.appointmentId}`}
                        className="text-sm text-primary underline"
                      >
                        Ver cita vinculada
                      </Link>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Sin notas clínicas"
              description="Escribe la primera nota de este paciente en el formulario."
              action={
                <Button
                  variant="outline"
                  onClick={() =>
                    document.getElementById("clinical-note-body")?.focus()
                  }
                >
                  Escribir nota
                </Button>
              }
            />
          )}
        </TabsContent>
      </Tabs>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Borrar esta medición?</DialogTitle>
            <DialogDescription>
              La medición dejará de aparecer en la evolución del paciente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              Conservar
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() => {
                if (!deleting) return;
                setError("");
                startTransition(async () => {
                  const result = await apiResult(
                    deleteMeasurement({ patientId: patient.id, id: deleting }),
                  );
                  if (result.ok) {
                    await refresh();
                    setDeleting(null);
                  } else setError(result.error);
                });
              }}
            >
              Confirmar borrado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClinicalNoteForm({
  patientId,
  appointmentId,
  refresh,
}: {
  patientId: string;
  appointmentId: string | null;
  refresh: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = {
          ...Object.fromEntries(new FormData(form)),
          appointmentId,
        };
        const parsed = noteSchema.safeParse(values);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Revisa la nota");
          return;
        }
        setError("");
        setSaved(false);
        startTransition(async () => {
          const r = await apiResult(
            createClinicalNote({ patientId, values: parsed.data }),
          );
          if (r.ok) {
            form.reset();
            setSaved(true);
            await refresh();
          } else setError(r.error);
        });
      }}
    >
      {appointmentId && (
        <p className="text-sm text-primary">
          Esta nota se vinculará a la cita seleccionada.{" "}
          <Link href={`/app/agenda/${appointmentId}`} className="underline">
            Ver cita
          </Link>
        </p>
      )}
      <label className="grid gap-1 text-sm">
        Tipo
        <select
          name="kind"
          defaultValue={appointmentId ? "consulta" : "nota"}
          className="h-11 rounded-xl border bg-card px-3"
        >
          <option value="consulta">Consulta</option>
          <option value="nota">Nota</option>
          <option value="antecedente">Antecedente</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Contenido
        <Textarea
          id="clinical-note-body"
          name="body"
          required
          maxLength={30000}
          rows={5}
        />
      </label>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-primary">
          Nota guardada.
        </p>
      )}
      <Button className="justify-self-start" type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar nota"}
      </Button>
    </form>
  );
}
