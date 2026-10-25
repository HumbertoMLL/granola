import Link from "next/link";

import { Button } from "@granola/ui";

type Props = {
  nutritionistName: string;
  nutritionistSlug: string;
  /** "sent": la acaba de enviar. "already": ya existía. */
  variant: "sent" | "already";
};

/** Pantalla final de /resena: sirve tanto en servidor (ya reseñó) como tras enviar. */
export function ReviewThanks({
  nutritionistName,
  nutritionistSlug,
  variant,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {variant === "sent"
            ? "¡Gracias por tu reseña!"
            : "Gracias, ya dejaste tu reseña"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {variant === "sent"
            ? `Se la hicimos llegar a ${nutritionistName}.`
            : `${nutritionistName} ya la recibió. Solo se puede dejar una por cita.`}
        </p>
      </div>
      <Button asChild variant="outline" size="lg">
        <Link href={`/${nutritionistSlug}`}>
          Ver la página de {nutritionistName}
        </Link>
      </Button>
    </div>
  );
}
