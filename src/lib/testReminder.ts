import { supabase } from "@/integrations/supabase/client";
import { format, subDays, parseISO, addHours } from "date-fns";

/**
 * Crea/aggiorna/elimina l'appuntamento "Prepara Test" sul calendario del coach
 * collegato a una scheda di allenamento.
 *
 * - Se reminderDays = 0 → elimina l'eventuale appuntamento esistente
 * - Se esiste già un appuntamento (reminder_appointment_id) → lo aggiorna
 * - Altrimenti → ne crea uno nuovo e salva il riferimento sulla scheda
 */
export async function syncTestReminderAppointment(params: {
  planId: string;
  coachId: string;
  clientId: string;
  endDate: string; // yyyy-MM-dd
  reminderDays: number;
  planType?: string;
}) {
  const { planId, coachId, clientId, endDate, reminderDays, planType } = params;

  // Ignora i piani di tipo "test" — il reminder vale solo per le schede vere
  if (planType === "test") return;

  // Recupera il riferimento attuale
  const { data: planRow } = await supabase
    .from("workout_plans")
    .select("reminder_appointment_id, name")
    .eq("id", planId)
    .single<{ reminder_appointment_id: string | null; name: string }>();

  const existingAppointmentId = planRow?.reminder_appointment_id;

  // Se preavviso disattivato → elimina eventuale appuntamento e svuota riferimento
  if (!reminderDays || reminderDays <= 0) {
    if (existingAppointmentId) {
      await supabase.from("appointments").delete().eq("id", existingAppointmentId);
      await supabase
        .from("workout_plans")
        .update({ reminder_appointment_id: null } as any)
        .eq("id", planId);
    }
    return;
  }

  // Calcola la data del reminder: N giorni prima della scadenza, alle 09:00
  const reminderDate = subDays(parseISO(endDate), reminderDays);
  const startTime = new Date(
    reminderDate.getFullYear(),
    reminderDate.getMonth(),
    reminderDate.getDate(),
    9,
    0,
    0
  );
  const endTime = addHours(startTime, 1);

  // Recupera nome cliente
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("user_id", clientId)
    .single();

  const clientName = clientProfile
    ? `${clientProfile.first_name} ${clientProfile.last_name}`
    : "Cliente";

  // IMPORTANTE: niente client_id → l'appuntamento resta privato del coach
  // (le RLS appointments rendono visibili al cliente solo gli appuntamenti dove client_id = auth.uid()).
  const appointmentData = {
    coach_id: coachId,
    client_id: null as any,
    title: `🧪 Prepara test — ${clientName}`,
    description: `Scheda "${planRow?.name || ""}" in scadenza il ${format(parseISO(endDate), "dd/MM/yyyy")}. Prepara il test di valutazione.`,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    color: "#f97316",
    location: null,
  };

  if (existingAppointmentId) {
    // Update appuntamento esistente
    const { error } = await supabase
      .from("appointments")
      .update(appointmentData)
      .eq("id", existingAppointmentId);

    // Se l'update fallisce (es. record cancellato manualmente), ricrea
    if (error) {
      const { data: newApt } = await supabase
        .from("appointments")
        .insert(appointmentData)
        .select("id")
        .single();
      if (newApt) {
        await supabase
          .from("workout_plans")
          .update({ reminder_appointment_id: newApt.id } as any)
          .eq("id", planId);
      }
    }
  } else {
    // Crea nuovo appuntamento
    const { data: newApt } = await supabase
      .from("appointments")
      .insert(appointmentData)
      .select("id")
      .single();
    if (newApt) {
      await supabase
        .from("workout_plans")
        .update({ reminder_appointment_id: newApt.id } as any)
        .eq("id", planId);
    }
  }
}

/**
 * Elimina l'appuntamento collegato a una scheda (chiamare prima di eliminare la scheda)
 */
export async function deleteTestReminderAppointment(planId: string) {
  const { data } = await supabase
    .from("workout_plans")
    .select("reminder_appointment_id")
    .eq("id", planId)
    .single<{ reminder_appointment_id: string | null }>();

  if (data?.reminder_appointment_id) {
    await supabase.from("appointments").delete().eq("id", data.reminder_appointment_id);
  }
}

/**
 * Genera retroattivamente i reminder per tutte le schede attive con scadenza futura
 * che non hanno ancora un reminder_appointment_id
 */
export async function backfillTestReminders(): Promise<{ created: number; skipped: number }> {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: plans } = await supabase
    .from("workout_plans")
    .select("id, coach_id, client_id, end_date, plan_type, reminder_appointment_id, test_reminder_days")
    .eq("is_active", true)
    .gte("end_date", today)
    .is("deleted_at" as any, null);

  if (!plans) return { created: 0, skipped: 0 };

  let created = 0;
  let skipped = 0;

  for (const p of plans as any[]) {
    if (p.plan_type === "test") {
      skipped++;
      continue;
    }
    if (p.reminder_appointment_id) {
      skipped++;
      continue;
    }
    const reminderDays = p.test_reminder_days ?? 7;
    if (reminderDays <= 0) {
      skipped++;
      continue;
    }
    await syncTestReminderAppointment({
      planId: p.id,
      coachId: p.coach_id,
      clientId: p.client_id,
      endDate: p.end_date,
      reminderDays,
      planType: p.plan_type,
    });
    created++;
  }

  return { created, skipped };
}
