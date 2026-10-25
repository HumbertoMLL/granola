"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Search, Users } from "lucide-react";
import {
  AppliedFilters,
  Avatar,
  AvatarFallback,
  Button,
  DataList,
  DataRow,
  EmptyState,
  FilterChip,
  FormField,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SkeletonRow,
  Textarea,
} from "@granola/ui";
import { PageHeader } from "@/components/panel/page-header";
import { initialsOf } from "@/components/panel/nav";
import {
  createPatient,
  listPatients,
} from "@/app/(panel)/app/pacientes/actions";
import { apiResult } from "./api-result";
import { patientSchema } from "./schemas";

const FACETS = [
  { id: "email", label: "Con correo" },
  { id: "no-email", label: "Sin correo" },
];
type Result = Awaited<ReturnType<typeof listPatients>>;

export function PatientsList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState<{
    search: string;
    result: Result;
  } | null>(null);
  const [filters, setFilters] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const result = loaded?.search === search ? loaded.result : null;
  const rows = result?.ok
    ? result.data.filter(
        (patient) =>
          !filters.length ||
          (filters.includes("email") && !!patient.email) ||
          (filters.includes("no-email") && !patient.email),
      )
    : [];
  const applied = [
    ...FACETS.filter((facet) => filters.includes(facet.id)),
    ...(search ? [{ id: "search", label: `Búsqueda: ${search}` }] : []),
  ];

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void apiResult(listPatients(search)).then((result) => {
        if (active) setLoaded({ search, result });
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  function clearFilters() {
    setSearch("");
    setFilters([]);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pacientes" className="hidden md:flex" />
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <FormField label="Buscar por nombre o WhatsApp">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={100}
                placeholder="Nombre o WhatsApp"
                className="pl-9"
              />
            </div>
          </FormField>
        </div>
        <Button onClick={() => setShowForm(true)}>Nuevo paciente</Button>
      </div>
      <div
        className="-mt-2 flex flex-wrap gap-2"
        aria-label="Filtrar pacientes"
      >
        {FACETS.map((facet) => (
          <FilterChip
            key={facet.id}
            pressed={filters.includes(facet.id)}
            onPressedChange={(pressed) =>
              setFilters((current) =>
                pressed
                  ? [...current, facet.id]
                  : current.filter((id) => id !== facet.id),
              )
            }
          >
            {facet.label}
          </FilterChip>
        ))}
      </div>
      {result?.ok && (
        <AppliedFilters
          count={rows.length}
          filters={applied}
          onRemove={(id) =>
            id === "search"
              ? setSearch("")
              : setFilters((current) =>
                  current.filter((filter) => filter !== id),
                )
          }
          onClear={clearFilters}
        />
      )}
      <section
        aria-label="Resultados de pacientes"
        aria-busy={!result}
        className="flex flex-col gap-3"
      >
        {!result ? (
          <div
            role="status"
            aria-label="Cargando pacientes"
            className="grid gap-3"
          >
            {[0, 1, 2].map((id) => (
              <SkeletonRow key={id} />
            ))}
          </div>
        ) : !result.ok ? (
          <>
            <p role="alert" className="text-destructive-ink">
              {result.error}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void apiResult(listPatients(search)).then((result) =>
                  setLoaded({ search, result }),
                );
              }}
            >
              Reintentar
            </Button>
          </>
        ) : (
          <>
            {result.data.length === 100 && (
              <p className="text-xs text-muted-foreground">
                Se muestran hasta 100 pacientes; afina la búsqueda. Los filtros
                se aplican a estos resultados.
              </p>
            )}
            {!rows.length ? (
              <EmptyState
                icon={<Users aria-hidden />}
                title={
                  applied.length
                    ? "No se encontraron pacientes"
                    : "Todavía no tienes pacientes"
                }
                description={
                  applied.length
                    ? "Prueba otra búsqueda o limpia los filtros."
                    : "Agrega un paciente con su consentimiento o comparte tu página de reservas."
                }
                action={
                  <Button
                    variant="outline"
                    onClick={
                      applied.length ? clearFilters : () => setShowForm(true)
                    }
                  >
                    {applied.length ? "Limpiar filtros" : "Agregar paciente"}
                  </Button>
                }
              />
            ) : (
              <DataList
                aria-label="Pacientes"
                className="border-y border-border"
              >
                {rows.map((patient) => (
                  <DataRow
                    key={patient.id}
                    leading={
                      <Avatar className="size-9">
                        <AvatarFallback>
                          {initialsOf(patient.name)}
                        </AvatarFallback>
                      </Avatar>
                    }
                    title={<h2 className="truncate">{patient.name}</h2>}
                    description={
                      <p className="truncate">
                        {patient.phoneWa ?? patient.email ?? "Sin contacto"}
                      </p>
                    }
                    trailing={
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/app/pacientes/${patient.id}`}>
                          <span className="sr-only">Ver expediente</span>
                          <ChevronRight aria-hidden />
                        </Link>
                      </Button>
                    }
                  />
                ))}
              </DataList>
            )}
          </>
        )}
      </section>
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="bottom" className="mx-auto max-w-lg">
          <SheetHeader>
            <SheetTitle>Nuevo paciente</SheetTitle>
            <SheetDescription>
              Alta manual con consentimiento expreso del paciente.
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const input = {
                ...Object.fromEntries(data),
                phoneWa: `+52${String(data.get("phoneWa") ?? "").replace(/\D/g, "")}`,
                consent: data.get("consent") === "on",
              };
              const parsed = patientSchema.safeParse(input);
              if (!parsed.success) {
                const errors: Record<string, string> = {};
                for (const issue of parsed.error.issues)
                  errors[String(issue.path[0] ?? "_")] ??= issue.message;
                setFieldErrors(errors);
                return;
              }
              setError("");
              setFieldErrors({});
              startTransition(async () => {
                const result = await apiResult(createPatient(parsed.data));
                if (result.ok) router.push(`/app/pacientes/${result.data.id}`);
                else setError(result.error);
              });
            }}
          >
            <FormField label="Nombre completo" error={fieldErrors.name}>
              <Input name="name" required maxLength={200} autoComplete="name" />
            </FormField>
            <FormField
              label="WhatsApp"
              error={fieldErrors.phoneWa}
              hint="Número de México sin lada."
            >
              <div className="flex gap-2">
                <span className="flex h-11 items-center rounded-md border border-border px-3">
                  +52
                </span>
                <Input
                  name="phoneWa"
                  type="tel"
                  inputMode="tel"
                  placeholder="55 1234 5678"
                  required
                  autoComplete="tel-national"
                />
              </div>
            </FormField>
            <FormField label="Correo (opcional)" error={fieldErrors.email}>
              <Input name="email" type="email" autoComplete="email" />
            </FormField>
            <FormField
              label="Fecha de nacimiento (opcional)"
              error={fieldErrors.birthDate}
            >
              <Input name="birthDate" type="date" />
            </FormField>
            <FormField label="Sexo (opcional)" error={fieldErrors.sex}>
              <select
                name="sex"
                className="h-11 rounded-md border border-input bg-card px-3"
              >
                <option value="">Sin especificar</option>
                <option value="f">Femenino</option>
                <option value="m">Masculino</option>
                <option value="otro">Otro</option>
              </select>
            </FormField>
            <FormField label="Notas (opcional)" error={fieldErrors.notes}>
              <Textarea name="notes" maxLength={10000} />
            </FormField>
            <label className="flex items-start gap-3 rounded-xl bg-secondary p-4 text-sm">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-1 accent-primary"
                aria-invalid={!!fieldErrors.consent}
                aria-describedby={
                  fieldErrors.consent ? "patient-consent-error" : undefined
                }
              />
              <span>
                El paciente otorgó su consentimiento expreso para registrar y
                tratar sus datos personales sensibles de salud conforme al{" "}
                <Link className="underline" href="/privacidad" target="_blank">
                  aviso de privacidad
                </Link>{" "}
                (LFPDPPP). Se guardarán fecha e IP.
              </span>
            </label>
            {fieldErrors.consent && (
              <p
                id="patient-consent-error"
                role="alert"
                className="text-sm text-destructive-ink"
              >
                {fieldErrors.consent}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive-ink">
                {error}
              </p>
            )}
            <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button loading={pending} type="submit" className="flex-1">
                Guardar paciente
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
