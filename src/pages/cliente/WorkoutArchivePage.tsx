import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, isAfter, isBefore } from "date-fns";
import { it } from "date-fns/locale";
import { Archive, CalendarDays, ChevronRight, Dumbbell, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getOfflineCache, setOfflineCache } from "@/lib/offlineSync";
import ClientLayout from "@/components/coaching/ClientLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface ArchivedPlan {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: string | null;
  plan_type: string | null;
}

const WorkoutArchivePage = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<ArchivedPlan[]>([]);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      if (!profile?.user_id) return;
      setLoading(true);
      const cacheKey = `workout-archive:${profile.user_id}`;
      const cached = await getOfflineCache<ArchivedPlan[]>(cacheKey);

      if (cached) {
        setPlans(cached.value);
        setFromCache(true);
      }

      if (!navigator.onLine) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("workout_plans")
          .select("id, name, description, start_date, end_date, status, plan_type")
          .eq("client_id", profile.user_id)
          .is("deleted_at" as any, null)
          .order("end_date", { ascending: false });

        if (error) throw error;
        const normalized = (data || []) as ArchivedPlan[];
        setPlans(normalized);
        setFromCache(false);
        await setOfflineCache(cacheKey, normalized);
      } catch {
        if (!cached) setPlans([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchPlans();
  }, [profile?.user_id]);

  const getPlanState = (plan: ArchivedPlan) => {
    const now = new Date();
    const start = new Date(plan.start_date);
    const end = new Date(plan.end_date);

    if (plan.status === "in_pausa") return { label: "In pausa", variant: "secondary" as const };
    if (isBefore(now, start)) return { label: "Programmata", variant: "outline" as const };
    if (isAfter(now, end)) return { label: "Conclusa", variant: "outline" as const };
    return { label: "Attiva", variant: "default" as const };
  };

  return (
    <ClientLayout title="ARCHIVIO">
      {loading && !plans.length ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-5">
          <section>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Archive className="h-6 w-6" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-3xl tracking-wide">LE TUE SCHEDE</h2>
              {fromCache && <Badge variant="outline">Disponibili offline</Badge>}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Consulta le schede attive e quelle concluse. Le indicazioni del coach restano sempre disponibili.
            </p>
          </section>

          {plans.length === 0 ? (
            <Card className="rounded-3xl border-dashed">
              <CardContent className="py-12 text-center">
                <Dumbbell className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="font-medium">Nessuna scheda disponibile</p>
                <p className="mt-1 text-sm text-muted-foreground">Le schede assegnate compariranno qui.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => {
                const state = getPlanState(plan);
                return (
                  <Link key={plan.id} to={`/coaching/scheda?planId=${plan.id}`} className="block">
                    <Card className="rounded-2xl transition active:scale-[0.99]">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Dumbbell className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="break-words font-semibold">{plan.name}</h3>
                              <Badge variant={state.variant} className="rounded-full text-[10px]">{state.label}</Badge>
                            </div>
                            {plan.description && (
                              <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                                {plan.description}
                              </p>
                            )}
                            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                              <CalendarDays className="h-3.5 w-3.5" />
                              <span>{format(new Date(plan.start_date), "d MMM yyyy", { locale: it })}</span>
                              <span>–</span>
                              <span>{format(new Date(plan.end_date), "d MMM yyyy", { locale: it })}</span>
                            </div>
                          </div>
                          <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </ClientLayout>
  );
};

export default WorkoutArchivePage;
