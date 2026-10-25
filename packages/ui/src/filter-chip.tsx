"use client";
import * as React from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "./lib/utils";

export function FilterChip({
  pressed,
  onPressedChange,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange" | "aria-pressed"> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}) {
  return (
    <button
      {...props}
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "relative inline-flex min-h-11 items-center justify-center px-3 text-sm font-medium transition-colors duration-150 before:absolute before:inset-x-0 before:inset-y-2 before:rounded-md before:border before:content-[''] md:min-h-7 md:before:inset-y-0",
        pressed
          ? "text-foreground before:border-foreground/20 before:bg-secondary"
          : "text-muted-foreground before:border-border before:bg-transparent hover:text-foreground",
        className,
      )}
    >
      <span className="relative">{children}</span>
    </button>
  );
}
export function AppliedFilters({
  filters,
  onRemove,
  onClear,
  count,
}: {
  filters: readonly { id: string; label: string }[];
  onRemove: (id: string) => void;
  onClear: () => void;
  count: number;
}) {
  return (
    <section
      aria-label="Filtros aplicados"
      className="flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground tabular-nums"
      >
        {count} {count === 1 ? "resultado" : "resultados"}
      </p>
      <ul className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <li key={filter.id}>
            <Button
              variant="outline"
              size="sm"
              className="md:h-7"
              onClick={() => onRemove(filter.id)}
              aria-label={`Quitar filtro ${filter.label}`}
            >
              {filter.label}
              <X aria-hidden className="size-3" />
            </Button>
          </li>
        ))}
      </ul>
      {filters.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground md:h-7"
          onClick={onClear}
        >
          Limpiar todo
        </Button>
      ) : null}
    </section>
  );
}
