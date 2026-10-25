"use client";
import { useState } from "react";
import { Button, Input } from "@granola/ui";
import { z } from "zod";
import {
  energyForGoal,
  energyInputSchema,
  totalEnergyExpenditure,
} from "@granola/core/nutrition";

export function NutritionCalculator({
  weight,
  height,
  age,
  sex,
}: {
  weight?: string | null;
  height?: string | null;
  age?: number;
  sex: string | null;
}) {
  const [result, setResult] = useState<{
    mifflin: number;
    harris: number;
    goalMifflin: number;
    goalHarris: number;
  } | null>(null);
  const [error, setError] = useState("");
  return (
    <section className="grid gap-3">
      <h3 className="font-bold">Requerimiento energético (adultos)</h3>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const parsed = energyInputSchema
            .extend({
              goal: z.enum(["deficit", "maintenance", "surplus"]),
              adjustment: z.number().min(0).max(0.5),
            })
            .safeParse({
              weightKg: Number(data.get("weight")),
              heightCm: Number(data.get("height")),
              ageYears: Number(data.get("age")),
              sex: data.get("sex"),
              activityFactor: Number(data.get("activity")),
              goal: data.get("goal"),
              adjustment: Number(data.get("adjustment")) / 100,
            });
          if (!parsed.success) {
            setResult(null);
            setError(
              "Revisa los datos: edad de 18 a 120 años, mediciones positivas y ajuste entre 0 y 50%.",
            );
            return;
          }
          try {
            const d = parsed.data;
            const mifflin = totalEnergyExpenditure(d),
              harris = totalEnergyExpenditure(d, "harris_benedict");
            setResult({
              mifflin,
              harris,
              goalMifflin: energyForGoal(mifflin, d.goal, d.adjustment),
              goalHarris: energyForGoal(harris, d.goal, d.adjustment),
            });
            setError("");
          } catch {
            setResult(null);
            setError(
              "Los datos no permiten calcular un gasto energético positivo.",
            );
          }
        }}
      >
        <label className="grid gap-1 text-sm">
          Peso (kg)
          <Input
            type="number"
            name="weight"
            min="0.01"
            max="600"
            step="0.01"
            required
            defaultValue={weight ?? ""}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Talla (cm)
          <Input
            type="number"
            name="height"
            min="0.1"
            max="250"
            step="0.1"
            required
            defaultValue={height ?? ""}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Edad (años)
          <Input
            type="number"
            name="age"
            min="18"
            max="120"
            step="1"
            required
            defaultValue={age}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Sexo para la ecuación
          <select
            className="h-11 rounded-xl border bg-card px-3"
            name="sex"
            defaultValue={sex === "m" || sex === "f" ? sex : ""}
            required
          >
            <option value="">Selecciona</option>
            <option value="f">Femenino</option>
            <option value="m">Masculino</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Factor de actividad
          <Input
            name="activity"
            type="number"
            min="1"
            max="2.5"
            step="0.001"
            defaultValue="1.2"
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          Objetivo
          <select
            className="h-11 rounded-xl border bg-card px-3"
            name="goal"
            defaultValue="maintenance"
          >
            <option value="deficit">Déficit</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="surplus">Superávit</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Ajuste del GET (%)
          <Input
            name="adjustment"
            type="number"
            min="0"
            max="50"
            step="1"
            defaultValue="20"
            required
          />
        </label>
        <Button variant="outline" className="self-end" type="submit">
          Calcular requerimiento
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        GET = gasto en reposo × factor de actividad. Harris-Benedict revisada
        (1984). El ajuste lo define el profesional; mantenimiento conserva el
        GET.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div aria-live="polite" className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Ecuación</th>
                <th>GET (kcal/día)</th>
                <th>Por objetivo (kcal/día)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Mifflin-St Jeor</td>
                <td>{Math.round(result.mifflin)}</td>
                <td>{Math.round(result.goalMifflin)}</td>
              </tr>
              <tr>
                <td>Harris-Benedict</td>
                <td>{Math.round(result.harris)}</td>
                <td>{Math.round(result.goalHarris)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
