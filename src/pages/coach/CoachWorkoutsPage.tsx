import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Dumbbell, Search, Calendar, User, Loader2, Eye, Pause, Play, CheckCircle
} from "lucide-react";
import CoachLayout from "@/components/coach/CoachLayout";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface WorkoutPlan {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  status?: string;
  client_id: string;
  client_name?: string;
}

const CoachWorkoutsPage = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>("attiva");

  useEffect(() => {
    if (profile?.user_id) fetchPlans();
  }, [profile?.user_id]);

  const fetchPlans = async () => {
    setLoading(true);
    const { data: plansData } = await (supabase
      .from("workout_plans")
      .select("*")
      .eq("coach_id", profile?.user_id) as any)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }) as any;

    if (plansData && (plansData as any[]).length > 0) {
      const typedPlans = plansData as any[];
      const clientIds = [...new Set(typedPlans.map((p: any) => p.client_id))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", clientIds);

      const clientMap = new Map(profiles?.map(p => [p.user_id, `${p.first_name} ${p.last_name}`]) || []);

      setPlans(typedPlans.map((p: any) => ({
        ...p,
        status: p.status || (p.is_active ? "attiva" : "conclusa"),
        client_name: clientMap.get(p.client_id) || "Cliente sconosciuto"
      })));
    }
    setLoading(false);
  };

  const filteredPlans = plans.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.client_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === null || p.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "attiva": return <Badge variant="default" className="gap-1"><Play className="w-3 h-3" />Attiva</Badge>;
      case "in_pausa": return <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-700 border-yellow-500/30"><Pause className="w-3 h-3" />In Pausa</Badge>;
      case "conclusa": return <Badge variant="outline" className="gap-1"><CheckCircle className="w-3 h-3" />Conclusa</Badge>;
      default: return null;
    }
  };

  return (
    <CoachLayout title="SCHEDE ALLENAMENTO" icon={<Dumbbell className="w-6 h-6" />}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Cerca scheda o cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "Attive", value: "attiva" },
              { label: "In Pausa", value: "in_pausa" },
              { label: "Concluse", value: "conclusa" },
              { label: "Tutte", value: null },
            ].map(f => (
              <Button key={f.label} variant={filterStatus === f.value ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(f.value)}>
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredPlans.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><Dumbbell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" /><p className="text-muted-foreground">Nessuna scheda trovata</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPlans.map(plan => (
              <Card key={plan.id} className={plan.status === "attiva" ? "border-primary/50" : plan.status === "in_pausa" ? "border-yellow-500/50" : "opacity-70"}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {plan.description && <CardDescription className="mt-1">{plan.description}</CardDescription>}
                    </div>
                    {statusBadge(plan.status || "attiva")}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" /><span>{plan.client_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(plan.start_date), "dd MMM", { locale: it })} - {format(new Date(plan.end_date), "dd MMM yyyy", { locale: it })}</span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <Eye className="w-4 h-4" /> Visualizza Dettagli
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CoachLayout>
  );
};

export default CoachWorkoutsPage;
