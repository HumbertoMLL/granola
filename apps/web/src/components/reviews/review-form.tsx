"use client";

import * as React from "react";

import { Button, Card, Label, Textarea } from "@granola/ui";

import { submitReview } from "@/app/resena/[cancelToken]/actions";

import { REVIEW_TEXT_MAX } from "./review-schema";
import { ReviewThanks } from "./review-thanks";
import { StarRatingInput } from "./star-rating-input";

type Props = {
  token: string;
  patientFirstName: string;
  nutritionistName: string;
  nutritionistSlug: string;
};

export function ReviewForm({ token, patientFirstName, nutritionistName, nutritionistSlug }: Props) {
  const [rating, setRating] = React.useState(0);
  const [text, setText] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<"sent" | "already" | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (done) {
    return (
      <ReviewThanks
        nutritionistName={nutritionistName}
        nutritionistSlug={nutritionistSlug}
        variant={done}
      />
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating < 1) {
      setError("Elige de 1 a 5 estrellas");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await submitReview({ token, rating, text, isPublic });
      if (res.ok) setDone("sent");
      else if (res.alreadyReviewed) setDone("already");
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">¿Cómo te fue, {patientFirstName}?</h1>
        <p className="text-muted-foreground">
          Tu opinión ayuda a {nutritionistName} y a otras personas que buscan nutrióloga.
        </p>
      </div>

      <Card className="gap-6">
        <StarRatingInput
          value={rating}
          onChange={(v) => {
            setRating(v);
            setError(null);
          }}
          legend={`Califica tu consulta con ${nutritionistName}`}
          disabled={pending}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="review-text">
            Cuéntanos más <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="review-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, REVIEW_TEXT_MAX))}
            maxLength={REVIEW_TEXT_MAX}
            rows={4}
            placeholder="¿Qué te gustó? ¿Qué te llevas de la consulta?"
            disabled={pending}
            aria-describedby="review-text-count"
          />
          <p id="review-text-count" className="self-end text-xs tabular-nums text-muted-foreground">
            {text.length}/{REVIEW_TEXT_MAX}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-secondary/60 p-3 text-sm">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            disabled={pending}
            className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
          />
          <span>
            <span className="font-medium">Mostrar mi reseña en la página pública de {nutritionistName}</span>
            <span className="block text-muted-foreground">Solo se verá tu primer nombre.</span>
          </span>
        </label>
      </Card>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Enviar reseña
      </Button>
    </form>
  );
}
