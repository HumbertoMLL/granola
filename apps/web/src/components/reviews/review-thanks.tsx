import Link from "next/link";
import { Heart } from "lucide-react";

import { Button, Card } from "@granola/ui";

type Props = {
  nutritionistName: string;
  nutritionistSlug: string;
  /** "sent": la acaba de enviar. "already": ya existía. */
  variant: "sent" | "already";
};

/** Pantalla final de /resena: sirve tanto en servidor (ya reseñó) como tras enviar. */
export function ReviewThanks({ nutritionistName, nutritionistSlug, variant }: Props) {
  return (
    <Card className="items-center gap-4 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Heart className="size-7" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {variant === "sent" ? "¡Gracias por tu reseña!" : "Gracias, ya dejaste tu reseña"}
        </h1>
        <p className="text-muted-foreground">
          {variant === "sent"
            ? `Se la hicimos llegar a ${nutritionistName}.`
            : `${nutritionistName} ya la recibió. Solo se puede dejar una por cita.`}
        </p>
      </div>
      <Button asChild variant="outline" size="lg">
        <Link href={`/${nutritionistSlug}`}>Ver la página de {nutritionistName}</Link>
      </Button>
    </Card>
  );
}
