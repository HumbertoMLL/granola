import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Badge, EmptyState, cn } from "@granola/ui";

type ComingSoonCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
};

/** Estado vacío estándar para módulos que aún no existen. */
export function ComingSoonCard({
  icon: Icon,
  title,
  description,
  className,
  children,
}: ComingSoonCardProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      className={cn("bg-card/60", className)}
      action={
        <>
          <Icon className="size-6 text-muted-foreground" aria-hidden />
          <Badge variant="accent">Próximamente</Badge>
          {children}
        </>
      }
    />
  );
}
