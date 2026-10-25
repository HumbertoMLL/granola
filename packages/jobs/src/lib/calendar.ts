import { and, appointments, db, eq } from "@granola/db";
import { calendarEventId, clearCalendarBusyCache, createGoogleCalendarClient, GoogleCalendarError } from "@granola/google-calendar";

/** Se ejecuta dentro de step.run; los secretos no viajan en snapshots de Inngest. */
export async function syncAppointmentCalendar(
  appointmentId: string,
  nutritionistId: string,
  operation: "confirmed" | "cancelled" | "rescheduled",
): Promise<{ synced?: true; skipped?: true; failed?: true }> {
  try {
    const row = await db.query.appointments.findFirst({
      where: and(eq(appointments.id, appointmentId), eq(appointments.nutritionistId, nutritionistId)),
      with: { nutritionist: { columns: { googleRefreshTokenEnc: true, timezone: true } } },
    });
    if (!row?.nutritionist.googleRefreshTokenEnc) return { skipped: true };
    if (row.status !== (operation === "cancelled" ? "cancelled" : "confirmed")) return { skipped: true };
    const client = createGoogleCalendarClient(row.nutritionist.googleRefreshTokenEnc);
    const where = and(eq(appointments.id, appointmentId), eq(appointments.nutritionistId, nutritionistId));
    if (operation === "cancelled") {
      await client.deleteEvent(row.googleEventId ?? calendarEventId(row.id));
      await db.update(appointments).set({ googleEventId: null, meetUrl: null, updatedAt: new Date() }).where(where);
    } else {
      // No duplicar en replays; el ID remoto también es determinista si falló el commit local.
      if (operation === "confirmed" && row.googleEventId && (row.modality !== "online" || row.meetUrl)) return { skipped: true };
      const input = { appointmentId, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), timeZone: row.nutritionist.timezone, modality: row.modality };
      const result = row.googleEventId ? await client.updateEvent(row.googleEventId, input) : await client.createEvent(input);
      const saved = await db.update(appointments).set({ googleEventId: result.id, meetUrl: result.meetUrl, updatedAt: new Date() })
        .where(and(where, eq(appointments.status, "confirmed"), eq(appointments.startsAt, row.startsAt), eq(appointments.endsAt, row.endsAt)))
        .returning({ id: appointments.id });
      // Cancelación mientras Google respondía: no dejar un evento huérfano.
      if (!saved.length) {
        const fresh = await db.query.appointments.findFirst({ where, columns: { status: true, startsAt: true, endsAt: true, modality: true } });
        if (!fresh || fresh.status === "cancelled") await client.deleteEvent(result.id);
        else if (fresh.status === "confirmed") {
          const reconciled = await client.updateEvent(result.id, { ...input, startsAt: fresh.startsAt.toISOString(), endsAt: fresh.endsAt.toISOString(), modality: fresh.modality });
          await db.update(appointments).set({ googleEventId: reconciled.id, meetUrl: reconciled.meetUrl, updatedAt: new Date() })
            .where(and(where, eq(appointments.status, "confirmed"), eq(appointments.startsAt, fresh.startsAt), eq(appointments.endsAt, fresh.endsAt)));
        }
      }
    }
    clearCalendarBusyCache(nutritionistId);
    return { synced: true };
  } catch (error) {
    // El fallo queda aislado y sin PII: WhatsApp ya se envió y los recordatorios siguen.
    console.warn("[google-calendar] sincronización no disponible", { operation, status: error instanceof GoogleCalendarError ? error.status : "unavailable" });
    return { failed: true };
  }
}
