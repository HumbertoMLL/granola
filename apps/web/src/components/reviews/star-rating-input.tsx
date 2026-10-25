"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { cn } from "@granola/ui";

import { RATING_LABEL } from "./review-schema";

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** Texto del <legend> (lectores de pantalla y visible). */
  legend: string;
  name?: string;
  disabled?: boolean;
};

/**
 * Calificación 1–5 accesible: un grupo de radios nativos (flechas del teclado,
 * Tab entra/sale del grupo, lector de pantalla anuncia "3 estrellas, Buena")
 * con estrellas grandes como etiqueta visual. Pensado para tocar con el pulgar.
 */
export function StarRatingInput({
  value,
  onChange,
  legend,
  name = "rating",
  disabled,
}: Props) {
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <fieldset className="flex flex-col items-start gap-2" disabled={disabled}>
      <legend className="mb-3 text-sm font-medium">{legend}</legend>
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= shown;
          return (
            <label
              key={n}
              onMouseEnter={() => setHover(n)}
              className={cn(
                "flex size-12 cursor-pointer items-center justify-center rounded-md transition-colors duration-150",
                "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/40 has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-background",
              )}
            >
              <input
                type="radio"
                name={name}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                className="sr-only"
              />
              <Star
                aria-hidden
                className={cn(
                  "size-8 transition-colors",
                  filled
                    ? "fill-accent text-accent"
                    : "fill-transparent text-muted-foreground",
                )}
                strokeWidth={1.75}
              />
              <span className="sr-only">
                {n} {n === 1 ? "estrella" : "estrellas"}, {RATING_LABEL[n]}
              </span>
            </label>
          );
        })}
      </div>
      <p className="min-h-4 text-sm text-muted-foreground" aria-hidden>
        {shown ? RATING_LABEL[shown] : "Toca una estrella"}
      </p>
    </fieldset>
  );
}
