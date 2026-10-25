import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "./lib/utils";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  return (
    <section
      aria-labelledby={id}
      data-slot="empty-state"
      className={cn("flex flex-wrap items-center gap-4 py-6", className)}
    >
      <div
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground [&_svg]:size-5"
      >
        {icon ?? <Inbox />}
      </div>
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-base font-medium">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}
