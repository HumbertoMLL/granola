"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  SegmentedControl,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Stepper,
  Switch,
  Textarea,
} from "@granola/ui";
import { formatIndicatorRange, type Indicator } from "@granola/core/documents";
import {
  listDocuments,
  openReport,
  downloadLink,
  saveReport,
  sendReport,
} from "@/app/(panel)/app/pacientes/document-actions";
import { apiResult } from "./api-result";

type Report = Extract<
  Awaited<ReturnType<typeof openReport>>,
  { ok: true }
>["data"];
type DocumentList = Extract<
  Awaited<ReturnType<typeof listDocuments>>,
  { ok: true }
>["data"];
const kindLabels = {
  inbody: "InBody",
  labs: "Laboratorio",
  otro: "Otro documento",
};
const statusLabels = {
  pending: "Extrayendo datos",
  ok: "Datos extraídos · por revisar",
  failed: "Captura manual disponible",
};
async function post(url: string, body: FormData | { id: string }) {
  const response = await fetch(
    url,
    body instanceof FormData
      ? { method: "POST", body }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = (await response.json()) as { error?: string };
  if (!response.ok)
    throw new Error(result.error || "No se pudo completar la operación");
}
export function DocumentsTab({
  patientId,
  onChange,
}: {
  patientId: string;
  onChange: () => void;
}) {
  const [rows, setRows] = useState<DocumentList | null>(null);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [kind, setKind] = useState<"inbody" | "labs" | "otro">("inbody");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [opening, setOpening] = useState(false);
  const refresh = useCallback(async () => {
    const r = await apiResult(listDocuments(patientId));
    if (r.ok) {
      setRows(r.data);
      setError("");
    } else setError(r.error);
  }, [patientId]);
  useEffect(() => {
    let active = true;
    void apiResult(listDocuments(patientId)).then((r) => {
      if (!active) return;
      if (r.ok) setRows(r.data);
      else setError(r.error);
    });
    return () => {
      active = false;
    };
  }, [patientId]);
  async function review(id: string) {
    setOpening(true);
    setError("");
    const r = await apiResult(openReport(id, "labs"));
    if (r.ok) setReport(r.data);
    else setError(r.error);
    setOpening(false);
  }
  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-lg font-bold">Documentos y reportes</h2>
        <p className="text-sm text-muted-foreground">
          Sube el estudio, revisa los indicadores y prepara un reporte con tu
          interpretación y tu marca.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!rows && !error ? (
          <div aria-label="Cargando documentos" role="status">
            <Skeleton className="h-24 w-full" />
          </div>
        ) : rows?.length ? (
          <ul className="divide-y divide-border">
            {rows.map((d) => (
              <li
                key={d.id}
                className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <h3 className="font-semibold">{kindLabels[d.kind]}</h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.uploadedAt).toLocaleDateString("es-MX", {
                      timeZone: "UTC",
                    })}
                  </p>
                  <Badge variant="secondary">
                    {statusLabels[d.parsedStatus]}
                  </Badge>
                  {d.parseError && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {d.parseError}
                    </p>
                  )}
                  <details className="mt-2 text-sm">
                    <summary
                      aria-label="Más opciones"
                      className="cursor-pointer list-none text-primary"
                    >
                      ⋯
                    </summary>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        const r = await apiResult(
                          downloadLink(d.id, "document"),
                        );
                        if (r.ok)
                          window.open(r.data, "_blank", "noopener,noreferrer");
                        else setError(r.error);
                      }}
                    >
                      Ver original
                    </Button>
                  </details>
                </div>
                <Button
                  variant="outline"
                  disabled={opening}
                  onClick={() => void review(d.id)}
                >
                  Revisar y personalizar
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          !error && (
            <EmptyState
              title="Aún no hay documentos"
              description="Agrega un InBody o análisis de laboratorio. Podrás revisar los datos antes de compartirlos."
              action={
                <Button variant="outline" onClick={() => setUploadOpen(true)}>
                  Elegir estudio
                </Button>
              }
            />
          )
        )}
        {error && !rows && (
          <Button variant="outline" onClick={() => void refresh()}>
            Reintentar
          </Button>
        )}
        <div className="sticky bottom-0 bg-card pt-3">
          <Button
            className="w-full sm:w-auto"
            onClick={() => setUploadOpen(true)}
          >
            Subir documento
          </Button>
        </div>
      </Card>
      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[90dvh] max-w-2xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Subir estudio</SheetTitle>
            <SheetDescription>
              PDF, JPG o PNG de hasta 15 MB. Las imágenes requieren captura
              manual.
            </SheetDescription>
          </SheetHeader>
          <form
            className="grid gap-5 p-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              form.set("kind", kind);
              setBusy(true);
              setError("");
              try {
                const file = form.get("file");
                if (
                  !(file instanceof File) ||
                  !file.size ||
                  file.size > 15 * 1024 * 1024
                )
                  throw new Error("Selecciona un archivo de hasta 15 MB.");
                const begin = await fetch("/api/documents/begin", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    patientId,
                    kind,
                    mime: file.type,
                    sizeBytes: file.size,
                  }),
                });
                const ticket = (await begin.json()) as {
                  mode?: string;
                  id?: string;
                  uploadUrl?: string;
                  error?: string;
                };
                if (!begin.ok)
                  throw new Error(
                    ticket.error || "No se pudo iniciar la subida",
                  );
                if (ticket.mode === "direct" && ticket.uploadUrl && ticket.id) {
                  const uploaded = await fetch(ticket.uploadUrl, {
                    method: "PUT",
                    headers: {
                      "Content-Type": file.type,
                      "Cache-Control": "private, no-store",
                    },
                    body: file,
                  });
                  if (!uploaded.ok)
                    throw new Error(
                      "No se pudo subir el archivo. Revisa la conexión e intenta de nuevo.",
                    );
                  await post("/api/documents/complete", { id: ticket.id });
                } else {
                  await post(
                    `/api/documents/upload?patientId=${patientId}`,
                    form,
                  );
                }
                setUploadOpen(false);
                await refresh();
                onChange();
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "No se pudo subir el archivo",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <SegmentedControl
              label="Tipo de estudio"
              value={kind}
              onValueChange={(v) => setKind(v as typeof kind)}
              options={[
                { value: "inbody", label: "InBody" },
                { value: "labs", label: "Laboratorio" },
                { value: "otro", label: "Otro" },
              ]}
            />
            <FormField
              label="Archivo del estudio"
              hint="El PDF con texto seleccionable permite extraer los indicadores."
            >
              <Input
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                required
              />
            </FormField>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Subiendo y extrayendo…" : "Subir y extraer datos"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
      <Sheet
        open={!!report}
        onOpenChange={(open) => {
          if (!open) {
            setReport(null);
            onChange();
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="mx-auto h-[94dvh] max-w-4xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Personalizar reporte</SheetTitle>
            <SheetDescription>
              Revisa cada valor y su referencia. Solo los indicadores visibles
              aparecerán en el PDF.
            </SheetDescription>
          </SheetHeader>
          {report && (
            <ReportEditor
              key={report.id}
              initial={report}
              onSaved={() => {
                onChange();
                void refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
function ReportEditor({
  initial,
  onSaved,
}: {
  initial: Report;
  onSaved: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState(initial);
  const [step, setStep] = useState(0);
  useEffect(() => {
    root.current?.parentElement?.scrollTo({ top: 0 });
  }, [step]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [via, setVia] = useState<"whatsapp" | "email">("whatsapp");
  const change = (patch: Partial<Report>) => {
    setReport((r) => ({ ...r, ...patch }));
    setDirty(true);
    setPreviewUrl("");
    setMessage("");
  };
  const indicator = (index: number, patch: Partial<Indicator>) =>
    change({
      content: report.content.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    });
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div ref={root} className="grid gap-5 p-4 sm:p-6">
      <Stepper
        steps={["Revisar", "Vista previa", "Enviar"]}
        currentStep={step}
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
      {step === 0 && (
        <form
          id="report-editor"
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const r = await apiResult(saveReport(report));
              if (!r.ok) throw new Error(r.error);
              setReport(r.data);
              setDirty(false);
              setStep(1);
              onSaved();
            });
          }}
        >
          <p className="text-sm text-muted-foreground">
            Los rangos extraídos o predeterminados son editables. Confirma la
            unidad, el contexto y la referencia del laboratorio.
          </p>
          <div>
            <h3 className="mb-2 font-bold">Indicadores</h3>
            <table className="w-full text-sm">
              <caption className="sr-only">
                Valores y comentarios del reporte
              </caption>
              <thead className="sr-only sm:not-sr-only">
                <tr>
                  <th className="text-left">Indicador</th>
                  <th className="text-left">Valores y referencia</th>
                  <th className="text-left">Comentario</th>
                </tr>
              </thead>
              {report.content.map((row, i) => (
                <tbody
                  key={row.clave}
                  className="block border-b border-border py-4 sm:table-row-group"
                >
                  <tr className="grid gap-3 sm:table-row">
                    <th
                      scope="row"
                      className="text-left align-top sm:w-1/4 sm:p-2"
                    >
                      <FormField label="Etiqueta">
                        <Input
                          value={row.etiqueta}
                          maxLength={120}
                          required
                          onChange={(e) =>
                            indicator(i, { etiqueta: e.target.value })
                          }
                        />
                      </FormField>
                      <FormField label={`Mostrar ${row.etiqueta}`}>
                        <Switch
                          checked={row.visible}
                          onCheckedChange={(visible) =>
                            indicator(i, { visible })
                          }
                        />
                      </FormField>
                    </th>
                    <td className="align-top sm:p-2">
                      <div className="grid grid-cols-2 gap-2">
                        <FormField label="Valor">
                          <Input
                            type="number"
                            step="any"
                            required
                            value={row.valor}
                            onChange={(e) =>
                              indicator(i, { valor: Number(e.target.value) })
                            }
                          />
                        </FormField>
                        <FormField label="Unidad">
                          <Input
                            value={row.unidad}
                            maxLength={30}
                            onChange={(e) =>
                              indicator(i, { unidad: e.target.value })
                            }
                          />
                        </FormField>
                        <FormField label="Rango mínimo">
                          <Input
                            type="number"
                            step="any"
                            value={row.rango_min ?? ""}
                            onChange={(e) =>
                              indicator(i, {
                                rango_min:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </FormField>
                        <FormField
                          label="Rango máximo"
                          error={
                            row.rango_min !== null &&
                            row.rango_max !== null &&
                            row.rango_min > row.rango_max
                              ? "El máximo debe ser mayor o igual al mínimo"
                              : undefined
                          }
                        >
                          <Input
                            type="number"
                            step="any"
                            value={row.rango_max ?? ""}
                            onChange={(e) =>
                              indicator(i, {
                                rango_max:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </FormField>
                      </div>
                    </td>
                    <td className="align-top sm:w-1/3 sm:p-2">
                      <FormField label={`Comentario de ${row.etiqueta}`}>
                        <Textarea
                          maxLength={2000}
                          value={row.comentario}
                          onChange={(e) =>
                            indicator(i, { comentario: e.target.value })
                          }
                        />
                      </FormField>
                    </td>
                  </tr>
                </tbody>
              ))}
            </table>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() =>
                change({
                  content: [
                    ...report.content,
                    {
                      clave: `manual_${crypto.randomUUID().replaceAll("-", "")}`,
                      etiqueta: "Nuevo indicador",
                      valor: 0,
                      unidad: "",
                      rango_min: null,
                      rango_max: null,
                      visible: true,
                      comentario: "",
                    },
                  ],
                })
              }
            >
              Agregar indicador
            </Button>
          </div>
          <FormField label="Mi interpretación">
            <Textarea
              rows={5}
              maxLength={12000}
              value={report.interpretation}
              onChange={(e) => change({ interpretation: e.target.value })}
            />
          </FormField>
          <fieldset className="grid gap-3">
            <legend className="mb-2 font-bold">Mi marca</legend>
            <FormField label="Firma profesional">
              <Input
                value={report.brand.firma}
                maxLength={500}
                onChange={(e) =>
                  change({ brand: { ...report.brand, firma: e.target.value } })
                }
              />
            </FormField>
            <FormField label="Color de mi reporte">
              <Input
                type="color"
                value={report.brand.color}
                onChange={(e) =>
                  change({ brand: { ...report.brand, color: e.target.value } })
                }
              />
            </FormField>
            {initial.brand.logo_url && (
              <FormField label="Usar mi avatar como logo">
                <Switch
                  checked={!!report.brand.logo_url}
                  onCheckedChange={(checked) =>
                    change({
                      brand: {
                        ...report.brand,
                        logo_url: checked ? initial.brand.logo_url : null,
                      },
                    })
                  }
                />
              </FormField>
            )}
          </fieldset>
        </form>
      )}
      {step === 1 && (
        <section
          className="rounded-xl border bg-white p-5 text-[#2B2118]"
          aria-label="Vista previa del reporte"
        >
          <h3
            className="text-2xl font-bold"
            style={{ color: report.brand.color }}
          >
            {report.template === "inbody"
              ? "Composición corporal"
              : "Análisis de laboratorio"}
          </h3>
          <p className="mb-5 text-sm">{report.brand.firma}</p>
          <ul className="divide-y">
            {report.content
              .filter((i) => i.visible)
              .map((i) => (
                <li key={i.clave} className="py-3">
                  <p className="flex justify-between gap-3">
                    <strong>{i.etiqueta}</strong>
                    <span>
                      {i.valor} {i.unidad}
                    </span>
                  </p>
                  <p className="text-xs">
                    Referencia: {formatIndicatorRange(i)}
                  </p>
                  {i.comentario && (
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {i.comentario}
                    </p>
                  )}
                </li>
              ))}
          </ul>
          <h4 className="mt-5 font-bold">Mi interpretación</h4>
          <p className="whitespace-pre-wrap">
            {report.interpretation || "Sin interpretación registrada."}
          </p>
        </section>
      )}
      {step === 2 && (
        <Card>
          <h3 className="font-bold">Enviar al paciente</h3>
          <p className="text-sm text-muted-foreground">
            El enlace privado del PDF vence en 7 días. Si editas o regeneras el
            reporte, el enlace anterior deja de funcionar.
          </p>
          <SegmentedControl
            label="Canal de envío"
            value={via}
            onValueChange={(v) => setVia(v as typeof via)}
            options={[
              { value: "whatsapp", label: "WhatsApp" },
              { value: "email", label: "Correo" },
            ]}
          />
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline"
            >
              Abrir PDF generado
            </a>
          )}
          {report.sentAt && (
            <p className="text-sm">
              Último intento:{" "}
              {report.sentVia === "whatsapp" ? "WhatsApp" : "correo"}. Revisa el
              resultado del envío abajo.
            </p>
          )}
        </Card>
      )}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background p-4 sm:-mx-6">
        <Button
          variant="outline"
          disabled={busy || step === 0}
          onClick={() => setStep(step - 1)}
        >
          Atrás
        </Button>
        {step === 0 ? (
          <Button type="submit" form="report-editor" disabled={busy}>
            {busy ? "Guardando…" : "Guardar y ver vista previa"}
          </Button>
        ) : step === 1 ? (
          <Button
            disabled={busy || dirty || !report.content.some((i) => i.visible)}
            onClick={() =>
              void run(async () => {
                await post("/api/documents/generate", { id: report.id });
                const r = await apiResult(downloadLink(report.id, "report"));
                if (!r.ok) throw new Error(r.error);
                setPreviewUrl(r.data);
                setStep(2);
                onSaved();
              })
            }
          >
            {busy ? "Generando…" : "Generar PDF"}
          </Button>
        ) : (
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await apiResult(sendReport({ id: report.id, via }));
                if (!r.ok) throw new Error(r.error);
                setMessage(
                  r.data.dryRun
                    ? "Modo de prueba: envío registrado, sin mensaje real."
                    : "Envío aceptado por el proveedor.",
                );
                setReport({ ...report, sentAt: new Date(), sentVia: via });
                onSaved();
              })
            }
          >
            {busy ? "Enviando…" : "Enviar al paciente"}
          </Button>
        )}
      </div>
    </div>
  );
}
