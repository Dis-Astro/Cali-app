import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import ExerciseNameInput from "@/components/admin/ExerciseNameInput";

interface DayBlock {
  day_number: number;
  exercises: { exercise_name_free: string }[];
}

interface CreateWorkoutPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onSuccess: () => void;
}

const CreateWorkoutPlanDialog = ({
  open,
  onOpenChange,
  clientId,
  clientName,
  onSuccess
}: CreateWorkoutPlanDialogProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_weeks: "4",
    coach_notes: ""
  });

  const [days, setDays] = useState<DayBlock[]>([]);

  useEffect(() => {
    if (open) {
      setFormData({ name: "", description: "", duration_weeks: "4", coach_notes: "" });
      setDays([{ day_number: 1, exercises: [{ exercise_name_free: "" }] }]);
    }
  }, [open]);

  const addDay = () => {
    const nextDay = days.length > 0 ? Math.max(...days.map(d => d.day_number)) + 1 : 1;
    setDays(prev => [...prev, { day_number: nextDay, exercises: [{ exercise_name_free: "" }] }]);
  };

  const removeDay = (dayIndex: number) => {
    setDays(prev => prev.filter((_, i) => i !== dayIndex));
  };

  const addExerciseToDay = (dayIndex: number) => {
    setDays(prev => prev.map((day, i) => 
      i === dayIndex ? { ...day, exercises: [...day.exercises, { exercise_name_free: "" }] } : day
    ));
  };

  const removeExerciseFromDay = (dayIndex: number, exIndex: number) => {
    setDays(prev => prev.map((day, i) => 
      i === dayIndex ? { ...day, exercises: day.exercises.filter((_, j) => j !== exIndex) } : day
    ));
  };

  const updateExerciseName = (dayIndex: number, exIndex: number, value: string) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      const exercises = [...day.exercises];
      exercises[exIndex] = { ...exercises[exIndex], exercise_name_free: value };
      return { ...day, exercises };
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast({ title: "Errore", description: "Inserisci un nome per la scheda", variant: "destructive" });
      return;
    }
    const allExercises = days.flatMap(d => d.exercises);
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

    const startDate = new Date();
    const weeks = parseInt(formData.duration_weeks) || 4;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + weeks * 7);

    const { data: plan, error: planError } = await supabase
      .from("workout_plans")
      .insert({
        client_id: clientId,
        coach_id: profile?.user_id,
        name: formData.name,
        description: formData.description || null,
        coach_notes: formData.coach_notes || null,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        is_active: true
      } as any)
      .select()
      .single();

    if (planError) {
      toast({ title: "Errore", description: "Impossibile creare la scheda", variant: "destructive" });
      setSaving(false);
      return;
    }

    let orderIndex = 0;
    const exercisesToInsert = days.flatMap(day =>
      day.exercises.map(ex => ({
        workout_plan_id: plan.id,
        exercise_id: null,
        exercise_name: ex.exercise_name_free.trim(),
        day_of_week: day.day_number,
        sets: null,
        reps: null,
        notes: null,
        order_index: orderIndex++
      }))
    );

    const { error: exercisesError } = await supabase
      .from("workout_plan_exercises")
      .insert(exercisesToInsert);

    if (exercisesError) {
      toast({ title: "Attenzione", description: "Scheda creata ma alcuni esercizi non salvati", variant: "destructive" });
    } else {
      toast({ title: "Scheda creata!" });
      onSuccess();
      onOpenChange(false);
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">Nuova Scheda di Allenamento</DialogTitle>
          <DialogDescription>Crea una nuova scheda per {clientName}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Scheda *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Es. Scheda Forza - Febbraio"
              />
            </div>
            <div className="space-y-2">
              <Label>Durata (settimane)</Label>
              <Select value={formData.duration_weeks} onValueChange={(v) => setFormData({ ...formData, duration_weeks: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 4, 5, 6, 7, 8].map(w => (
                    <SelectItem key={w} value={w.toString()}>{w} settimane</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrizione</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Obiettivi della scheda..." rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Note per il Cliente</Label>
            <Textarea value={formData.coach_notes} onChange={(e) => setFormData({ ...formData, coach_notes: e.target.value })} placeholder="Note tecniche che il cliente vedrà..." rows={2} />
          </div>

          {/* Days + Exercises */}
          <div className="space-y-4">
            <div>
              <Label className="text-base">Giorni ed Esercizi</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Scrivi liberamente — includi serie, rep e colore elastico nel nome (es. "3x12 Squat elastico arancione")
              </p>
            </div>

            {days.map((day, dayIndex) => (
              <div key={dayIndex} className="border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 flex items-center justify-between">
                  <h4 className="font-medium text-sm">Giorno {day.day_number}</h4>
                  {days.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeDay(dayIndex)} className="h-7 text-destructive hover:text-destructive">
                      <Trash2 className="w-3 h-3 mr-1" /> Rimuovi giorno
                    </Button>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  {day.exercises.map((ex, exIndex) => (
                    <div key={exIndex} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-5">#{exIndex + 1}</span>
                      <ExerciseNameInput
                        value={ex.exercise_name_free}
                        onChange={(val) => updateExerciseName(dayIndex, exIndex, val)}
                        placeholder="Es. 3x12 Squat elastico arancione"
                      />
                      {day.exercises.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeExerciseFromDay(dayIndex, exIndex)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => addExerciseToDay(dayIndex)} className="gap-1 text-primary w-full justify-center mt-1">
                    <Plus className="w-3.5 h-3.5" /> Nuovo esercizio
                  </Button>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addDay} className="w-full gap-2 sticky bottom-0 bg-background z-10">
              <Plus className="w-4 h-4" /> Aggiungi Giorno
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crea Scheda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateWorkoutPlanDialog;
