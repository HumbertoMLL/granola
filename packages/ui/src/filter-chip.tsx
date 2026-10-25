"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "./lib/utils";

export function FilterChip({ pressed, onPressedChange, children, className, ...props }: Omit<React.ComponentProps<"button">, "onChange" | "aria-pressed"> & {
  pressed: boolean; onPressedChange: (pressed: boolean) => void;
}) {
  return <button {...props} type="button" aria-pressed={pressed} onClick={() => onPressedChange(!pressed)}
    className={cn("min-h-11 rounded-full border px-4 text-sm font-medium", pressed ? "border-primary bg-primary-soft text-primary" : "border-border bg-card", className)}>{children}</button>;
}

export function AppliedFilters({ filters, onRemove, onClear, count }: {
  filters: readonly { id: string; label: string }[]; onRemove: (id: string) => void; onClear: () => void; count: number;
}) {
  return <section aria-label="Filtros aplicados" className="flex flex-wrap items-center gap-2">
    <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{count} {count === 1 ? "resultado" : "resultados"}</p>
    <ul className="flex flex-wrap gap-2">{filters.map((filter) => <li key={filter.id}>
      <Button variant="outline" size="sm" onClick={() => onRemove(filter.id)} aria-label={`Quitar filtro ${filter.label}`}>
        {filter.label}<X aria-hidden className="size-3.5" />
      </Button>
    </li>)}</ul>
    {filters.length > 0 && <Button variant="ghost" size="sm" onClick={onClear}>Limpiar todo</Button>}
  </section>;
}
