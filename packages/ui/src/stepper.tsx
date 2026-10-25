import { Check } from "lucide-react";
import { cn } from "./lib/utils";

/** currentStep es un índice basado en cero. */
export function Stepper({ steps, currentStep, label = "Progreso de la reserva" }: {
  steps: readonly string[]; currentStep: number; label?: string;
}) {
  return <ol aria-label={label} className="flex w-full gap-2">{steps.map((step, i) =>
    <li key={step} aria-current={i === currentStep ? "step" : undefined} data-state={i < currentStep ? "completed" : i === currentStep ? "current" : "pending"}
      className={cn("flex min-w-0 flex-1 flex-col gap-2 text-xs", i <= currentStep ? "font-semibold text-primary" : "text-muted-foreground")}>
      <span className={cn("flex size-7 items-center justify-center rounded-full border", i < currentStep && "border-primary bg-primary text-primary-foreground")}>
        {i < currentStep ? <><Check className="size-4" aria-hidden /><span className="sr-only">Paso {i + 1}, completado</span></> : i + 1}
      </span><span>{step}</span>
    </li>)}</ol>;
}
