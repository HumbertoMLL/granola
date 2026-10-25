import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium leading-none [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-status-done-foreground",
        accent:
          "border-transparent bg-status-pending-soft text-status-pending-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-status-cancelled-soft text-status-cancelled-foreground",
        outline: "border-border bg-transparent text-foreground",
        solid: "border-transparent bg-status-confirmed text-white",
        confirmed:
          "border-transparent bg-status-confirmed-soft text-status-confirmed-foreground",
        pending:
          "border-transparent bg-status-pending-soft text-status-pending-foreground",
        done: "border-transparent bg-status-done-soft text-status-done-foreground",
        cancelled:
          "border-transparent bg-status-cancelled-soft text-status-cancelled-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}
function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      data-variant={variant ?? "default"}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
export { Badge, badgeVariants };
