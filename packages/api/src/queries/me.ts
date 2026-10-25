import { and, appointments, asc, db, eq, gte, lt, nutritionists } from "@granola/db";

import type { Nutritionist } from "../env";

/** Fila completa del nutri dueño de la sesión (uso interno; la ruta filtra campos). */
export async function findNutritionistByUserId(userId: string): Promise<Nutritionist | null> {
  const row = await db.query.nutritionists.findFirst({ where: eq(nutritionists.userId, userId) });
  return row ?? null;
}

export type MeAppointment = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: "pending_payment" | "confirmed" | "cancelled" | "no_show" | "completed";
  modality: "online" | "presencial";
  meetUrl: string | null;
  notes: string | null;
  patient: { id: string; name: string };
  service: { id: string; name: string; durationMin: number };
};

/** Citas del nutri que empiezan en [from, to). Siempre filtrado por `nutritionistId`. */
export async function listAppointments(nutritionistId: string, from: Date, to: Date): Promise<MeAppointment[]> {
  return db.query.appointments.findMany({
    where: and(
      eq(appointments.nutritionistId, nutritionistId),
      gte(appointments.startsAt, from),
      lt(appointments.startsAt, to),
    ),
    orderBy: [asc(appointments.startsAt)],
    columns: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      modality: true,
      meetUrl: true,
      notes: true,
    },
    with: {
      patient: { columns: { id: true, name: true } },
      service: { columns: { id: true, name: true, durationMin: true } },
    },
  });
}
