import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Loader2, Edit, Trash2, UserPlus, X } from "lucide-react";

interface Course {
  id: string;
  name: string;
  description: string | null;
  coach_id: string | null;
  color: string;
  max_participants: number | null;
  duration_minutes: number;
  is_active: boolean;
  schedule: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface CourseParticipant {
  id: string;
  course_id: string;
  user_id: string;
  joined_at: string;
}

const CourseManagement = () => {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [coaches, setCoaches] = useState<Profile[]>([]);
  const [allClients, setAllClients] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  
  // Participants dialog
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [participants, setParticipants] = useState<CourseParticipant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    coach_id: "",
    color: "#10B981",
    max_participants: "",
    duration_minutes: "60",
    schedule: "",
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [coursesRes, coachesRes, clientsRes] = await Promise.all([
      supabase.from("courses").select("*").order("name"),
      supabase.from("profiles").select("*").in("role", ["admin", "coach"]),
      supabase.from("profiles").select("*").in("role", ["cliente_corso", "cliente_palestra", "cliente_coaching"])
    ]);

    if (coursesRes.data) setCourses(coursesRes.data);
    if (coachesRes.data) setCoaches(coachesRes.data);
    if (clientsRes.data) setAllClients(clientsRes.data);
    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingCourse(null);
    setFormData({ name: "", description: "", coach_id: "", color: "#10B981", max_participants: "", duration_minutes: "60", schedule: "", is_active: true });
    setIsDialogOpen(true);
  };

  const openEditDialog = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      description: course.description || "",
      coach_id: course.coach_id || "",
      color: course.color || "#10B981",
      max_participants: course.max_participants?.toString() || "",
      duration_minutes: course.duration_minutes.toString(),
      schedule: course.schedule || "",
      is_active: course.is_active
    });
    setIsDialogOpen(true);
  };

  const saveCourse = async () => {
    if (!formData.name) {
      toast({ title: "Errore", description: "Il nome è obbligatorio", variant: "destructive" });
      return;
    }

    setSaving(true);
    const courseData = {
      name: formData.name,
      description: formData.description || null,
      coach_id: formData.coach_id || null,
      color: formData.color,
      max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
      duration_minutes: parseInt(formData.duration_minutes) || 60,
      schedule: formData.schedule || null,
      is_active: formData.is_active
    };

    if (editingCourse) {
      const { error } = await supabase.from("courses").update(courseData).eq("id", editingCourse.id);
      if (error) {
        toast({ title: "Errore", description: "Impossibile aggiornare il corso", variant: "destructive" });
      } else {
        toast({ title: "Successo", description: "Corso aggiornato" });
        setIsDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("courses").insert(courseData);
      if (error) {
        toast({ title: "Errore", description: "Impossibile creare il corso", variant: "destructive" });
      } else {
        toast({ title: "Successo", description: "Corso creato" });
        setIsDialogOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo corso?")) return;

    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) {
      toast({ title: "Errore", description: "Impossibile eliminare il corso", variant: "destructive" });
    } else {
      toast({ title: "Successo", description: "Corso eliminato" });
      fetchData();
    }
  };

  const getCoachName = (coachId: string | null) => {
    if (!coachId) return "-";
    const coach = coaches.find(c => c.user_id === coachId);
    return coach ? `${coach.first_name} ${coach.last_name}` : "-";
  };

  // Participants management
  const openParticipantsDialog = async (course: Course) => {
    setSelectedCourse(course);
    setParticipantsDialogOpen(true);
    setSelectedClientId("");
    await fetchParticipants(course.id);
  };

  const fetchParticipants = async (courseId: string) => {
    setLoadingParticipants(true);
    const { data } = await supabase
      .from("course_participants")
      .select("*")
      .eq("course_id", courseId)
      .order("joined_at", { ascending: false });
    setParticipants(data || []);
    setLoadingParticipants(false);
  };

  const addParticipant = async () => {
    if (!selectedClientId || !selectedCourse) return;
    
    // Check if already added
    if (participants.some(p => p.user_id === selectedClientId)) {
      toast({ title: "Attenzione", description: "Questo utente è già iscritto al corso", variant: "destructive" });
      return;
    }

    setAddingParticipant(true);
    const { error } = await supabase
      .from("course_participants")
      .insert({ course_id: selectedCourse.id, user_id: selectedClientId });

    if (error) {
      toast({ title: "Errore", description: "Impossibile aggiungere il partecipante", variant: "destructive" });
    } else {
      toast({ title: "Aggiunto", description: "Partecipante aggiunto al corso" });
      setSelectedClientId("");
      await fetchParticipants(selectedCourse.id);
    }
    setAddingParticipant(false);
  };

  const removeParticipant = async (participantId: string) => {
    if (!selectedCourse) return;
    const { error } = await supabase
      .from("course_participants")
      .delete()
      .eq("id", participantId);

    if (error) {
      toast({ title: "Errore", description: "Impossibile rimuovere il partecipante", variant: "destructive" });
    } else {
      toast({ title: "Rimosso", description: "Partecipante rimosso dal corso" });
      await fetchParticipants(selectedCourse.id);
    }
  };

  const getClientName = (userId: string) => {
    const client = allClients.find(c => c.user_id === userId);
    return client ? `${client.first_name} ${client.last_name}` : "Utente sconosciuto";
  };

  // Clients not yet in this course
  const availableClients = allClients.filter(
    c => !participants.some(p => p.user_id === c.user_id)
  );

  return (
    <AdminLayout title="CORSI" icon={<Users className="w-6 h-6" />}>
      <div className="flex justify-end mb-6">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreateDialog}>
              <Plus className="w-4 h-4" />Nuovo Corso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCourse ? "Modifica Corso" : "Nuovo Corso"}</DialogTitle>
              <DialogDescription>
                {editingCourse ? "Modifica i dettagli del corso" : "Crea un nuovo corso di gruppo"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Es. Yoga Mattutino" />
              </div>
              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrivi il corso..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Coach</Label>
                  <Select value={formData.coach_id} onValueChange={(v) => setFormData({ ...formData, coach_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                    <SelectContent>
                      {coaches.map(c => (
                        <SelectItem key={c.user_id} value={c.user_id}>{c.first_name} {c.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Durata (min)</Label>
                  <Input type="number" value={formData.duration_minutes} onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Partecipanti</Label>
                  <Input type="number" value={formData.max_participants} onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })} placeholder="Illimitato" />
                </div>
                <div className="space-y-2">
                  <Label>Colore</Label>
                  <Input type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="h-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Orario Ricorrente</Label>
                <Input value={formData.schedule} onChange={(e) => setFormData({ ...formData, schedule: e.target.value })} placeholder="Es. Lun-Mer-Ven 18:00" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                <Label>Corso attivo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annulla</Button>
              <Button onClick={saveCourse} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingCourse ? "Salva" : "Crea"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display tracking-wider">Corsi di Gruppo</CardTitle>
          <CardDescription>{courses.length} corsi</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessun corso creato</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Durata</TableHead>
                  <TableHead>Partecipanti</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: course.color }} />
                        <span className="font-medium">{course.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getCoachName(course.coach_id)}</TableCell>
                    <TableCell>{course.duration_minutes} min</TableCell>
                    <TableCell>{course.max_participants || "∞"}</TableCell>
                    <TableCell>
                      <Badge variant={course.is_active ? "default" : "secondary"}>
                        {course.is_active ? "Attivo" : "Disattivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openParticipantsDialog(course)} title="Gestisci iscritti">
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(course)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCourse(course.id)}>
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

      {/* Participants Dialog */}
      <Dialog open={participantsDialogOpen} onOpenChange={setParticipantsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">
              Iscritti — {selectedCourse?.name}
            </DialogTitle>
            <DialogDescription>
              Gestisci i partecipanti di questo corso
            </DialogDescription>
          </DialogHeader>

          {/* Add participant */}
          <div className="flex gap-2">
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleziona un utente..." />
              </SelectTrigger>
              <SelectContent>
                {availableClients.map(c => (
                  <SelectItem key={c.user_id} value={c.user_id}>
                    {c.first_name} {c.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addParticipant} disabled={!selectedClientId || addingParticipant} size="sm">
              {addingParticipant ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          {/* Participants list */}
          {loadingParticipants ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : participants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nessun iscritto</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{participants.length} iscritti</p>
              {participants.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div>
                    <p className="font-medium text-sm">{getClientName(p.user_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      Iscritto dal {new Date(p.joined_at).toLocaleDateString("it-IT")}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeParticipant(p.id)}>
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default CourseManagement;
