import { cn } from "./lib/utils";

/** currentStep es un índice basado en cero. Los pasos completos siguen accesibles. */
export function Stepper({
  steps,
  currentStep,
  label = "Progreso de la reserva",
}: {
  steps: readonly string[];
  currentStep: number;
  label?: string;
}) {
  const active = Math.max(0, Math.min(currentStep, steps.length - 1));
  return (
    <div className="w-full space-y-3">
      <p aria-hidden="true" className="text-sm text-muted-foreground">
        Paso {active + 1} de {steps.length}
        <span className="mx-2">·</span>
        <span className="font-medium text-foreground">{steps[active]}</span>
      </p>
      <ol aria-label={label} className="flex w-full gap-1">
        {steps.map((step, i) => (
          <li
            key={step}
            aria-current={i === active ? "step" : undefined}
            data-state={
              i < active ? "completed" : i === active ? "current" : "pending"
            }
            className={cn(
              "h-1 min-w-0 flex-1 rounded-md",
              i <= active ? "bg-primary" : "bg-border",
            )}
          >
            <span className="sr-only">
              Paso {i + 1} de {steps.length}: {step}
              {i < active ? ", completado" : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
