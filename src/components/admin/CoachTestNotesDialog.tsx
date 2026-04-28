import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import LightningRating from "@/components/coaching/LightningRating";
import { FileText, ChevronDown, ChevronUp, Save, Loader2 } from "lucide-react";

const COLOR_MAP: Record<string, string> = {
  arancione: "#f97316", azzurro: "#38bdf8", verde: "#22c55e",
  giallo: "#eab308", rosso: "#ef4444", blu: "#3b82f6", viola: "#a855f7",
};

function renderColoredText(value: string) {
  const tokens = value.split(/(\s+)/);
  return tokens.map((token, i) => {
    const color = COLOR_MAP[token.toLowerCase().replace(/[^a-zàèéìòù]/gi, "")];
    if (color) return <span key={i} style={{ color, fontWeight: 700 }}>{token}</span>;
    return <span key={i}>{token}</span>;
  });
}

interface Exercise {
  id: string;
  exercise_name: string | null;
  day_of_week: number | null;
  order_index: number;
}

interface CoachNote {
  id?: string;
  workout_plan_exercise_id: string;
  note: string;
  rating: number;
}

interface CoachTestNotesDialogProps {
  planId: string;
  planName: string;
  trigger?: React.ReactNode;
  onNotesUpdated?: () => void;
}

const CoachTestNotesDialog = ({ planId, planName, trigger, onNotesUpdated }: CoachTestNotesDialogProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [notes, setNotes] = useState<Map<string, CoachNote>>(new Map());
  const [openExercises, setOpenExercises] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (open) loadData();
  }, [open, planId]);

  const loadData = async () => {
    setLoading(true);
    const [exRes, notesRes] = await Promise.all([
      supabase.from("workout_plan_exercises")
        .select("id, exercise_name, day_of_week, order_index")
        .eq("workout_plan_id", planId)
        .order("day_of_week").order("order_index"),
      supabase.from("coach_test_notes" as any)
        .select("id, workout_plan_exercise_id, note, rating")
        .eq("coach_id", profile?.user_id),
    ]);

    if (exRes.data) setExercises(exRes.data);

    const exIds = exRes.data?.map(e => e.id) || [];
    const notesMap = new Map<string, CoachNote>();
    if (notesRes.data) {
      (notesRes.data as any[])
        .filter((n: any) => exIds.includes(n.workout_plan_exercise_id))
        .forEach((n: any) => {
          notesMap.set(n.workout_plan_exercise_id, {
            id: n.id, workout_plan_exercise_id: n.workout_plan_exercise_id,
            note: n.note || "", rating: n.rating || 0,
          });
        });
    }
    setNotes(notesMap);
    setDirty(false);
    setLoading(false);
  };

  const updateNote = (exerciseId: string, field: "note" | "rating", value: string | number) => {
    setNotes(prev => {
      const map = new Map(prev);
      const existing = map.get(exerciseId) || { workout_plan_exercise_id: exerciseId, note: "", rating: 0 };
      map.set(exerciseId, { ...existing, [field]: value });
      return map;
    });
    setDirty(true);
  };

  const toggleExercise = (id: string) => {
    setOpenExercises(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleSave = async () => {
    if (!profile?.user_id) return;
    setSaving(true);

    const entries = Array.from(notes.entries());
    for (const [exId, note] of entries) {
      if (!note.note && !note.rating) continue;

      if (note.id) {
        await (supabase.from("coach_test_notes" as any) as any)
          .update({ note: note.note || null, rating: note.rating || null, updated_at: new Date().toISOString() })
          .eq("id", note.id);
      } else {
        await (supabase.from("coach_test_notes" as any) as any)
          .insert({
            workout_plan_exercise_id: exId,
            coach_id: profile.user_id,
            note: note.note || null,
            rating: note.rating || null,
          });
      }
    }

    toast({ title: "Note test salvate!" });
    setDirty(false);
    setSaving(false);
    onNotesUpdated?.();
  };

  const exercisesByDay = exercises.reduce((acc, ex) => {
    const day = ex.day_of_week || 1;
    if (!acc[day]) acc[day] = [];
    acc[day].push(ex);
    return acc;
  }, {} as Record<number, Exercise[]>);

  const filledCount = Array.from(notes.values()).filter(n => n.note || n.rating).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50">
            <FileText className="w-3.5 h-3.5" />
            Note Test
            {filledCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-orange-100 text-orange-700">
                {filledCount}/{exercises.length}
              </Badge>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-500" />
            Note Test — {planName}
          </DialogTitle>
          {exercises.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {filledCount}/{exercises.length} esercizi annotati
            </p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {Object.entries(exercisesByDay).sort(([a], [b]) => Number(a) - Number(b)).map(([day, exs]) => (
              <div key={day}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Giorno {day}</p>
                <div className="space-y-1">
                  {exs.map((ex, idx) => {
                    const note = notes.get(ex.id);
                    const isOpen = openExercises.has(ex.id);
                    const hasContent = !!(note?.note || note?.rating);

                    return (
                      <Collapsible key={ex.id} open={isOpen} onOpenChange={() => toggleExercise(ex.id)}>
                        <CollapsibleTrigger className="w-full">
                          <div className={`px-3 py-2 rounded-md border flex items-center justify-between text-left hover:bg-muted/30 transition-colors ${hasContent ? 'border-orange-300 bg-orange-50/50' : ''}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-medium flex-shrink-0">{idx + 1}</span>
                              <p className="text-xs truncate whitespace-pre-wrap">
                                {ex.exercise_name ? renderColoredText(ex.exercise_name) : "Esercizio"}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {hasContent && <div className="w-2 h-2 rounded-full bg-orange-400" />}
                              {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 py-2 space-y-2 border-x border-b rounded-b-md">
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">Difficoltà / Valutazione</p>
                              <LightningRating value={note?.rating || 0} onChange={v => updateNote(ex.id, "rating", v)} size="sm" />
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">Annotazione Coach</p>
                              <Textarea
                                value={note?.note || ""}
                                onChange={e => updateNote(ex.id, "note", e.target.value)}
                                placeholder="Movimento, massimale, correzioni..."
                                rows={2}
                                className="text-xs min-h-[60px]"
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div className="pt-2 border-t">
            <Button onClick={handleSave} disabled={saving || !dirty} className="w-full gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salva Note
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CoachTestNotesDialog;
