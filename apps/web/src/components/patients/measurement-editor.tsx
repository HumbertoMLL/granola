"use client";
import { apiResult } from "./api-result";
import { useState, useTransition } from "react";
import { Button, Input, Textarea } from "@granola/ui";
import { saveMeasurement } from "@/app/(panel)/app/pacientes/actions";
import { measurementSchema } from "./schemas";

export const measurementFields = [
  ["weightKg", "Peso (kg)", "0.01", "600"], ["heightCm", "Talla (cm)", "0.1", "250"],
  ["waistCm", "Cintura (cm)", "0.1", "400"], ["hipCm", "Cadera (cm)", "0.1", "400"],
  ["bodyFatPct", "Grasa corporal (%)", "0.01", "100"], ["muscleKg", "Músculo (kg)", "0.01", "600"],
] as const;
type Measurement = { id: string; measuredAt: Date; notes: string | null } & Record<typeof measurementFields[number][0], string | null>;

export function MeasurementEditor({ patientId, row, onSaved, onCancel }: { patientId: string; row?: Measurement; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const localValue = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return <form className="grid gap-4" onSubmit={(event) => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const date = new Date(String(raw.measuredAt));
    if (!Number.isFinite(date.getTime())) { setError("Escribe una fecha válida"); return; }
    const input = { ...raw, measuredAt: date.toISOString() };
    const parsed = measurementSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revisa las mediciones"); return; }
    setError("");
    startTransition(async () => {
      const r = await apiResult(saveMeasurement({ patientId, id: row?.id, values: input }));
      if (r.ok) await onSaved(); else setError(r.error);
    });
  }}>
    <h3 className="font-bold">{row ? "Editar medición" : "Nueva medición"}</h3>
    <label className="grid gap-1 text-sm">Fecha y hora (zona de este dispositivo)<Input name="measuredAt" type="datetime-local" defaultValue={localValue(row?.measuredAt ?? new Date())} required /></label>
    <div className="grid gap-3 sm:grid-cols-2">{measurementFields.map(([name, label, step, max]) => <label key={name} className="grid gap-1 text-sm">{label}<Input name={name} type="number" min={name === "bodyFatPct" ? "0" : step} max={max} step={step} defaultValue={row?.[name] ?? ""} /></label>)}</div>
    <label className="grid gap-1 text-sm">Notas de la medición<Textarea name="notes" defaultValue={row?.notes ?? ""} maxLength={10000} /></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar medición"}</Button><Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancelar</Button></div>
  </form>;
}
