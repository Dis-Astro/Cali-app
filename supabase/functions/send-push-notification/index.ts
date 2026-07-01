import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  type?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: PushPayload = await req.json();
    const { userId, title, body, data = {}, type = "info" } = payload;

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: "userId, title e body sono obbligatori" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Salva notifica nel database (storico in-app)
    await supabase.from("notifications").insert({
      user_id: userId,
      title,
      body,
      type,
      data,
    });

    // 2. Recupera token FCM del dispositivo dell'utente
    const { data: tokens, error: tokenError } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", userId);

    if (tokenError || !tokens || tokens.length === 0) {
      // Notifica salvata nel DB ma nessun dispositivo registrato
      return new Response(
        JSON.stringify({ success: true, pushed: false, message: "Nessun dispositivo registrato" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Invia push via FCM HTTP v1 API
    const fcmProjectId = Deno.env.get("FIREBASE_PROJECT_ID");
    const fcmServiceAccount = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

    if (!fcmProjectId || !fcmServiceAccount) {
      console.error("FIREBASE_PROJECT_ID o FIREBASE_SERVICE_ACCOUNT_JSON mancanti");
      return new Response(
        JSON.stringify({ success: true, pushed: false, message: "Firebase non configurato" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ottieni access token tramite Service Account
    const serviceAccount = JSON.parse(fcmServiceAccount);
    const accessToken = await getFirebaseAccessToken(serviceAccount);

    // Invia push a tutti i device token dell'utente
    const results = await Promise.allSettled(
      tokens.map(({ token }) =>
        sendFCMNotification(accessToken, fcmProjectId, token, title, body, data)
      )
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failCount = results.filter((r) => r.status === "rejected").length;

    // Rimuovi token non validi (scaduti/rimossi)
    const invalidTokens: string[] = [];
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        const err = (result as PromiseRejectedResult).reason;
        if (err?.includes("NOT_FOUND") || err?.includes("UNREGISTERED")) {
          invalidTokens.push(tokens[i].token);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await supabase
        .from("device_tokens")
        .delete()
        .in("token", invalidTokens)
        .eq("user_id", userId);
    }

    return new Response(
      JSON.stringify({ success: true, pushed: successCount > 0, sent: successCount, failed: failCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Errore send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getFirebaseAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  // JWT per OAuth2 con Google
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = btoa(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  // Importa la chiave privata RSA
  const privateKeyPem = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(privateKeyPem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signingInput = `${header}.${claimSet}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const { access_token } = await response.json();
  return access_token;
}

async function sendFCMNotification(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<void> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    message: {
      token: deviceToken,
      notification: { title, body },
      data: { ...data, type: data.type || "info" },
      android: {
        notification: {
          icon: "ic_notification",
          color: "#6366f1",
          sound: "default",
          channel_id: "cali_notifications",
        },
        priority: "high",
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
}
