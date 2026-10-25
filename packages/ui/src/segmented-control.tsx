"use client";

import * as React from "react";
import { cn } from "./lib/utils";

type Option = { value: string; label: React.ReactNode; disabled?: boolean };

/** Selección única; radios nativos conservan navegación con flechas y formularios. */
export function SegmentedControl({ label, value, onValueChange, options, className, disabled = false }: {
  label: string; value: string; onValueChange: (value: string) => void;
  options: readonly Option[]; className?: string; disabled?: boolean;
}) {
  const name = React.useId();
  return <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1 rounded-xl border border-border bg-secondary p-1", className)}>
    {options.map((option) => <label key={option.value} className="relative flex min-w-0 flex-1 cursor-pointer">
      <input type="radio" name={name} value={option.value} checked={value === option.value}
        disabled={disabled || option.disabled} onChange={() => onValueChange(option.value)}
        className="peer sr-only" />
      <span className="flex min-h-11 w-full items-center justify-center rounded-md px-3 text-center text-sm font-medium text-muted-foreground peer-checked:bg-card peer-checked:font-bold peer-checked:text-primary peer-checked:shadow-soft peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50">{option.label}</span>
    </label>)}
  </div>;
}
