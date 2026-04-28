import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageSquare, 
  Send,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import ClientLayout from "@/components/coaching/ClientLayout";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type ErrorReportStatus = Database["public"]["Enums"]["error_report_status"];

interface Exercise {
  id: string;
  name: string;
}

interface WorkoutPlan {
  id: string;
  name: string;
  coach_id: string;
}

interface ErrorReport {
  id: string;
  title: string;
  description: string;
  status: ErrorReportStatus;
  reported_at: string;
  coach_response: string | null;
}

const statusConfig: Record<ErrorReportStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof AlertCircle }> = {
  aperta: { label: "In attesa", variant: "secondary", icon: Clock },
  in_lavorazione: { label: "In lavorazione", variant: "default", icon: Clock },
  risolta: { label: "Risolta", variant: "default", icon: CheckCircle },
  chiusa: { label: "Chiusa", variant: "outline", icon: CheckCircle },
};

const ReportIssuePage = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [myReports, setMyReports] = useState<ErrorReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    exercise_id: ""
  });

  useEffect(() => {
    if (profile?.user_id) {
      fetchData();
    }
  }, [profile?.user_id]);

  const fetchData = async () => {
    setLoading(true);
    const userId = profile?.user_id;
    const today = new Date().toISOString();

    // Fetch active plan
    const { data: plans } = await supabase
      .from("workout_plans")
      .select("id, name, coach_id")
      .eq("client_id", userId)
      .eq("is_active", true)
      .lte("start_date", today)
      .gte("end_date", today)
      .limit(1);

    if (plans && plans.length > 0) {
      setActivePlan(plans[0]);
    }

    // Fetch exercises for dropdown
    const { data: exercisesData } = await supabase
      .from("exercises")
      .select("id, name")
      .order("name");
    
    setExercises(exercisesData || []);

    // Fetch my reports
    const { data: reportsData } = await supabase
      .from("error_reports")
      .select("*")
      .eq("client_id", userId)
      .order("reported_at", { ascending: false });

    setMyReports(reportsData || []);

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }

    if (!activePlan) {
      toast({ title: "Errore", description: "Nessuna scheda attiva trovata", variant: "destructive" });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("error_reports")
      .insert({
        client_id: profile?.user_id,
        coach_id: activePlan.coach_id,
        workout_plan_id: activePlan.id,
        exercise_id: formData.exercise_id || null,
        title: formData.title.trim(),
        description: formData.description.trim()
      });

    if (error) {
      toast({ title: "Errore", description: "Impossibile inviare la segnalazione", variant: "destructive" });
    } else {
      toast({ title: "Inviato!", description: "Il tuo coach riceverà la segnalazione" });
      setFormData({ title: "", description: "", exercise_id: "" });
      fetchData();
    }

    setSaving(false);
  };

  return (
    <ClientLayout title="SEGNALA PROBLEMA">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display tracking-wider">Nuova Segnalazione</CardTitle>
            <CardDescription>
              Hai un dubbio su un esercizio o riscontri un problema? Scrivici!
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !activePlan ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Devi avere una scheda attiva per inviare segnalazioni</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="exercise">Esercizio (opzionale)</Label>
                  <Select 
                    value={formData.exercise_id} 
                    onValueChange={(v) => setFormData({ ...formData, exercise_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona l'esercizio relativo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessun esercizio specifico</SelectItem>
                      {exercises.map(ex => (
                        <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Oggetto *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Es. Dubbio sull'esecuzione dello squat"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrizione *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrivi il problema o la domanda in dettaglio..."
                    rows={5}
                    required
                  />
                </div>

                <Button type="submit" className="w-full gap-2" disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Invia Segnalazione
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* My Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display tracking-wider">Le Mie Segnalazioni</CardTitle>
            <CardDescription>Storico e risposte del coach</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : myReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nessuna segnalazione inviata</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myReports.map(report => {
                  const config = statusConfig[report.status];
                  const isSelected = selectedReport?.id === report.id;
                  
                  return (
                    <div key={report.id}>
                      <button
                        onClick={() => setSelectedReport(isSelected ? null : report)}
                        className={`w-full p-3 rounded-lg border text-left transition-colors hover:border-primary/50 ${
                          isSelected ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{report.title}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(parseISO(report.reported_at), "dd MMMM yyyy", { locale: it })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={config.variant} className="gap-1">
                              <config.icon className="w-3 h-3" />
                              {config.label}
                            </Badge>
                            <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                          </div>
                        </div>
                      </button>
                      
                      {isSelected && (
                        <div className="mt-2 ml-4 p-3 border-l-2 border-primary/30 space-y-3">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">La tua descrizione:</p>
                            <p className="text-sm mt-1">{report.description}</p>
                          </div>
                          
                          {report.coach_response && (
                            <div className="p-3 bg-primary/5 rounded-lg">
                              <p className="text-sm font-medium text-primary">Risposta del Coach:</p>
                              <p className="text-sm mt-1">{report.coach_response}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ReportIssuePage;
