import * as React from "react";
import { cn } from "./lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"header">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-wrap items-center justify-between gap-4",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
      {children}
    </header>
  );
}
export function Toolbar({
  label = "Herramientas",
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & { label?: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="toolbar"
      className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}
export function SectionHeader({
  title,
  description,
  actions,
  as: Heading = "h2",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div
      data-slot="section-header"
      className={cn("flex items-center justify-between gap-4", className)}
      {...props}
    >
      <div className="min-w-0">
        <Heading className="text-lg font-semibold">{title}</Heading>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
export function DataList({
  children,
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="data-list"
      className={cn("divide-y divide-border", className)}
      {...props}
    >
      {children}
    </ul>
  );
}
export function DataRow({
  leading,
  title,
  description,
  trailing,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"li">, "title"> & {
  leading?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <li
      data-slot="data-row"
      className={cn(
        "flex min-h-16 items-center gap-3 py-3 md:min-h-12 md:py-1",
        className,
      )}
      {...props}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      {title || description ? (
        <div className="min-w-0 flex-1">
          {title ? (
            <div className="text-base font-semibold">{title}</div>
          ) : null}
          {description ? (
            <div className="text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
      ) : null}
      {children}
      {trailing ? (
        <div className="ml-auto shrink-0 text-right tabular-nums">
          {trailing}
        </div>
      ) : null}
    </li>
  );
}
export function KPI({
  label,
  value,
  delta,
  trend = "neutral",
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div
      data-slot="kpi"
      className={cn("min-w-0 space-y-2", className)}
      {...props}
    >
      <dl>
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="mt-2 text-3xl font-semibold leading-[1.2] tracking-tight tabular-nums">
          {value}
        </dd>
      </dl>
      {delta !== undefined ? (
        <p
          data-trend={trend}
          className={cn(
            "text-sm tabular-nums",
            trend === "up"
              ? "text-status-confirmed-foreground"
              : trend === "down"
                ? "text-status-cancelled-foreground"
                : "text-muted-foreground",
          )}
        >
          {delta}
        </p>
      ) : null}
      {children}
    </div>
  );
}
