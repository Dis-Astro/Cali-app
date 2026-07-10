import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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

  useEffect(() => {
    const resolveCoach = async () => {
      if (!profile?.user_id) return;
      setLoadingCoach(true);

      const { data: plans } = await supabase
        .from("workout_plans")
        .select("coach_id")
        .eq("client_id", profile.user_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (plans?.[0]?.coach_id) {
        setCoachId(plans[0].coach_id);
        setLoadingCoach(false);
        return;
      }

      const { data: assignments } = await supabase
        .from("coach_assignments")
        .select("coach_id")
        .eq("client_id", profile.user_id)
        .order("is_primary", { ascending: false })
        .order("assigned_at", { ascending: false })
        .limit(1);

      setCoachId(assignments?.[0]?.coach_id || null);
      setLoadingCoach(false);
    };

    resolveCoach();
  }, [profile?.user_id]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!profile?.user_id || !coachId) {
      toast({
        title: "Coach non disponibile",
        description: "Contatta la reception per associare un coach al tuo profilo.",
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
    const { error } = await supabase.from("error_reports").insert({
      client_id: profile.user_id,
      coach_id: coachId,
      title: title.trim(),
      description: description.trim(),
      status: "aperta",
    });

    if (error) {
      toast({
        title: "Invio non riuscito",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setTitle("");
      setDescription("");
      toast({
        title: "Segnalazione inviata",
        description: "Il coach ha ricevuto la tua richiesta.",
      });
    }

    setSubmitting(false);
  };

  return (
    <div className="app-screen bg-background">
      <header className="border-b border-border bg-card native-safe-x">
        <div className="mx-auto flex max-w-3xl items-center gap-3 py-4">
          <Link
            to="/coaching"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-secondary"
            aria-label="Torna alla dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary">Super Power Gym</p>
            <h1 className="font-display text-xl tracking-wider">SEGNALA UN PROBLEMA</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 native-safe-x">
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <AlertTriangle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="font-display text-2xl tracking-wider">Come possiamo aiutarti?</CardTitle>
            <CardDescription>
              Descrivi un problema relativo alla scheda, agli esercizi o agli appuntamenti. La segnalazione verrà inviata al tuo coach.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="report-title" className="mb-2 block text-sm font-medium">
                  Titolo
                </label>
                <Input
                  id="report-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Esempio: esercizio non chiaro"
                  maxLength={120}
                />
              </div>

              <div>
                <label htmlFor="report-description" className="mb-2 block text-sm font-medium">
                  Descrizione
                </label>
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
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  Non risulta ancora un coach associato al tuo profilo. Contatta la reception.
                </p>
              )}

              <Button
                type="submit"
                className="w-full gap-2 font-display text-lg tracking-wider"
                disabled={submitting || loadingCoach || !coachId}
              >
                {submitting || loadingCoach ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                {submitting ? "INVIO IN CORSO..." : "INVIA SEGNALAZIONE"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ReportProblemPage;
