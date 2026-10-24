import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Badge, Card, cn } from "@granola/ui";

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
    <Card
      className={cn(
        "items-center justify-center gap-3 border-dashed bg-card/60 px-6 py-12 text-center shadow-none",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      <Badge variant="accent">Próximamente</Badge>
      {children}
    </Card>
  );
}
