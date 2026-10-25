"use client";

import { apiResult } from "./api-result";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Textarea } from "@granola/ui";
import { createPatient, listPatients } from "@/app/(panel)/app/pacientes/actions";
import { patientSchema } from "./schemas";

export function PatientsList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof listPatients>> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void apiResult(listPatients(search)).then((r) => {
        if (active) setResult(r);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Pacientes</h1>
          <p className="text-muted-foreground">Tu consulta, paciente por paciente.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Cerrar alta" : "Nuevo paciente"}</Button>
      </header>
      {showForm && (
        <Card>
          <h2 className="text-xl font-bold">Alta manual</h2>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const input = { ...Object.fromEntries(data), consent: data.get("consent") === "on" };
              const parsed = patientSchema.safeParse(input);
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? "Revisa los campos");
                return;
              }
              setError("");
              startTransition(async () => {
                const r = await apiResult(createPatient(parsed.data));
                if (r.ok) router.push(`/app/pacientes/${r.data.id}`);
                else setError(r.error);
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Nombre completo
                <Input name="name" required maxLength={200} autoComplete="name" />
              </label>
              <label className="grid gap-1 text-sm">
                WhatsApp (con lada)
                <Input name="phoneWa" type="tel" placeholder="+525512345678" required autoComplete="tel" />
              </label>
              <label className="grid gap-1 text-sm">
                Correo
                <Input name="email" type="email" autoComplete="email" />
              </label>
              <label className="grid gap-1 text-sm">
                Fecha de nacimiento
                <Input name="birthDate" type="date" />
              </label>
              <label className="grid gap-1 text-sm">
                Sexo
                <select name="sex" className="h-11 rounded-xl border bg-card px-3">
                  <option value="">Sin especificar</option>
                  <option value="f">Femenino</option>
                  <option value="m">Masculino</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              Notas
              <Textarea name="notes" maxLength={10000} />
            </label>
            <label className="flex items-start gap-3 rounded-xl bg-secondary p-4 text-sm">
              <input type="checkbox" name="consent" required className="mt-1" />
              <span>
                El paciente otorgó su consentimiento expreso para registrar y tratar sus datos personales sensibles de
                salud conforme al{" "}
                <Link className="underline" href="/privacidad" target="_blank">
                  aviso de privacidad
                </Link>{" "}
                (LFPDPPP). Se guardarán fecha e IP.
              </span>
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button disabled={pending} type="submit" className="self-start">
              {pending ? "Guardando…" : "Guardar paciente"}
            </Button>
          </form>
        </Card>
      )}
      <label className="grid gap-2 text-sm font-medium">
        Buscar por nombre o WhatsApp
        <Input value={search} onChange={(e) => setSearch(e.target.value)} maxLength={100} placeholder="Nombre o +52…" />
      </label>
      <div aria-live="polite">
        {!result ? (
          <p>Cargando pacientes…</p>
        ) : !result.ok ? (
          <p role="alert">{result.error}</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {result.data.length} pacientes
              {result.data.length === 100 ? " · Se muestran hasta 100; afina la búsqueda" : ""}
            </p>
            {result.data.length === 0 ? (
              <Card>No se encontraron pacientes.</Card>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {result.data.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/app/pacientes/${p.id}`}
                      className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Card className="h-full gap-1 hover:border-primary">
                        <h2 className="font-bold">{p.name}</h2>
                        <p className="text-sm text-muted-foreground">{p.phoneWa ?? "Sin WhatsApp"}</p>
                        <p className="break-all text-sm text-muted-foreground">{p.email ?? "Sin correo"}</p>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
