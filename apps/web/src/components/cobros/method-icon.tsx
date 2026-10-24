import { Banknote, CreditCard, Landmark, Store, type LucideIcon } from "lucide-react";

import { Badge, cn } from "@granola/ui";

import { METHOD_LABEL, STATUS_LABEL } from "./format";

type Method = keyof typeof METHOD_LABEL;
type Status = keyof typeof STATUS_LABEL;

const ICON: Record<Method, LucideIcon> = {
  card: CreditCard,
  spei: Landmark,
  oxxo: Store,
  cash: Banknote,
};

export function MethodIcon({ method, className }: { method: Method; className?: string }) {
  const Icon = ICON[method];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <Icon className="size-4 text-muted-foreground" aria-hidden />
      {METHOD_LABEL[method]}
    </span>
  );
}

const STATUS_VARIANT: Record<Status, "default" | "accent" | "destructive" | "secondary" | "outline"> = {
  paid: "default",
  pending: "accent",
  failed: "destructive",
  expired: "secondary",
  refunded: "outline",
};

export function StatusBadge({ status }: { status: Status }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
