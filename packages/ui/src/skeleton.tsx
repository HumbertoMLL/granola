import * as React from "react";
import { cn } from "./lib/utils";
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-secondary", className)}
      {...props}
    />
  );
}
function SkeletonRow({
  avatar = true,
  className,
  ...props
}: React.ComponentProps<"div"> & { avatar?: boolean }) {
  return (
    <div
      data-slot="skeleton-row"
      aria-hidden="true"
      className={cn(
        "flex min-h-16 items-center gap-3 py-3 md:min-h-12 md:py-1",
        className,
      )}
      {...props}
    >
      {avatar ? <Skeleton className="size-9 shrink-0 rounded-full" /> : null}
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48 max-w-full" />
      </div>
      <Skeleton className="h-4 w-12" />
    </div>
  );
}
function SkeletonKPI({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-kpi"
      aria-hidden="true"
      className={cn("space-y-3", className)}
      {...props}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
export { Skeleton, SkeletonRow, SkeletonKPI };
