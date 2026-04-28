import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  User, 
  Loader2, 
  Plus,
  Trash2,
  Star
} from "lucide-react";

interface Coach {
  user_id: string;
  first_name: string;
  last_name: string;
  role?: string;
}

interface Assignment {
  id: string;
  coach_id: string;
  is_primary: boolean;
  coach?: Coach;
}

interface CoachAssignmentManagerProps {
  clientId: string;
  clientRole: string;
  onUpdate?: () => void;
}

const CoachAssignmentManager = ({ clientId, clientRole, onUpdate }: CoachAssignmentManagerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedCoach, setSelectedCoach] = useState("");

  // Permetti l'assegnazione coach per qualsiasi ruolo (anche se l'utente è stato promosso)
  const isCoachingClient = true;

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch all coaches AND admins (both can be assigned as coach)
    const { data: coachProfiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, role")
      .in("role", ["coach", "admin"]);

    setCoaches(coachProfiles || []);

    // Fetch current assignments
    const { data: assignmentsData } = await supabase
      .from("coach_assignments")
      .select("*")
      .eq("client_id", clientId);

    if (assignmentsData && coachProfiles) {
      const enriched = assignmentsData.map(a => ({
        ...a,
        coach: coachProfiles.find(c => c.user_id === a.coach_id)
      }));
      setAssignments(enriched);
    }

    setLoading(false);
  };

  const handleAssign = async () => {
    if (!selectedCoach) return;

    setSaving(true);

    const { error } = await supabase
      .from("coach_assignments")
      .insert({
        client_id: clientId,
        coach_id: selectedCoach,
        is_primary: assignments.length === 0 // First coach is primary
      });

    if (error) {
      toast({ title: "Errore", description: "Impossibile assegnare il coach", variant: "destructive" });
    } else {
      toast({ title: "Successo", description: "Coach assegnato!" });
      setSelectedCoach("");
      fetchData();
      onUpdate?.();
    }

    setSaving(false);
  };

  const handleRemove = async (assignmentId: string) => {
    setSaving(true);

    const { error } = await supabase
      .from("coach_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      toast({ title: "Errore", description: "Impossibile rimuovere l'assegnazione", variant: "destructive" });
    } else {
      toast({ title: "Rimosso", description: "Coach rimosso dal cliente" });
      fetchData();
      onUpdate?.();
    }

    setSaving(false);
  };

  const handleSetPrimary = async (assignmentId: string) => {
    setSaving(true);

    // Remove primary from all
    await supabase
      .from("coach_assignments")
      .update({ is_primary: false })
      .eq("client_id", clientId);

    // Set this one as primary
    const { error } = await supabase
      .from("coach_assignments")
      .update({ is_primary: true })
      .eq("id", assignmentId);

    if (error) {
      toast({ title: "Errore", description: "Impossibile aggiornare", variant: "destructive" });
    } else {
      toast({ title: "Aggiornato", description: "Coach principale aggiornato" });
      fetchData();
    }

    setSaving(false);
  };

  const availableCoaches = coaches.filter(c => 
    !assignments.some(a => a.coach_id === c.user_id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display tracking-wider flex items-center gap-2">
          <User className="w-5 h-5" />
          Coach Assegnati
        </CardTitle>
        <CardDescription>
          {isCoachingClient 
            ? "Gestisci i coach assegnati a questo cliente" 
            : "I clienti palestra non richiedono un coach assegnato"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isCoachingClient ? (
          <div className="text-center py-4 text-muted-foreground">
            <p>Questo è un cliente palestra base.</p>
            <p className="text-sm">Cambia il ruolo a "Cliente Coaching" per assegnare un coach.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Assignments */}
            {assignments.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground border-2 border-dashed rounded-lg">
                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nessun coach assegnato</p>
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map(assignment => (
                  <div 
                    key={assignment.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {assignment.coach?.first_name} {assignment.coach?.last_name}
                        </p>
                        {assignment.is_primary && (
                          <Badge variant="default" className="gap-1 text-xs">
                            <Star className="w-3 h-3" />
                            Principale
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!assignment.is_primary && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleSetPrimary(assignment.id)}
                          disabled={saving}
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleRemove(assignment.id)}
                        disabled={saving}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Coach */}
            {availableCoaches.length > 0 && (
              <div className="flex gap-2">
                <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleziona un coach..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCoaches.map(coach => (
                      <SelectItem key={coach.user_id} value={coach.user_id}>
                        {coach.first_name} {coach.last_name}
                        {coach.role === 'admin' && ' (Admin)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAssign} disabled={!selectedCoach || saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            )}

            {availableCoaches.length === 0 && assignments.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Tutti i coach disponibili sono già assegnati
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CoachAssignmentManager;
