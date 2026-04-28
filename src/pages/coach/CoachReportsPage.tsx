import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  User,
  Loader2,
  Search,
  Dumbbell,
  ChevronRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import CoachLayout from "@/components/coach/CoachLayout";
import LightningRating from "@/components/coaching/LightningRating";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const COLOR_MAP: Record<string, string> = {
  arancione: "#f97316", azzurro: "#38bdf8", verde: "#22c55e",
  giallo: "#eab308", rosso: "#ef4444", blu: "#3b82f6", viola: "#a855f7",
};

function renderColoredText(value: string) {
  const lines = value.split(/(\n)/);
  return lines.map((line, lineIdx) => {
    if (line === "\n") return <br key={`br-${lineIdx}`} />;
    const tokens = line.split(/(\s+)/);
    return tokens.map((token, i) => {
      const color = COLOR_MAP[token.toLowerCase().replace(/[^a-zàèéìòù]/gi, "")];
      if (color) return <span key={`${lineIdx}-${i}`} style={{ color, fontWeight: 700 }}>{token}</span>;
      return <span key={`${lineIdx}-${i}`}>{token}</span>;
    });
  });
}

interface ClientSummary {
  id: string;
  name: string;
  planCount: number;
  feedbackCount: number;
  lastDate: string;
}

interface PlanWithFeedback {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  days: DayWithFeedback[];
}

interface DayWithFeedback {
  day_number: number;
  exercises: ExerciseWithFeedback[];
}

interface ExerciseWithFeedback {
  id: string;
  name: string;
  order_index: number;
  weeks: WeekFeedback[];
}

interface WeekFeedback {
  week_number: number;
  difficulty_rating: number;
  client_notes: string;
  completed_at: string;
}

const CoachReportsPage = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [clientPlans, setClientPlans] = useState<PlanWithFeedback[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [openExercises, setOpenExercises] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q));
  }, [clients, searchQuery]);

  useEffect(() => {
    if (profile?.user_id) fetchClients();
  }, [profile?.user_id]);

  const fetchClients = async () => {
    setLoading(true);

    const { data: plans } = await supabase
      .from("workout_plans")
      .select("id, name, client_id")
      .eq("coach_id", profile?.user_id)
      .is("deleted_at" as any, null);

    if (!plans || plans.length === 0) {
      setClients([]);
      setLoading(false);
      return;
    }

    const planIds = plans.map(p => p.id);
    const clientIds = [...new Set(plans.map(p => p.client_id))];

    const { data: exercises } = await supabase
      .from("workout_plan_exercises")
      .select("id, workout_plan_id")
      .in("workout_plan_id", planIds);

    if (!exercises || exercises.length === 0) {
      setClients([]);
      setLoading(false);
      return;
    }

    const exerciseIds = exercises.map(e => e.id);

    const { data: completions } = await supabase
      .from("workout_completions")
      .select("id, client_id, workout_plan_exercise_id, completed_at, client_notes, difficulty_rating")
      .in("workout_plan_exercise_id", exerciseIds)
      .or("client_notes.not.is.null,difficulty_rating.gt.0");

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .in("user_id", clientIds);

    const userMap = new Map(profiles?.map(p => [p.user_id, `${p.first_name} ${p.last_name}`]) || []);
    const exercisePlanMap = new Map(exercises.map(e => [e.id, e.workout_plan_id]));

    const clientMap = new Map<string, ClientSummary>();
    const clientPlanSets = new Map<string, Set<string>>();

    (completions || []).forEach(c => {
      if (!c.client_notes && (!c.difficulty_rating || c.difficulty_rating <= 0)) return;
      const planId = exercisePlanMap.get(c.workout_plan_exercise_id);
      if (!planId) return;

      if (!clientMap.has(c.client_id)) {
        clientMap.set(c.client_id, {
          id: c.client_id, name: userMap.get(c.client_id) || "Cliente",
          planCount: 0, feedbackCount: 0, lastDate: c.completed_at,
        });
        clientPlanSets.set(c.client_id, new Set());
      }

      const summary = clientMap.get(c.client_id)!;
      summary.feedbackCount++;
      clientPlanSets.get(c.client_id)!.add(planId);
      if (new Date(c.completed_at) > new Date(summary.lastDate)) summary.lastDate = c.completed_at;
    });

    clientPlanSets.forEach((planSet, clientId) => {
      const summary = clientMap.get(clientId);
      if (summary) summary.planCount = planSet.size;
    });

    setClients(Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  };

  const fetchClientPlans = async (clientId: string) => {
    setLoadingPlans(true);

    const { data: plans } = await supabase
      .from("workout_plans")
      .select("id, name, start_date, end_date")
      .eq("client_id", clientId)
      .eq("coach_id", profile?.user_id)
      .is("deleted_at" as any, null)
      .order("start_date", { ascending: false });

    if (!plans || plans.length === 0) {
      setClientPlans([]);
      setLoadingPlans(false);
      return;
    }

    const planIds = plans.map(p => p.id);

    const { data: exercises } = await supabase
      .from("workout_plan_exercises")
      .select("id, exercise_name, day_of_week, order_index, workout_plan_id")
      .in("workout_plan_id", planIds)
      .order("day_of_week").order("order_index");

    const exerciseIds = exercises?.map(e => e.id) || [];

    const { data: completions } = await supabase
      .from("workout_completions")
      .select("*")
      .eq("client_id", clientId)
      .in("workout_plan_exercise_id", exerciseIds)
      .or("client_notes.not.is.null,difficulty_rating.gt.0")
      .order("set_number");

    const completionsByExercise = new Map<string, WeekFeedback[]>();
    (completions || []).forEach(c => {
      if (!c.client_notes && (!c.difficulty_rating || c.difficulty_rating <= 0)) return;
      if (!completionsByExercise.has(c.workout_plan_exercise_id)) completionsByExercise.set(c.workout_plan_exercise_id, []);
      completionsByExercise.get(c.workout_plan_exercise_id)!.push({
        week_number: c.set_number, difficulty_rating: c.difficulty_rating || 0,
        client_notes: c.client_notes || "", completed_at: c.completed_at,
      });
    });

    const result: PlanWithFeedback[] = plans
      .map(plan => {
        const planExercises = (exercises || []).filter(e => e.workout_plan_id === plan.id);
        const dayMap = new Map<number, ExerciseWithFeedback[]>();

        planExercises.forEach(ex => {
          const day = ex.day_of_week || 1;
          if (!dayMap.has(day)) dayMap.set(day, []);
          const weeks = completionsByExercise.get(ex.id) || [];
          if (weeks.length > 0) {
            dayMap.get(day)!.push({
              id: ex.id, name: ex.exercise_name || "Esercizio",
              order_index: ex.order_index, weeks: weeks.sort((a, b) => a.week_number - b.week_number),
            });
          }
        });

        const days: DayWithFeedback[] = Array.from(dayMap.entries())
          .filter(([, exs]) => exs.length > 0)
          .sort(([a], [b]) => a - b)
          .map(([day_number, exercises]) => ({ day_number, exercises }));

        return { id: plan.id, name: plan.name, start_date: plan.start_date, end_date: plan.end_date, days };
      })
      .filter(p => p.days.length > 0);

    setClientPlans(result);
    setLoadingPlans(false);
  };

  const selectClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    setSelectedClientId(clientId);
    setSelectedClientName(client?.name || "");
    setOpenExercises(new Set());
    fetchClientPlans(clientId);
  };

  const toggleExercise = (exerciseId: string) => {
    setOpenExercises(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) newSet.delete(exerciseId);
      else newSet.add(exerciseId);
      return newSet;
    });
  };

  return (
    <CoachLayout title="FEEDBACK CLIENTI" icon={<MessageSquare className="w-6 h-6" />}>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nessun feedback ricevuto dai clienti</p>
            <p className="text-sm mt-1">I feedback appariranno qui quando i clienti valuteranno i loro esercizi</p>
          </CardContent>
        </Card>
      ) : !selectedClientId ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca cliente per nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <p className="text-sm text-muted-foreground">{filteredClients.length} clienti con feedback</p>
          {filteredClients.map(client => (
            <Card key={client.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => selectClient(client.id)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{client.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {client.feedbackCount} feedback in {client.planCount} schede • ultimo: {format(parseISO(client.lastDate), "dd MMM yyyy", { locale: it })}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => { setSelectedClientId(null); setClientPlans([]); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Torna all'elenco clienti
          </button>
          <h2 className="text-lg font-display tracking-wider">{selectedClientName}</h2>

          {loadingPlans ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : clientPlans.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground"><p>Nessun feedback per questo cliente</p></CardContent></Card>
          ) : (
            clientPlans.map(plan => (
              <Card key={plan.id} className="overflow-hidden">
                <div className="bg-muted px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-primary" />
                    <h3 className="font-display tracking-wider">{plan.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(plan.start_date), "d MMM yyyy", { locale: it })} — {format(new Date(plan.end_date), "d MMM yyyy", { locale: it })}
                  </p>
                </div>
                <CardContent className="p-0">
                  {plan.days.map(day => (
                    <div key={day.day_number} className="border-b last:border-b-0">
                      <div className="px-4 py-2 bg-muted/30 font-medium text-sm">
                        Giorno {day.day_number}
                        <span className="text-muted-foreground ml-2 font-normal">({day.exercises.length} esercizi con feedback)</span>
                      </div>
                      <div className="divide-y">
                        {day.exercises.map((exercise, idx) => {
                          const isOpen = openExercises.has(exercise.id);
                          return (
                            <Collapsible key={exercise.id} open={isOpen} onOpenChange={() => toggleExercise(exercise.id)}>
                              <CollapsibleTrigger className="w-full">
                                <div className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer">
                                  <div className="flex items-center gap-3 text-left">
                                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium flex-shrink-0">{idx + 1}</span>
                                    <div>
                                      <p className="font-medium text-sm whitespace-pre-wrap">{renderColoredText(exercise.name)}</p>
                                      <p className="text-xs text-muted-foreground">{exercise.weeks.length} settimane valutate</p>
                                    </div>
                                  </div>
                                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="px-4 pb-4 space-y-3">
                                  {exercise.weeks.map(week => (
                                    <div key={week.week_number} className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-display text-sm">Settimana {week.week_number}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {format(parseISO(week.completed_at), "dd MMM yyyy", { locale: it })}
                                        </span>
                                      </div>
                                      {week.difficulty_rating > 0 && (
                                        <div className="mb-2"><LightningRating value={week.difficulty_rating} readonly size="sm" /></div>
                                      )}
                                      {week.client_notes && (
                                        <p className="text-sm bg-background rounded-lg p-2 border border-border">{week.client_notes}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </CoachLayout>
  );
};

export default CoachReportsPage;
