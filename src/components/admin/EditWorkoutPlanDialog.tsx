import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Pause, Play, CheckCircle, CalendarIcon } from "lucide-react";
import ExerciseNameInput from "@/components/admin/ExerciseNameInput";

interface DayExercise {
  id?: string;
  exercise_name_free: string;
  order_index: number;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface DayBlock {
  day_number: number;
  exercises: DayExercise[];
}

interface EditWorkoutPlanDialogProps {
  planId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const EditWorkoutPlanDialog = ({
  planId,
  open,
  onOpenChange,
  onSuccess
}: EditWorkoutPlanDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    coach_notes: "",
    status: "attiva" as string,
    end_date: "",
  });

  const [days, setDays] = useState<DayBlock[]>([]);

  useEffect(() => {
    if (open && planId) fetchData();
  }, [open, planId]);

  const fetchData = async () => {
    if (!planId) return;
    setLoading(true);

    const [planRes, exercisesRes] = await Promise.all([
      supabase.from("workout_plans").select("*").eq("id", planId).single(),
      supabase
        .from("workout_plan_exercises")
        .select("id, exercise_name, day_of_week, order_index")
        .eq("workout_plan_id", planId)
        .order("day_of_week").order("order_index")
    ]);

    if (planRes.data) {
      const plan = planRes.data as any;
      setFormData({
        name: plan.name,
        description: plan.description || "",
        coach_notes: plan.coach_notes || "",
        status: plan.status || (plan.is_active ? "attiva" : "conclusa"),
        end_date: plan.end_date || "",
      });
    }

    if (exercisesRes.data) {
      // Group by day
      const dayMap = new Map<number, DayExercise[]>();
      exercisesRes.data.forEach(ex => {
        const day = ex.day_of_week || 1;
        if (!dayMap.has(day)) dayMap.set(day, []);
        dayMap.get(day)!.push({
          id: ex.id,
          exercise_name_free: ex.exercise_name || "",
          order_index: ex.order_index
        });
      });

      const dayBlocks: DayBlock[] = Array.from(dayMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([day_number, exercises]) => ({ day_number, exercises }));

      setDays(dayBlocks.length > 0 ? dayBlocks : [{ day_number: 1, exercises: [{ exercise_name_free: "", order_index: 0, isNew: true }] }]);
    }

    setLoading(false);
  };

  const addDay = () => {
    const nextDay = days.length > 0 ? Math.max(...days.map(d => d.day_number)) + 1 : 1;
    setDays(prev => [...prev, { day_number: nextDay, exercises: [{ exercise_name_free: "", order_index: 0, isNew: true }] }]);
  };

  const removeDay = (dayIndex: number) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      // Mark all existing exercises as deleted
      return { ...day, exercises: day.exercises.map(ex => ex.id ? { ...ex, isDeleted: true } : ex).filter(ex => ex.id) };
    }).filter(day => day.exercises.length > 0 || days.indexOf(day) !== dayIndex));
    // Simpler: just remove the day
    setDays(prev => {
      const day = prev[dayIndex];
      // Keep deleted exercises tracked in a flat way
      const deletedExercises = day.exercises.filter(ex => ex.id).map(ex => ({ ...ex, isDeleted: true }));
      const otherDays = prev.filter((_, i) => i !== dayIndex);
      if (deletedExercises.length > 0 && otherDays.length > 0) {
        // Attach deleted exercises to the first day for tracking
        return otherDays.map((d, i) => i === 0 ? { ...d, exercises: [...d.exercises, ...deletedExercises] } : d);
      }
      return otherDays;
    });
  };

  const addExerciseToDay = (dayIndex: number) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      const maxOrder = Math.max(0, ...day.exercises.filter(e => !e.isDeleted).map(e => e.order_index));
      return { ...day, exercises: [...day.exercises, { exercise_name_free: "", order_index: maxOrder + 1, isNew: true }] };
    }));
  };

  const removeExerciseFromDay = (dayIndex: number, exIndex: number) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      const ex = day.exercises[exIndex];
      if (ex.id) {
        // Mark as deleted
        const exercises = [...day.exercises];
        exercises[exIndex] = { ...ex, isDeleted: true };
        return { ...day, exercises };
      } else {
        return { ...day, exercises: day.exercises.filter((_, j) => j !== exIndex) };
      }
    }));
  };

  const updateExerciseName = (dayIndex: number, exIndex: number, value: string) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      const exercises = [...day.exercises];
      exercises[exIndex] = { ...exercises[exIndex], exercise_name_free: value };
      return { ...day, exercises };
    }));
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!planId) return;
    setSaving(true);

    const updateData: any = { status: newStatus, is_active: newStatus === "attiva" };
    
    if (newStatus === "in_pausa") {
      updateData.paused_at = new Date().toISOString();
    } else if (newStatus === "attiva" && formData.status === "in_pausa") {
      // Resuming: calculate paused days and extend end_date
      const planRes = await supabase.from("workout_plans").select("paused_at, end_date, total_paused_days").eq("id", planId).single();
      if (planRes.data) {
        const pausedAt = new Date((planRes.data as any).paused_at);
        const now = new Date();
        const pausedDays = Math.floor((now.getTime() - pausedAt.getTime()) / (1000 * 60 * 60 * 24));
        const newEndDate = new Date((planRes.data as any).end_date);
        newEndDate.setDate(newEndDate.getDate() + pausedDays);
        updateData.end_date = newEndDate.toISOString().split("T")[0];
        updateData.total_paused_days = ((planRes.data as any).total_paused_days || 0) + pausedDays;
        updateData.paused_at = null;
        setFormData(prev => ({ ...prev, end_date: updateData.end_date }));
      }
    }

    const { error } = await supabase.from("workout_plans").update(updateData).eq("id", planId);
    if (error) {
      toast({ title: "Errore", description: "Impossibile aggiornare lo stato", variant: "destructive" });
    } else {
      setFormData(prev => ({ ...prev, status: newStatus }));
      toast({ title: newStatus === "in_pausa" ? "Scheda in pausa" : newStatus === "attiva" ? "Scheda riattivata" : "Scheda conclusa" });
      onSuccess();
    }
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!planId || !formData.name) {
      toast({ title: "Errore", description: "Inserisci un nome per la scheda", variant: "destructive" });
      return;
    }

    const allExercises = days.flatMap(d => d.exercises.filter(e => !e.isDeleted));
    if (allExercises.length === 0) {
      toast({ title: "Errore", description: "Aggiungi almeno un esercizio", variant: "destructive" });
      return;
    }
    const invalid = allExercises.filter(e => !e.exercise_name_free.trim());
    if (invalid.length > 0) {
      toast({ title: "Errore", description: "Scrivi il nome per ogni esercizio", variant: "destructive" });
      return;
    }

    setSaving(true);

    const { error: planError } = await supabase
      .from("workout_plans")
      .update({
        name: formData.name,
        description: formData.description || null,
        coach_notes: formData.coach_notes || null,
        end_date: formData.end_date || undefined,
        updated_at: new Date().toISOString()
      })
      .eq("id", planId);

    if (planError) {
      toast({ title: "Errore", description: "Impossibile aggiornare la scheda", variant: "destructive" });
      setSaving(false);
      return;
    }

    // Collect all exercises across days
    const allDayExercises = days.flatMap(day => day.exercises.map(ex => ({ ...ex, day_of_week: day.day_number })));

    // Delete removed
    const toDelete = allDayExercises.filter(e => e.isDeleted && e.id);
    if (toDelete.length > 0) {
      await supabase.from("workout_plan_exercises").delete().in("id", toDelete.map(e => e.id!));
    }

    // Update existing
    const toUpdate = allDayExercises.filter(e => !e.isDeleted && !e.isNew && e.id);
    for (const ex of toUpdate) {
      await supabase.from("workout_plan_exercises").update({
        exercise_id: null,
        exercise_name: ex.exercise_name_free.trim(),
        day_of_week: ex.day_of_week,
        sets: null,
        reps: null,
        notes: null,
        order_index: ex.order_index
      }).eq("id", ex.id!);
    }

    // Insert new
    const toInsert = allDayExercises.filter(e => !e.isDeleted && e.isNew);
    if (toInsert.length > 0) {
      await supabase.from("workout_plan_exercises").insert(
        toInsert.map(ex => ({
          workout_plan_id: planId,
          exercise_id: null,
          exercise_name: ex.exercise_name_free.trim(),
          day_of_week: ex.day_of_week,
          sets: null,
          reps: null,
          notes: null,
          order_index: ex.order_index
        }))
      );
    }

    toast({ title: "Scheda aggiornata!" });
    onSuccess();
    onOpenChange(false);
    setSaving(false);
  };

  const statusBadge = () => {
    switch (formData.status) {
      case "attiva": return <Badge variant="default" className="gap-1"><Play className="w-3 h-3" />Attiva</Badge>;
      case "in_pausa": return <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-700 border-yellow-500/30"><Pause className="w-3 h-3" />In Pausa</Badge>;
      case "conclusa": return <Badge variant="outline" className="gap-1"><CheckCircle className="w-3 h-3" />Conclusa</Badge>;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle className="font-display tracking-wider">Modifica Scheda</DialogTitle>
                {statusBadge()}
              </div>
              <DialogDescription>Modifica i dettagli e gli esercizi della scheda</DialogDescription>
            </DialogHeader>

            {/* Status Controls */}
            <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border">
              <Label className="text-sm text-muted-foreground w-full mb-1">Stato scheda:</Label>
              {formData.status === "attiva" && (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleStatusChange("in_pausa")} disabled={saving} className="gap-1">
                    <Pause className="w-3 h-3" /> Metti in Pausa
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleStatusChange("conclusa")} disabled={saving} className="gap-1">
                    <CheckCircle className="w-3 h-3" /> Concludi
                  </Button>
                </>
              )}
              {formData.status === "in_pausa" && (
                <>
                  <Button type="button" variant="default" size="sm" onClick={() => handleStatusChange("attiva")} disabled={saving} className="gap-1">
                    <Play className="w-3 h-3" /> Riattiva (estende la scadenza)
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleStatusChange("conclusa")} disabled={saving} className="gap-1">
                    <CheckCircle className="w-3 h-3" /> Concludi
                  </Button>
                </>
              )}
              {formData.status === "conclusa" && (
                <Button type="button" variant="default" size="sm" onClick={() => handleStatusChange("attiva")} disabled={saving} className="gap-1">
                  <Play className="w-3 h-3" /> Riattiva
                </Button>
              )}
            </div>

            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Scheda *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> Data Fine</Label>
                  <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
              </div>

              <div className="space-y-2">
                <Label>Note per il Cliente</Label>
                <Textarea value={formData.coach_notes} onChange={(e) => setFormData({ ...formData, coach_notes: e.target.value })} rows={2} />
              </div>

              {/* Days + Exercises */}
              <div className="space-y-4">
                <div>
                  <Label className="text-base">Giorni ed Esercizi</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Scrivi serie, rep e colore elastico direttamente nel nome
                  </p>
                </div>

                {days.map((day, dayIndex) => {
                  const visibleExercises = day.exercises.filter(e => !e.isDeleted);
                  if (visibleExercises.length === 0 && day.exercises.every(e => e.isDeleted)) return null;

                  return (
                    <div key={dayIndex} className="border rounded-lg overflow-hidden">
                      <div className="bg-muted px-4 py-2 flex items-center justify-between">
                        <h4 className="font-medium text-sm">Giorno {day.day_number}</h4>
                        {days.filter(d => d.exercises.some(e => !e.isDeleted)).length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeDay(dayIndex)} className="h-7 text-destructive hover:text-destructive">
                            <Trash2 className="w-3 h-3 mr-1" /> Rimuovi
                          </Button>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        {day.exercises.map((ex, exIndex) => {
                          if (ex.isDeleted) return null;
                          const visibleIdx = visibleExercises.indexOf(ex);
                          return (
                            <div key={ex.id || `new-${exIndex}`} className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground w-5">#{visibleIdx + 1}</span>
                              <ExerciseNameInput
                                value={ex.exercise_name_free}
                                onChange={(val) => updateExerciseName(dayIndex, exIndex, val)}
                              />
                              {visibleExercises.length > 1 && (
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeExerciseFromDay(dayIndex, exIndex)}>
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                        <Button type="button" variant="ghost" size="sm" onClick={() => addExerciseToDay(dayIndex)} className="gap-1 text-primary w-full justify-center mt-1">
                          <Plus className="w-3.5 h-3.5" /> Nuovo esercizio
                        </Button>
                      </div>
                    </div>
                  );
                })}

                <Button type="button" variant="outline" onClick={addDay} className="w-full gap-2 sticky bottom-0 bg-background z-10">
                  <Plus className="w-4 h-4" /> Aggiungi Giorno
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salva Modifiche
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditWorkoutPlanDialog;
