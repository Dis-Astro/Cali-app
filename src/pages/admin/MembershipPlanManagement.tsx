import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreditCard, Plus, Edit, Trash2, Loader2, Euro } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_months: number;
  plan_type: UserRole;
  is_active: boolean;
  created_at: string;
}

const planTypeLabels: Record<UserRole, string> = {
  admin: "Amministratore",
  coach: "Coach",
  cliente_palestra: "Cliente Palestra",
  cliente_coaching: "Cliente Coaching",
  cliente_corso: "Cliente Corso"
};

const MembershipPlanManagement = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    duration_months: "1",
    plan_type: "cliente_palestra" as UserRole,
    is_active: true
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("membership_plans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Errore", description: "Impossibile caricare i piani", variant: "destructive" });
    } else {
      setPlans(data || []);
    }
    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingPlan(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      duration_months: "1",
      plan_type: "cliente_palestra",
      is_active: true
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || "",
      price: plan.price.toString(),
      duration_months: plan.duration_months.toString(),
      plan_type: plan.plan_type,
      is_active: plan.is_active
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      toast({ title: "Errore", description: "Compila nome e prezzo", variant: "destructive" });
      return;
    }

    setSaving(true);

    const planData = {
      name: formData.name,
      description: formData.description || null,
      price: parseFloat(formData.price),
      duration_months: parseInt(formData.duration_months),
      plan_type: formData.plan_type,
      is_active: formData.is_active
    };

    if (editingPlan) {
      const { error } = await supabase
        .from("membership_plans")
        .update(planData)
        .eq("id", editingPlan.id);

      if (error) {
        toast({ title: "Errore", description: "Impossibile aggiornare il piano", variant: "destructive" });
      } else {
        toast({ title: "Successo", description: "Piano aggiornato" });
        setIsDialogOpen(false);
        fetchPlans();
      }
    } else {
      const { error } = await supabase
        .from("membership_plans")
        .insert(planData);

      if (error) {
        toast({ title: "Errore", description: "Impossibile creare il piano", variant: "destructive" });
      } else {
        toast({ title: "Successo", description: "Piano creato" });
        setIsDialogOpen(false);
        fetchPlans();
      }
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletePlanId) return;

    const { error } = await supabase
      .from("membership_plans")
      .delete()
      .eq("id", deletePlanId);

    if (error) {
      toast({ title: "Errore", description: "Impossibile eliminare il piano", variant: "destructive" });
    } else {
      toast({ title: "Eliminato", description: "Piano eliminato con successo" });
      fetchPlans();
    }

    setDeletePlanId(null);
  };

  return (
    <AdminLayout title="GESTIONE PIANI" icon={<CreditCard className="w-6 h-6" />}>
      <div className="flex justify-between items-center mb-6">
        <p className="text-muted-foreground">Gestisci i piani di abbonamento disponibili</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreateDialog}>
              <Plus className="w-4 h-4" />
              Nuovo Piano
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider">
                {editingPlan ? "Modifica Piano" : "Nuovo Piano"}
              </DialogTitle>
              <DialogDescription>
                {editingPlan ? "Modifica i dettagli del piano" : "Crea un nuovo piano di abbonamento"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Es. Abbonamento Mensile"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrizione opzionale..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prezzo (€) *</Label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Durata (mesi)</Label>
                  <Select
                    value={formData.duration_months}
                    onValueChange={(v) => setFormData({ ...formData, duration_months: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 mese</SelectItem>
                      <SelectItem value="2">2 mesi</SelectItem>
                      <SelectItem value="3">3 mesi</SelectItem>
                      <SelectItem value="6">6 mesi</SelectItem>
                      <SelectItem value="12">12 mesi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo di Piano</Label>
                <Select
                  value={formData.plan_type}
                  onValueChange={(v: UserRole) => setFormData({ ...formData, plan_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente_palestra">Cliente Palestra</SelectItem>
                    <SelectItem value="cliente_coaching">Cliente Coaching</SelectItem>
                    <SelectItem value="cliente_corso">Cliente Corso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Piano Attivo</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingPlan ? "Salva" : "Crea"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display tracking-wider">Piani Abbonamento</CardTitle>
          <CardDescription>{plans.length} piani configurati</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessun piano configurato</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={openCreateDialog}>
                <Plus className="w-4 h-4" />
                Crea il primo piano
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Prezzo</TableHead>
                  <TableHead>Durata</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Euro className="w-4 h-4" />
                        {plan.price}
                      </span>
                    </TableCell>
                    <TableCell>{plan.duration_months} {plan.duration_months === 1 ? "mese" : "mesi"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {planTypeLabels[plan.plan_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.is_active ? "default" : "secondary"}>
                        {plan.is_active ? "Attivo" : "Inattivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(plan)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletePlanId(plan.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePlanId} onOpenChange={() => setDeletePlanId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il piano?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Il piano verrà rimosso permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default MembershipPlanManagement;
