import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getOfflineCache, queueErrorReport, setOfflineCache } from "@/lib/offlineSync";
import ClientLayout from "@/components/coaching/ClientLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const ReportProblemPage = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coachId, setCoachId] = useState<string | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [coachFromCache, setCoachFromCache] = useState(false);

  useEffect(() => {
    const resolveCoach = async () => {
      if (!profile?.user_id) return;
      setLoadingCoach(true);
      const cacheKey = `coach-assignment:${profile.user_id}`;
      const cached = await getOfflineCache<string | null>(cacheKey);

      if (cached?.value) {
        setCoachId(cached.value);
        setCoachFromCache(true);
      }

      if (!navigator.onLine) {
        setLoadingCoach(false);
        return;
      }

      try {
        const { data: plans, error: planError } = await supabase
          .from("workout_plans")
          .select("coach_id")
          .eq("client_id", profile.user_id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);
        if (planError) throw planError;

        let resolvedCoachId = plans?.[0]?.coach_id || null;

        if (!resolvedCoachId) {
          const { data: assignments, error: assignmentError } = await supabase
            .from("coach_assignments")
            .select("coach_id")
            .eq("client_id", profile.user_id)
            .order("is_primary", { ascending: false })
            .order("assigned_at", { ascending: false })
            .limit(1);
          if (assignmentError) throw assignmentError;
          resolvedCoachId = assignments?.[0]?.coach_id || null;
        }

        setCoachId(resolvedCoachId);
        setCoachFromCache(false);
        await setOfflineCache(cacheKey, resolvedCoachId);
      } catch {
        if (!cached?.value) setCoachId(null);
      } finally {
        setLoadingCoach(false);
      }
    };

    void resolveCoach();
  }, [profile?.user_id]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!profile?.user_id || !coachId) {
      toast({
        title: "Coach non disponibile",
        description: "Collegati almeno una volta oppure contatta la reception per associare un coach.",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim() || !description.trim()) {
      toast({
        title: "Dati mancanti",
        description: "Inserisci titolo e descrizione del problema.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await queueErrorReport({
        clientId: profile.user_id,
        coachId,
        title: title.trim(),
        description: description.trim(),
        localId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });

      setTitle("");
      setDescription("");
      toast({
        title: result.synced ? "Segnalazione inviata" : "Segnalazione salvata offline",
        description: result.synced
          ? "Il coach ha ricevuto la tua richiesta."
          : "Verrà inviata automaticamente appena torna la connessione.",
      });
    } catch (error) {
      toast({
        title: "Salvataggio non riuscito",
        description: error instanceof Error ? error.message : "Riprova tra poco.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ClientLayout title="AIUTO">
      <div className="mx-auto max-w-2xl">
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <AlertTriangle className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-display text-2xl tracking-wider">Come possiamo aiutarti?</CardTitle>
              {coachFromCache && <Badge variant="outline">Coach disponibile offline</Badge>}
            </div>
            <CardDescription>
              Descrivi un problema relativo alla scheda, agli esercizi o agli appuntamenti. Anche senza rete, la richiesta viene salvata sul dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="report-title" className="mb-2 block text-sm font-medium">Titolo</label>
                <Input
                  id="report-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Esempio: esercizio non chiaro"
                  maxLength={120}
                />
              </div>

              <div>
                <label htmlFor="report-description" className="mb-2 block text-sm font-medium">Descrizione</label>
                <Textarea
                  id="report-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Spiega cosa succede e in quale sezione dell'app."
                  rows={7}
                  maxLength={2000}
                />
              </div>

              {!loadingCoach && !coachId && (
                <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  Non risulta un coach memorizzato. Collegati alla rete almeno una volta oppure contatta la reception.
                </p>
              )}

              <Button
                type="submit"
                className="h-12 w-full gap-2 rounded-2xl font-display text-lg tracking-wider"
                disabled={submitting || loadingCoach || !coachId}
              >
                {submitting || loadingCoach ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                {submitting ? "SALVATAGGIO..." : navigator.onLine ? "INVIA SEGNALAZIONE" : "SALVA E INVIA DOPO"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ReportProblemPage;
