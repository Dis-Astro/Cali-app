import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Plus, Search, Loader2, Edit, Trash2, Video } from "lucide-react";
import ExerciseVideoManager from "@/components/admin/ExerciseVideoManager";

interface Exercise {
  id: string;
  name: string;
  description: string | null;
  muscle_group: string | null;
  difficulty: string | null;
  created_at: string;
  video_count?: number;
}

const muscleGroups = [
  "Petto", "Schiena", "Spalle", "Braccia", "Addome", "Gambe", "Glutei", "Full Body", "Cardio"
];

const difficulties = ["Principiante", "Intermedio", "Avanzato"];

const ExerciseManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("all");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  
  // Video manager state
  const [videoManagerOpen, setVideoManagerOpen] = useState(false);
  const [selectedExerciseForVideo, setSelectedExerciseForVideo] = useState<Exercise | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    muscle_group: "",
    difficulty: ""
  });

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    setLoading(true);
    
    // Fetch exercises with video count
    const { data: exercisesData, error } = await supabase
      .from("exercises")
      .select("*")
      .order("name");

    if (error) {
      toast({ title: "Errore", description: "Impossibile caricare gli esercizi", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Get video counts
    const { data: videoCounts } = await supabase
      .from("exercise_videos")
      .select("exercise_id");

    const countMap = new Map<string, number>();
    (videoCounts || []).forEach(v => {
      countMap.set(v.exercise_id, (countMap.get(v.exercise_id) || 0) + 1);
    });

    const exercisesWithCount = (exercisesData || []).map(ex => ({
      ...ex,
      video_count: countMap.get(ex.id) || 0
    }));

    setExercises(exercisesWithCount);
    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingExercise(null);
    setFormData({ name: "", description: "", muscle_group: "", difficulty: "" });
    setIsDialogOpen(true);
  };

  const openEditDialog = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setFormData({
      name: exercise.name,
      description: exercise.description || "",
      muscle_group: exercise.muscle_group || "",
      difficulty: exercise.difficulty || ""
    });
    setIsDialogOpen(true);
  };

  const openVideoManager = (exercise: Exercise) => {
    setSelectedExerciseForVideo(exercise);
    setVideoManagerOpen(true);
  };

  const saveExercise = async () => {
    if (!formData.name) {
      toast({ title: "Errore", description: "Il nome è obbligatorio", variant: "destructive" });
      return;
    }

    setSaving(true);
    
    if (editingExercise) {
      const { error } = await supabase
        .from("exercises")
        .update({
          name: formData.name,
          description: formData.description || null,
          muscle_group: formData.muscle_group || null,
          difficulty: formData.difficulty || null
        })
        .eq("id", editingExercise.id);

      if (error) {
        toast({ title: "Errore", description: "Impossibile aggiornare l'esercizio", variant: "destructive" });
      } else {
        toast({ title: "Successo", description: "Esercizio aggiornato" });
        setIsDialogOpen(false);
        fetchExercises();
      }
    } else {
      const { error } = await supabase
        .from("exercises")
        .insert({
          name: formData.name,
          description: formData.description || null,
          muscle_group: formData.muscle_group || null,
          difficulty: formData.difficulty || null,
          created_by: profile?.user_id
        });

      if (error) {
        toast({ title: "Errore", description: "Impossibile creare l'esercizio", variant: "destructive" });
      } else {
        toast({ title: "Successo", description: "Esercizio creato" });
        setIsDialogOpen(false);
        fetchExercises();
      }
    }
    setSaving(false);
  };

  const deleteExercise = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo esercizio?")) return;

    const { error } = await supabase.from("exercises").delete().eq("id", id);
    if (error) {
      toast({ title: "Errore", description: "Impossibile eliminare l'esercizio", variant: "destructive" });
    } else {
      toast({ title: "Successo", description: "Esercizio eliminato" });
      fetchExercises();
    }
  };

  const filteredExercises = exercises.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMuscle = muscleFilter === "all" || e.muscle_group === muscleFilter;
    return matchesSearch && matchesMuscle;
  });

  return (
    <AdminLayout title="ESERCIZI" icon={<Dumbbell className="w-6 h-6" />}>
      {/* Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca esercizi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={muscleFilter} onValueChange={setMuscleFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Gruppo muscolare" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i gruppi</SelectItem>
            {muscleGroups.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreateDialog}>
              <Plus className="w-4 h-4" />Nuovo Esercizio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingExercise ? "Modifica Esercizio" : "Nuovo Esercizio"}</DialogTitle>
              <DialogDescription>
                {editingExercise ? "Modifica i dettagli dell'esercizio" : "Crea un nuovo esercizio per le schede"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Es. Squat con bilanciere"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrivi l'esecuzione corretta..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gruppo Muscolare</Label>
                  <Select value={formData.muscle_group} onValueChange={(v) => setFormData({ ...formData, muscle_group: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      {muscleGroups.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Difficoltà</Label>
                  <Select value={formData.difficulty} onValueChange={(v) => setFormData({ ...formData, difficulty: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      {difficulties.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annulla</Button>
              <Button onClick={saveExercise} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingExercise ? "Salva" : "Crea"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display tracking-wider">Libreria Esercizi</CardTitle>
          <CardDescription>{filteredExercises.length} esercizi</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredExercises.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Dumbbell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessun esercizio trovato</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Gruppo Muscolare</TableHead>
                  <TableHead>Difficoltà</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExercises.map((exercise) => (
                  <TableRow key={exercise.id}>
                    <TableCell className="font-medium">{exercise.name}</TableCell>
                    <TableCell>
                      {exercise.muscle_group ? (
                        <Badge variant="secondary">{exercise.muscle_group}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {exercise.difficulty ? (
                        <Badge variant="outline">{exercise.difficulty}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1"
                        onClick={() => openVideoManager(exercise)}
                      >
                        <Video className="w-4 h-4" />
                        {exercise.video_count || 0}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(exercise)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteExercise(exercise.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Video Manager Dialog */}
      {selectedExerciseForVideo && (
        <ExerciseVideoManager
          exerciseId={selectedExerciseForVideo.id}
          exerciseName={selectedExerciseForVideo.name}
          open={videoManagerOpen}
          onOpenChange={(open) => {
            setVideoManagerOpen(open);
            if (!open) {
              fetchExercises(); // Refresh counts
            }
          }}
        />
      )}
    </AdminLayout>
  );
};

export default ExerciseManagement;
