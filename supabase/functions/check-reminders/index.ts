import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Recupera utente corrente
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Utente non trovato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const now = new Date();
    const notificationsSent: string[] = [];

    // Controlla abbonamento in scadenza
    const { data: subscriptions } = await supabaseClient
      .from("subscriptions")
      .select("end_date, plan:membership_plans(name)")
      .eq("user_id", userId)
      .eq("status", "attivo")
      .order("end_date", { ascending: false })
      .limit(1);

    if (subscriptions && subscriptions.length > 0) {
      const sub = subscriptions[0];
      const endDate = new Date(sub.end_date);
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft <= 7 && daysLeft > 0) {
        // Verifica se già notificato nelle ultime 24 ore
        const { data: existing } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "subscription_expiry")
          .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!existing || existing.length === 0) {
          const planName = (sub.plan as any)?.name || "abbonamento";
          await sendPushViaFunction(supabaseAdmin, userId, {
            title: "⚠️ Abbonamento in scadenza",
            body: `Il tuo ${planName} scade tra ${daysLeft} giorn${daysLeft === 1 ? "o" : "i"}. Rinnova subito!`,
            type: "subscription_expiry",
            data: { daysLeft: String(daysLeft), screen: "/coaching" },
          });
          notificationsSent.push("subscription_expiry");
        }
      }
    }

    // Controlla scheda in scadenza
    const { data: plans } = await supabaseClient
      .from("workout_plans")
      .select("id, name, end_date")
      .eq("client_id", userId)
      .eq("is_active", true)
      .order("end_date", { ascending: false })
      .limit(1);

    if (plans && plans.length > 0) {
      const plan = plans[0];
      const endDate = new Date(plan.end_date);
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft <= 7 && daysLeft > 0) {
        const { data: existing } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "workout_plan_expiry")
          .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!existing || existing.length === 0) {
          await sendPushViaFunction(supabaseAdmin, userId, {
            title: "🏋️ Scheda in scadenza",
            body: `La tua scheda "${plan.name}" scade tra ${daysLeft} giorn${daysLeft === 1 ? "o" : "i"}. Contatta il tuo coach!`,
            type: "workout_plan_expiry",
            data: { planId: plan.id, screen: "/coaching/scheda" },
          });
          notificationsSent.push("workout_plan_expiry");
        }
      }
    }

    // Controlla appuntamenti domani (o oggi)
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const { data: tomorrowAppointments } = await supabaseClient
      .from("appointments")
      .select("id, title, start_time")
      .eq("client_id", userId)
      .gte("start_time", tomorrow.toISOString())
      .lt("start_time", dayAfter.toISOString())
      .limit(3);

    if (tomorrowAppointments && tomorrowAppointments.length > 0) {
      const { data: existing } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "appointment_reminder")
        .gte("created_at", new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!existing || existing.length === 0) {
        const first = tomorrowAppointments[0];
        const timeStr = new Date(first.start_time).toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const extra = tomorrowAppointments.length > 1 ? ` (+${tomorrowAppointments.length - 1} altri)` : "";
        await sendPushViaFunction(supabaseAdmin, userId, {
          title: "📅 Appuntamento domani",
          body: `${first.title} alle ${timeStr}${extra}`,
          type: "appointment_reminder",
          data: { appointmentId: first.id, screen: "/coaching/appuntamenti" },
        });
        notificationsSent.push("appointment_reminder");
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: notificationsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Errore check-reminders:", error);
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendPushViaFunction(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  payload: { title: string; body: string; type: string; data?: Record<string, string> }
) {
  // Salva notifica nel DB
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    title: payload.title,
    body: payload.body,
    type: payload.type,
    data: payload.data || {},
  });

  // Recupera token FCM
  const { data: tokens } = await supabaseAdmin
    .from("device_tokens")
    .select("token")
    .eq("user_id", userId);

  if (!tokens || tokens.length === 0) return;

  // Chiama la Edge Function send-push-notification
  await supabaseAdmin.functions.invoke("send-push-notification", {
    body: { userId, ...payload },
  });
}
