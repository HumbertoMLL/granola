"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button, Card, Input, Label, Switch, toast } from "@granola/ui";
import { finishOnboarding, saveOnboardingAvailability, saveOnboardingProfile, saveOnboardingService } from "@/app/(panel)/app/onboarding/actions";
import { ruleSchema, type RuleInput } from "@/components/agenda/schemas";
import { WEEKDAY_NAMES } from "@/components/agenda/timezones";

const steps = ["Tu nombre y link", "Tu primer servicio", "Tu disponibilidad", "Tu página lista"];
const template: RuleInput[] = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, startTime: "09:00", endTime: "14:00" }, { weekday, startTime: "16:00", endTime: "19:00" },
]);
const selectClass = "h-11 w-full rounded-xl border border-border bg-card px-3";

export function OnboardingWizard(props: { step: number; displayName: string; slug: string; rules: RuleInput[]; timezone: string; siteUrl: string }) {
  const [pending, startTransition] = useTransition();
  const [rules, setRules] = useState(props.rules.length ? props.rules : template);
  const router = useRouter();
  function run(work: () => Promise<{ ok: boolean; error?: string }>, finish = false) {
    startTransition(async () => {
      try {
        const result = await work();
        if (!result.ok) { toast.error(result.error ?? "Revisa los campos"); return; }
        if (finish) router.replace("/app");
        router.refresh();
      } catch { toast.error("No se pudo guardar. Intenta de nuevo."); }
    });
  }
  const publicUrl = `${props.siteUrl}/${props.slug}`;
  return <div className="mx-auto flex max-w-2xl flex-col gap-6">
    <div><p className="text-sm text-muted-foreground">Paso {props.step + 1} de 4</p><h1 className="mt-2 text-3xl font-semibold">Bienvenida a Granola</h1><p className="mt-2 text-muted-foreground">Deja lista tu página para recibir tus primeras citas.</p></div>
    <ol aria-label="Progreso" className="grid grid-cols-4 gap-2">{steps.map((label, index) => <li key={label} aria-current={index === props.step ? "step" : undefined} className={`border-t-4 pt-2 text-xs ${index <= props.step ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>{label}</li>)}</ol>
    <Card>
      <h2 className="text-xl font-semibold">{steps[props.step]}</h2>
      {props.step === 0 ? <form className="grid gap-3" action={(form) => run(() => saveOnboardingProfile(Object.fromEntries(form)))}>
        <Label htmlFor="public-name">Nombre público</Label><Input id="public-name" name="displayName" defaultValue={props.displayName} required minLength={2} maxLength={60} />
        <Label htmlFor="public-slug">Tu link</Label><Input id="public-slug" name="slug" defaultValue={props.slug} required minLength={3} maxLength={30} autoCapitalize="none" autoCorrect="off" />
        <p className="break-all text-sm text-muted-foreground">{props.siteUrl}/tu-link · Usa letras, números y guiones.</p>
        <Button type="submit" loading={pending}>Guardar y continuar</Button>
      </form> : null}
      {props.step === 1 ? <form className="grid gap-3" action={(form) => run(() => saveOnboardingService({ ...Object.fromEntries(form), isActive: true, description: "" }))}>
        <Label htmlFor="service-name">Nombre del servicio</Label><Input id="service-name" name="name" defaultValue="Primera consulta" required minLength={2} maxLength={80} />
        <Label htmlFor="service-duration">Duración (minutos)</Label><Input id="service-duration" name="durationMin" type="number" min={10} max={480} defaultValue={60} required />
        <Label htmlFor="service-price">Precio (MXN)</Label><Input id="service-price" name="priceMxn" type="number" min={0} max={100000} step="0.01" defaultValue={650} required />
        <Label htmlFor="service-modality">Modalidad</Label><select id="service-modality" name="modality" className={selectClass} defaultValue="online"><option value="online">En línea</option><option value="presencial">Presencial</option><option value="ambas">Ambas</option></select>
        <Label htmlFor="service-location">Dirección (si atiendes presencial)</Label><Input id="service-location" name="location" maxLength={200} />
        <Label htmlFor="service-payment">Forma de cobro</Label><select id="service-payment" name="paymentMode" className={selectClass} defaultValue="at_visit"><option value="at_visit">Pago en consulta</option><option value="optional">Pago en línea opcional</option><option value="prepaid">Pago anticipado</option></select>
        <Button type="submit" loading={pending}>Crear servicio y continuar</Button>
      </form> : null}
      {props.step === 2 ? <form className="grid gap-4" action={() => {
        const parsed = z.array(ruleSchema).max(42).safeParse(rules);
        if (!parsed.success) { toast.error(parsed.error.issues[0]!.message); return; }
        run(() => saveOnboardingAvailability(parsed.data));
      }}>
        <p className="text-sm text-muted-foreground">Horario en {props.timezone}. Plantilla: lunes a viernes de 9 a 14 y de 16 a 19. Puedes editarla antes de guardar.</p>
        <Button type="button" variant="outline" onClick={() => setRules(template)}>Usar plantilla L–V</Button>
        {[1, 2, 3, 4, 5, 6, 0].map((day) => <fieldset key={day} className="grid gap-2 border-b border-border pb-3">
          <legend className="sr-only">{WEEKDAY_NAMES[day]}</legend>
          <div className="flex items-center justify-between"><Label htmlFor={`onboarding-day-${day}`}>{WEEKDAY_NAMES[day]}</Label><Switch id={`onboarding-day-${day}`} checked={rules.some((r) => r.weekday === day)} onCheckedChange={(enabled) => setRules((old) => enabled ? [...old, { weekday: day, startTime: "09:00", endTime: "14:00" }, { weekday: day, startTime: "16:00", endTime: "19:00" }] : old.filter((r) => r.weekday !== day))} /></div>
          {rules.map((rule, index) => rule.weekday === day ? <div key={index} className="flex flex-wrap items-center gap-2">
            <Input className="min-w-0 flex-1" type="time" aria-label={`${WEEKDAY_NAMES[day]} inicio ${index + 1}`} value={rule.startTime} required onChange={(e) => setRules((old) => old.map((r, i) => i === index ? { ...r, startTime: e.target.value } : r))} />
            <span>–</span><Input className="min-w-0 flex-1" type="time" aria-label={`${WEEKDAY_NAMES[day]} fin ${index + 1}`} value={rule.endTime} required onChange={(e) => setRules((old) => old.map((r, i) => i === index ? { ...r, endTime: e.target.value } : r))} />
            <Button size="sm" type="button" variant="ghost" aria-label={`Quitar ventana ${index + 1} del ${WEEKDAY_NAMES[day]}`} onClick={() => setRules((old) => old.filter((_, i) => i !== index))}>Quitar</Button>
          </div> : null)}
          {rules.some((r) => r.weekday === day) ? <Button type="button" size="sm" variant="ghost" onClick={() => setRules((old) => [...old, { weekday: day, startTime: "16:00", endTime: "19:00" }])}>Agregar ventana</Button> : null}
        </fieldset>)}
        <Button className="h-auto min-h-11 whitespace-normal py-2" type="submit" loading={pending}>Guardar disponibilidad y continuar</Button>
      </form> : null}
      {props.step === 3 ? <div className="grid gap-4">
        <p>Tu página está lista para compartir. Puedes personalizarla después desde Mi página.</p>
        <a className="break-all text-primary underline" href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
        <Button variant="outline" onClick={() => { void (async () => {
          try { if (navigator.share) await navigator.share({ title: "Agenda tu consulta", url: publicUrl }); else { await navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); } }
          catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("No se pudo compartir. Copia el link de tu página."); }
        })(); }}>Compartir mi página</Button>
        <Button loading={pending} onClick={() => run(finishOnboarding, true)}>Ir a mi panel</Button>
      </div> : null}
    </Card>
    <Button variant="ghost" disabled={pending} onClick={() => run(finishOnboarding, true)}>Lo hago después</Button>
  </div>;
}
