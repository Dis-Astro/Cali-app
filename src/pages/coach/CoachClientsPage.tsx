import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Search,
  Dumbbell,
  Calendar,
  Plus,
  Eye,
  Loader2,
  User
} from "lucide-react";
import { Link } from "react-router-dom";
import CoachLayout from "@/components/coach/CoachLayout";
import CreateWorkoutPlanDialog from "@/components/admin/CreateWorkoutPlanDialog";

interface Client {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string | null;
  activePlan: boolean;
}

const CoachClientsPage = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);

  useEffect(() => {
    if (profile?.user_id) {
      fetchClients();
    }
  }, [profile?.user_id]);

  const fetchClients = async () => {
    setLoading(true);
    const coachId = profile?.user_id;

    // Fetch assigned clients
    const { data: assignments } = await supabase
      .from("coach_assignments")
      .select("client_id")
      .eq("coach_id", coachId);

    const clientIds = assignments?.map(a => a.client_id) || [];

    if (clientIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, role, phone")
        .in("user_id", clientIds);

      // Check for active plans
      const { data: plans } = await supabase
        .from("workout_plans")
        .select("client_id")
        .eq("coach_id", coachId)
        .eq("is_active", true);

      const activeClients = new Set(plans?.map(p => p.client_id) || []);

      setClients(
        profiles?.map(p => ({
          ...p,
          activePlan: activeClients.has(p.user_id)
        })) || []
      );
    }

    setLoading(false);
  };

  const filteredClients = clients.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreatePlan = (client: Client) => {
    setSelectedClient({ id: client.user_id, name: `${client.first_name} ${client.last_name}` });
    setIsCreatePlanOpen(true);
  };

  return (
    <CoachLayout title="I MIEI CLIENTI" icon={<Users className="w-6 h-6" />}>
      <div className="space-y-6">
        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="secondary">{clients.length} clienti assegnati</Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredClients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {searchTerm ? "Nessun cliente trovato" : "Nessun cliente assegnato"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map(client => (
              <Card key={client.user_id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {client.first_name} {client.last_name}
                      </CardTitle>
                      <CardDescription className="capitalize">
                        {client.role.replace("_", " ")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-muted-foreground" />
                    {client.activePlan ? (
                      <Badge variant="default">Scheda attiva</Badge>
                    ) : (
                      <Badge variant="secondary">Nessuna scheda</Badge>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-2"
                      onClick={() => handleCreatePlan(client)}
                    >
                      <Plus className="w-4 h-4" />
                      Nuova Scheda
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/coach/clienti/${client.user_id}`}>
                        <Eye className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedClient && (
        <CreateWorkoutPlanDialog
          open={isCreatePlanOpen}
          onOpenChange={setIsCreatePlanOpen}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          onSuccess={fetchClients}
        />
      )}
    </CoachLayout>
  );
};

export default CoachClientsPage;
