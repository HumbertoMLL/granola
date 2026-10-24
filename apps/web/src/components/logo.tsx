import * as React from "react";

import { cn } from "@granola/ui";

type LogoMarkProps = React.ComponentProps<"svg">;

/**
 * Isotipo: un grano de avena partido con una hoja que brota.
 * Pensado para fondo claro; hereda `currentColor` para la hoja cuando no se pasa color.
 */
export function LogoMark({ className, ...props }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn("size-8", className)}
      {...props}
    >
      {/* Fondo redondeado color miel suave */}
      <rect width="40" height="40" rx="12" fill="#FBEFD6" />
      {/* Grano de avena (óvalo café) */}
      <path
        d="M20 32.5c-5.2 0-8.5-4.6-8.5-10.4 0-4.2 2.3-8.4 5.4-10.6a1.4 1.4 0 0 1 1.6-.1l1.5 1.1 1.5-1.1a1.4 1.4 0 0 1 1.6.1c3.1 2.2 5.4 6.4 5.4 10.6 0 5.8-3.3 10.4-8.5 10.4Z"
        fill="#E8A93B"
      />
      {/* Surco central del grano */}
      <path
        d="M20 13.5v18"
        stroke="#2B2118"
        strokeOpacity="0.35"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Hoja verde brotando */}
      <path
        d="M20.5 12.5c0-4.6 3.2-7.7 8.1-7.9.3 4.9-2.8 8.1-8.1 7.9Z"
        fill="#4A7A2B"
      />
      <path
        d="M20.5 12.5c1.6-2 3.9-3.5 6.4-4.6"
        stroke="#E9F2E0"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

type LogoProps = React.ComponentProps<"span"> & {
  /** Tamaño del isotipo en px (ancho = alto). */
  size?: number;
  /** Oculta el wordmark y deja solo el isotipo. */
  iconOnly?: boolean;
};

/** Logotipo completo: isotipo + wordmark "granola". */
export function Logo({ className, size = 32, iconOnly = false, ...props }: LogoProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5 text-foreground", className)}
      {...props}
    >
      <LogoMark style={{ width: size, height: size }} className="shrink-0" />
      {iconOnly ? (
        <span className="sr-only">Granola</span>
      ) : (
        <span
          className="font-sans font-extrabold tracking-tight"
          style={{ fontSize: size * 0.72, lineHeight: 1 }}
        >
          granola
        </span>
      )}
    </span>
  );
}
