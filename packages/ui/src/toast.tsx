"use client";

import { Toaster as Sonner, toast, type ToasterProps } from "sonner";
import {
  CheckCircle2,
  CircleAlert,
  Info,
  Loader2,
  TriangleAlert,
} from "lucide-react";

/**
 * Toaster de Granola (sonner). Montar una sola vez en el root layout.
 * Uso: `toast.success("Cita confirmada")`.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      richColors={false}
      closeButton
      icons={{
        success: (
          <CheckCircle2 className="size-4 text-status-confirmed-foreground" />
        ),
        info: <Info className="size-4 text-status-pending-foreground" />,
        warning: (
          <TriangleAlert className="size-4 text-status-pending-foreground" />
        ),
        error: <CircleAlert className="size-4 text-destructive-ink" />,
        loading: (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-border !bg-card !text-card-foreground !shadow-float !font-sans",
          title: "!text-sm !font-semibold",
          description: "!text-sm !text-muted-foreground",
          actionButton:
            "!rounded-md !bg-primary !text-status-confirmed-foreground-foreground",
          cancelButton: "!rounded-md !bg-secondary !text-secondary-foreground",
          closeButton: "!border-border !bg-card !text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
