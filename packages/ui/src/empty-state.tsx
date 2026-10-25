import * as React from "react";
import { cn } from "./lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center",
        className,
      )}
    >
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </section>
  );
}
