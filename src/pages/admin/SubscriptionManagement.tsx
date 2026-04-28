import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  CreditCard, 
  Plus,
  Search,
  Loader2,
  Calendar,
  Euro,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  RefreshCw,
  Package,
  Minus,
  Trash2,
  Edit
} from "lucide-react";
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
import AdminLayout from "@/components/admin/AdminLayout";
import type { Database } from "@/integrations/supabase/types";
import { format, addMonths, differenceInDays, isPast, isFuture } from "date-fns";
import { it } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_months: number;
  plan_type: string;
  is_active: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  status: SubscriptionStatus;
  notes: string | null;
  profiles?: Profile;
  membership_plans?: MembershipPlan;
}

interface Payment {
  id: string;
  user_id: string;
  subscription_id: string;
  amount: number;
  payment_date: string;
  method: string;
  status: PaymentStatus;
  receipt_number: string | null;
  notes: string | null;
  profiles?: Profile;
}

interface LessonPackage {
  id: string;
  user_id: string;
  total_lessons: number;
  remaining_lessons: number;
  price: number;
  notes: string | null;
  created_at: string;
}

const statusLabels: Record<SubscriptionStatus, string> = {
  attivo: "Attivo",
  scaduto: "Scaduto",
  sospeso: "Sospeso",
  cancellato: "Cancellato"
};

const statusBadgeVariant: Record<SubscriptionStatus, "default" | "secondary" | "destructive" | "outline"> = {
  attivo: "default",
  scaduto: "destructive",
  sospeso: "secondary",
  cancellato: "outline"
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  completato: "Completato",
  in_attesa: "In Attesa",
  fallito: "Fallito",
  rimborsato: "Rimborsato"
};
type UserRole = Database["public"]["Enums"]["user_role"];

const planTypeLabels: Record<string, string> = {
  admin: "Amministratore",
  coach: "Coach",
  cliente_palestra: "Cliente Palestra",
  cliente_coaching: "Cliente Coaching",
  cliente_corso: "Cliente Corso"
};

const SubscriptionManagement = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("subscriptions");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("filter") || "tutti");
  
  // Data states
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [allPlans, setAllPlans] = useState<MembershipPlan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [lessonPackages, setLessonPackages] = useState<LessonPackage[]>([]);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [deletingPackageId, setDeletingPackageId] = useState<string | null>(null);

  // Plan management states
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: "",
    description: "",
    price: "",
    duration_months: "1",
    plan_type: "cliente_palestra" as UserRole,
    is_active: true
  });

  // Dialog states
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isPackageDialogOpen, setIsPackageDialogOpen] = useState(false);
  const [isPackagePaymentDialogOpen, setIsPackagePaymentDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form states
  const [newSubscription, setNewSubscription] = useState({
    user_id: "",
    plan_id: "",
    notes: ""
  });

  const [newPayment, setNewPayment] = useState({
    subscription_id: "",
    amount: "",
    method: "contanti",
    notes: ""
  });

  const [newPackage, setNewPackage] = useState({
    user_id: "",
    total_lessons: "",
    price: "",
    notes: ""
  });

  const [newPackagePayment, setNewPackagePayment] = useState({
    package_id: "",
    amount: "",
    method: "contanti",
    notes: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch all data in parallel
    const [subsRes, plansRes, allPlansRes, paymentsRes, clientsRes, packagesRes] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("*, membership_plans(id, name, price, duration_months)")
        .order("end_date", { ascending: true }),
      supabase
        .from("membership_plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true }),
      supabase
        .from("membership_plans")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("*")
        .order("payment_date", { ascending: false })
        .limit(50),
      supabase
        .from("profiles")
        .select("*")
        .in("role", ["cliente_palestra", "cliente_coaching", "cliente_corso"])
        .order("last_name", { ascending: true }),
      supabase
        .from("lesson_packages")
        .select("*")
        .order("created_at", { ascending: false })
    ]);

    if (subsRes.error) console.error("Subscriptions error:", subsRes.error);
    if (plansRes.error) console.error("Plans error:", plansRes.error);
    if (paymentsRes.error) console.error("Payments error:", paymentsRes.error);
    if (clientsRes.error) console.error("Clients error:", clientsRes.error);
    if (packagesRes.error) console.error("Packages error:", packagesRes.error);

    // Create profiles map for manual join
    const profilesMap = new Map((clientsRes.data || []).map(p => [p.user_id, p]));
    
    // Add profiles to subscriptions manually
    const subscriptionsWithProfiles = (subsRes.data || []).map(sub => ({
      ...sub,
      profiles: profilesMap.get(sub.user_id)
    }));

    // Add profiles to payments manually
    const paymentsWithProfiles = (paymentsRes.data || []).map(pay => ({
      ...pay,
      profiles: profilesMap.get(pay.user_id)
    }));

    setSubscriptions(subscriptionsWithProfiles as unknown as Subscription[]);
    setPlans(plansRes.data || []);
    setAllPlans((allPlansRes.data || []) as MembershipPlan[]);
    setPayments(paymentsWithProfiles as unknown as Payment[]);
    setClients(clientsRes.data || []);
    setLessonPackages((packagesRes.data || []) as unknown as LessonPackage[]);
    setLoading(false);
  };

  // Plan management functions
  const openCreatePlanDialog = () => {
    setEditingPlan(null);
    setPlanForm({ name: "", description: "", price: "", duration_months: "1", plan_type: "cliente_palestra", is_active: true });
    setIsPlanDialogOpen(true);
  };

  const openEditPlanDialog = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description || "",
      price: plan.price.toString(),
      duration_months: plan.duration_months.toString(),
      plan_type: plan.plan_type as UserRole,
      is_active: plan.is_active
    });
    setIsPlanDialogOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.name || !planForm.price) {
      toast({ title: "Errore", description: "Compila nome e prezzo", variant: "destructive" });
      return;
    }
    setSavingPlan(true);
    const planData = {
      name: planForm.name,
      description: planForm.description || null,
      price: parseFloat(planForm.price),
      duration_months: parseInt(planForm.duration_months),
      plan_type: planForm.plan_type,
      is_active: planForm.is_active
    };

    if (editingPlan) {
      const { error } = await supabase.from("membership_plans").update(planData).eq("id", editingPlan.id);
      if (error) {
        toast({ title: "Errore", description: "Impossibile aggiornare il piano", variant: "destructive" });
      } else {
        toast({ title: "Successo", description: "Piano aggiornato" });
        setIsPlanDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from("membership_plans").insert(planData);
      if (error) {
        toast({ title: "Errore", description: "Impossibile creare il piano", variant: "destructive" });
      } else {
        toast({ title: "Successo", description: "Piano creato" });
        setIsPlanDialogOpen(false);
        fetchData();
      }
    }
    setSavingPlan(false);
  };

  const handleDeletePlan = async () => {
    if (!deletePlanId) return;
    const { error } = await supabase.from("membership_plans").delete().eq("id", deletePlanId);
    if (error) {
      toast({ title: "Errore", description: "Impossibile eliminare il piano", variant: "destructive" });
    } else {
      toast({ title: "Eliminato", description: "Piano eliminato" });
      fetchData();
    }
    setDeletePlanId(null);
  };

  // Renew subscription: extend end_date by plan's duration_months
  const handleRenewSubscription = async (sub: Subscription) => {
    if (!sub.membership_plans) {
      toast({ title: "Errore", description: "Piano non trovato per questo abbonamento", variant: "destructive" });
      return;
    }
    setRenewingId(sub.id);
    const currentEnd = new Date(sub.end_date);
    const newEndDate = addMonths(currentEnd, sub.membership_plans.duration_months);

    const { error } = await supabase
      .from("subscriptions")
      .update({ 
        end_date: format(newEndDate, "yyyy-MM-dd"),
        status: "attivo" as SubscriptionStatus
      })
      .eq("id", sub.id);

    if (error) {
      toast({ title: "Errore", description: "Impossibile rinnovare l'abbonamento", variant: "destructive" });
    } else {
      toast({ 
        title: "Rinnovato!", 
        description: `Abbonamento rinnovato fino al ${format(newEndDate, "dd MMM yyyy", { locale: it })}` 
      });
      fetchData();
    }
    setRenewingId(null);
  };

  // Create lesson package
  const createPackage = async () => {
    if (!newPackage.user_id || !newPackage.total_lessons || !newPackage.price) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("lesson_packages").insert({
      user_id: newPackage.user_id,
      total_lessons: parseInt(newPackage.total_lessons),
      remaining_lessons: parseInt(newPackage.total_lessons),
      price: parseFloat(newPackage.price),
      notes: newPackage.notes || null,
      created_by: profile?.user_id
    });

    if (error) {
      toast({ title: "Errore", description: "Impossibile creare il pacchetto", variant: "destructive" });
    } else {
      toast({ title: "Pacchetto creato", description: `${newPackage.total_lessons} lezioni assegnate` });
      setNewPackage({ user_id: "", total_lessons: "", price: "", notes: "" });
      setIsPackageDialogOpen(false);
      fetchData();
    }
    setCreating(false);
  };

  // Delete lesson package
  const deletePackage = async () => {
    if (!deletingPackageId) return;
    const { error } = await supabase.from("lesson_packages").delete().eq("id", deletingPackageId);
    if (error) {
      toast({ title: "Errore", description: "Impossibile eliminare il pacchetto", variant: "destructive" });
    } else {
      toast({ title: "Eliminato", description: "Pacchetto lezioni eliminato" });
      fetchData();
    }
    setDeletingPackageId(null);
  };

  // Record package payment (standalone, not linked to subscription)
  const recordPackagePayment = async () => {
    if (!newPackagePayment.package_id || !newPackagePayment.amount) {
      toast({ title: "Errore", description: "Seleziona un pacchetto e inserisci l'importo", variant: "destructive" });
      return;
    }
    setCreating(true);
    const pkg = lessonPackages.find(p => p.id === newPackagePayment.package_id);
    if (!pkg) { setCreating(false); return; }

    // We need a subscription_id for payments table — create a dummy approach
    // Better: record as a note on the package + use a general payment log
    // For now, insert into payments with a special note
    // Actually the payments table requires subscription_id, so let's just track it as a note update on the package
    // and show it in the payments tab via a workaround
    
    // Update: payments table requires subscription_id (NOT NULL), so we can't use it directly for packages.
    // Instead, let's update the package notes with payment info
    const paymentNote = `Pagamento €${newPackagePayment.amount} (${newPackagePayment.method}) - ${format(new Date(), "dd/MM/yyyy")}${newPackagePayment.notes ? ` - ${newPackagePayment.notes}` : ''}`;
    const existingNotes = pkg.notes || '';
    const updatedNotes = existingNotes ? `${existingNotes}\n${paymentNote}` : paymentNote;

    const { error } = await supabase.from("lesson_packages").update({ notes: updatedNotes }).eq("id", pkg.id);
    if (error) {
      toast({ title: "Errore", description: "Impossibile registrare il pagamento", variant: "destructive" });
    } else {
      toast({ title: "Pagamento registrato", description: `€${newPackagePayment.amount} per pacchetto lezioni` });
      setNewPackagePayment({ package_id: "", amount: "", method: "contanti", notes: "" });
      setIsPackagePaymentDialogOpen(false);
      fetchData();
    }
    setCreating(false);
  };

  const createSubscription = async () => {
    if (!newSubscription.user_id || !newSubscription.plan_id) {
      toast({
        title: "Errore",
        description: "Seleziona un cliente e un piano",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    const selectedPlan = plans.find(p => p.id === newSubscription.plan_id);
    if (!selectedPlan) {
      setCreating(false);
      return;
    }

    const startDate = new Date();
    const endDate = addMonths(startDate, selectedPlan.duration_months);

    const { error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: newSubscription.user_id,
        plan_id: newSubscription.plan_id,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        status: "attivo",
        notes: newSubscription.notes || null
      });

    if (error) {
      console.error("Subscription error:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare l'abbonamento",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Abbonamento creato",
        description: "L'abbonamento è stato attivato con successo"
      });
      setNewSubscription({ user_id: "", plan_id: "", notes: "" });
      setIsSubscriptionDialogOpen(false);
      fetchData();
    }
    setCreating(false);
  };

  const recordPayment = async () => {
    if (!newPayment.subscription_id || !newPayment.amount) {
      toast({
        title: "Errore",
        description: "Seleziona un abbonamento e inserisci l'importo",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    const subscription = subscriptions.find(s => s.id === newPayment.subscription_id);
    if (!subscription) {
      setCreating(false);
      return;
    }

    const { error } = await supabase
      .from("payments")
      .insert({
        user_id: subscription.user_id,
        subscription_id: newPayment.subscription_id,
        amount: parseFloat(newPayment.amount),
        method: newPayment.method,
        status: "completato",
        notes: newPayment.notes || null,
        recorded_by: profile?.user_id
      });

    if (error) {
      console.error("Payment error:", error);
      toast({
        title: "Errore",
        description: "Impossibile registrare il pagamento",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Pagamento registrato",
        description: "Il pagamento è stato registrato con successo"
      });
      setNewPayment({ subscription_id: "", amount: "", method: "contanti", notes: "" });
      setIsPaymentDialogOpen(false);
      fetchData();
    }
    setCreating(false);
  };

  const getExpirationStatus = (endDate: string) => {
    const end = new Date(endDate);
    const daysLeft = differenceInDays(end, new Date());
    
    if (isPast(end)) {
      return { label: "Scaduto", variant: "destructive" as const, icon: AlertTriangle };
    } else if (daysLeft <= 7) {
      return { label: `${daysLeft}g rimasti`, variant: "secondary" as const, icon: Clock };
    } else if (daysLeft <= 30) {
      return { label: `${daysLeft}g rimasti`, variant: "outline" as const, icon: Calendar };
    }
    return { label: `${daysLeft}g rimasti`, variant: "default" as const, icon: CheckCircle };
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const clientName = sub.profiles 
      ? `${sub.profiles.first_name} ${sub.profiles.last_name}`.toLowerCase()
      : "";
    if (!clientName.includes(searchTerm.toLowerCase())) return false;
    
    if (statusFilter === "scaduti") {
      return isPast(new Date(sub.end_date));
    } else if (statusFilter === "in_scadenza") {
      const daysLeft = differenceInDays(new Date(sub.end_date), new Date());
      return daysLeft >= 0 && daysLeft <= 7;
    }
    return true;
  });

  const expiringCount = subscriptions.filter(s => {
    const daysLeft = differenceInDays(new Date(s.end_date), new Date());
    return daysLeft <= 7 && daysLeft >= 0;
  }).length;

  const expiredCount = subscriptions.filter(s => isPast(new Date(s.end_date))).length;

  return (
    <AdminLayout title="ABBONAMENTI" icon={<CreditCard className="w-6 h-6" />}>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Users className="w-10 h-10 text-primary" />
            <div>
              <p className="text-2xl font-display">{subscriptions.length}</p>
              <p className="text-sm text-muted-foreground">Abbonamenti Totali</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <CheckCircle className="w-10 h-10 text-primary" />
            <div>
              <p className="text-2xl font-display">{subscriptions.filter(s => s.status === "attivo" && !isPast(new Date(s.end_date))).length}</p>
              <p className="text-sm text-muted-foreground">Attivi</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Clock className="w-10 h-10 text-muted-foreground" />
            <div>
              <p className="text-2xl font-display">{expiringCount}</p>
              <p className="text-sm text-muted-foreground">In Scadenza (7gg)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <AlertTriangle className="w-10 h-10 text-destructive" />
            <div>
              <p className="text-2xl font-display">{expiredCount}</p>
              <p className="text-sm text-muted-foreground">Scaduti</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
        <div className="flex flex-col gap-4 mb-6 justify-between min-w-0">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:inline-flex md:h-10 md:w-auto">
            <TabsTrigger value="subscriptions">Abbonamenti</TabsTrigger>
            <TabsTrigger value="packages">Pacchetti Lezioni</TabsTrigger>
            <TabsTrigger value="payments">Pagamenti</TabsTrigger>
            <TabsTrigger value="plans">Piani</TabsTrigger>
          </TabsList>
          <div className="flex flex-col md:flex-row gap-2 min-w-0">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setSearchParams(v === "tutti" ? {} : { filter: v }); }}>
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Filtra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti</SelectItem>
                <SelectItem value="scaduti">Scaduti</SelectItem>
                <SelectItem value="in_scadenza">In Scadenza (7gg)</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-0 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cerca cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Dialog open={isSubscriptionDialogOpen} onOpenChange={setIsSubscriptionDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 w-full md:w-auto"><Plus className="w-4 h-4" />Nuovo Abbonamento</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display tracking-wider">Nuovo Abbonamento</DialogTitle>
                  <DialogDescription>Crea un nuovo abbonamento per un cliente</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Cliente *</Label>
                    <Select value={newSubscription.user_id} onValueChange={(v) => setNewSubscription({...newSubscription, user_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Seleziona cliente" /></SelectTrigger>
                      <SelectContent>{clients.map(c => <SelectItem key={c.user_id} value={c.user_id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Piano *</Label>
                    <Select value={newSubscription.plan_id} onValueChange={(v) => setNewSubscription({...newSubscription, plan_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Seleziona piano" /></SelectTrigger>
                      <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} - €{p.price} ({p.duration_months} mesi)</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Note</Label>
                    <Input value={newSubscription.notes} onChange={(e) => setNewSubscription({...newSubscription, notes: e.target.value})} placeholder="Note opzionali" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsSubscriptionDialogOpen(false)}>Annulla</Button>
                  <Button onClick={createSubscription} disabled={creating}>{creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Crea Abbonamento</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="gap-2 w-full md:w-auto"><Euro className="w-4 h-4" />Registra Pagamento</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display tracking-wider">Registra Pagamento</DialogTitle>
                  <DialogDescription>Registra un nuovo pagamento per un abbonamento</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Abbonamento *</Label>
                    <Select value={newPayment.subscription_id} onValueChange={(v) => {
                      const sub = subscriptions.find(s => s.id === v);
                      setNewPayment({ ...newPayment, subscription_id: v, amount: sub?.membership_plans?.price?.toString() || "" });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Seleziona abbonamento" /></SelectTrigger>
                      <SelectContent>{subscriptions.map(s => <SelectItem key={s.id} value={s.id}>{s.profiles?.first_name} {s.profiles?.last_name} - {s.membership_plans?.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Importo (€) *</Label>
                    <Input type="number" value={newPayment.amount} onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Metodo di Pagamento</Label>
                    <Select value={newPayment.method} onValueChange={(v) => setNewPayment({...newPayment, method: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contanti">Contanti</SelectItem>
                        <SelectItem value="carta">Carta</SelectItem>
                        <SelectItem value="bonifico">Bonifico</SelectItem>
                        <SelectItem value="satispay">Satispay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Note</Label>
                    <Input value={newPayment.notes} onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})} placeholder="Note opzionali" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Annulla</Button>
                  <Button onClick={recordPayment} disabled={creating}>{creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Registra Pagamento</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle className="font-display tracking-wider">Abbonamenti Attivi</CardTitle>
              <CardDescription>{filteredSubscriptions.length} abbonamenti trovati</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : filteredSubscriptions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>Nessun abbonamento trovato</p></div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead><TableHead>Tipo</TableHead><TableHead>Piano</TableHead>
                        <TableHead>Inizio</TableHead><TableHead>Scadenza</TableHead><TableHead>Stato</TableHead><TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubscriptions.map((sub) => {
                        const expStatus = getExpirationStatus(sub.end_date);
                        const roleLabel = sub.profiles?.role === 'cliente_coaching' ? 'Coaching' : sub.profiles?.role === 'cliente_corso' ? 'Corso' : 'Palestra';
                        const roleVariant = sub.profiles?.role === 'cliente_coaching' ? 'default' : sub.profiles?.role === 'cliente_corso' ? 'secondary' : 'outline';
                        return (
                          <TableRow key={sub.id}>
                            <TableCell className="font-medium">{sub.profiles?.first_name} {sub.profiles?.last_name}</TableCell>
                            <TableCell><Badge variant={roleVariant as any}>{roleLabel}</Badge></TableCell>
                            <TableCell>{sub.membership_plans?.name}</TableCell>
                            <TableCell>{format(new Date(sub.start_date), "dd MMM yyyy", { locale: it })}</TableCell>
                            <TableCell>{format(new Date(sub.end_date), "dd MMM yyyy", { locale: it })}</TableCell>
                            <TableCell>
                              <Badge variant={expStatus.variant} className="gap-1">
                                <expStatus.icon className="w-3 h-3" />{expStatus.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="gap-1 h-8"
                                onClick={() => handleRenewSubscription(sub)}
                                disabled={renewingId === sub.id}
                              >
                                {renewingId === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                Rinnova
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pacchetti Lezioni Tab */}
        <TabsContent value="packages">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="font-display tracking-wider">Pacchetti Lezioni Private</CardTitle>
                  <CardDescription>{lessonPackages.length} pacchetti registrati</CardDescription>
                </div>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                <Dialog open={isPackagePaymentDialogOpen} onOpenChange={setIsPackagePaymentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" className="gap-2 w-full md:w-auto"><Euro className="w-4 h-4" />Registra Pagamento</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-display tracking-wider">Pagamento Pacchetto</DialogTitle>
                      <DialogDescription>Registra un pagamento per un pacchetto lezioni</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>Pacchetto *</Label>
                        <Select value={newPackagePayment.package_id} onValueChange={(v) => {
                          const pkg = lessonPackages.find(p => p.id === v);
                          setNewPackagePayment({ ...newPackagePayment, package_id: v, amount: pkg?.price?.toString() || "" });
                        }}>
                          <SelectTrigger><SelectValue placeholder="Seleziona pacchetto" /></SelectTrigger>
                          <SelectContent>
                            {lessonPackages.map(pkg => {
                              const client = clients.find(c => c.user_id === pkg.user_id);
                              return (
                                <SelectItem key={pkg.id} value={pkg.id}>
                                  {client ? `${client.first_name} ${client.last_name}` : "—"} — {pkg.total_lessons} lezioni (€{pkg.price})
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Importo (€) *</Label>
                        <Input type="number" value={newPackagePayment.amount} onChange={(e) => setNewPackagePayment({...newPackagePayment, amount: e.target.value})} placeholder="0.00" />
                      </div>
                      <div className="space-y-2">
                        <Label>Metodo di Pagamento</Label>
                        <Select value={newPackagePayment.method} onValueChange={(v) => setNewPackagePayment({...newPackagePayment, method: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contanti">Contanti</SelectItem>
                            <SelectItem value="carta">Carta</SelectItem>
                            <SelectItem value="bonifico">Bonifico</SelectItem>
                            <SelectItem value="satispay">Satispay</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Note</Label>
                        <Input value={newPackagePayment.notes} onChange={(e) => setNewPackagePayment({...newPackagePayment, notes: e.target.value})} placeholder="Note opzionali" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsPackagePaymentDialogOpen(false)}>Annulla</Button>
                      <Button onClick={recordPackagePayment} disabled={creating}>{creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Registra</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={isPackageDialogOpen} onOpenChange={setIsPackageDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 w-full md:w-auto"><Plus className="w-4 h-4" />Nuovo Pacchetto</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-display tracking-wider">Nuovo Pacchetto Lezioni</DialogTitle>
                      <DialogDescription>Assegna un pacchetto di lezioni private a un cliente</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>Cliente *</Label>
                        <Select value={newPackage.user_id} onValueChange={(v) => setNewPackage({...newPackage, user_id: v})}>
                          <SelectTrigger><SelectValue placeholder="Seleziona cliente" /></SelectTrigger>
                          <SelectContent>{clients.map(c => <SelectItem key={c.user_id} value={c.user_id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Numero Lezioni *</Label>
                          <Input type="number" value={newPackage.total_lessons} onChange={(e) => setNewPackage({...newPackage, total_lessons: e.target.value})} placeholder="Es. 10" min="1" />
                        </div>
                        <div className="space-y-2">
                          <Label>Prezzo Pacchetto (€) *</Label>
                          <Input type="number" value={newPackage.price} onChange={(e) => setNewPackage({...newPackage, price: e.target.value})} placeholder="0.00" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Note</Label>
                        <Input value={newPackage.notes} onChange={(e) => setNewPackage({...newPackage, notes: e.target.value})} placeholder="Note opzionali..." />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsPackageDialogOpen(false)}>Annulla</Button>
                      <Button onClick={createPackage} disabled={creating}>{creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Crea Pacchetto</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : lessonPackages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun pacchetto lezioni</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Lezioni Totali</TableHead>
                        <TableHead>Rimanenti</TableHead>
                        <TableHead>Usate</TableHead>
                        <TableHead>Prezzo</TableHead>
                        <TableHead>Creato</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lessonPackages.map((pkg) => {
                        const client = clients.find(c => c.user_id === pkg.user_id);
                        const usedLessons = pkg.total_lessons - pkg.remaining_lessons;
                        return (
                          <TableRow key={pkg.id}>
                            <TableCell className="font-medium">{client ? `${client.first_name} ${client.last_name}` : "—"}</TableCell>
                            <TableCell>{pkg.total_lessons}</TableCell>
                            <TableCell>
                              <Badge variant={pkg.remaining_lessons === 0 ? "destructive" : pkg.remaining_lessons <= 2 ? "secondary" : "default"}>
                                {pkg.remaining_lessons}
                              </Badge>
                            </TableCell>
                            <TableCell>{usedLessons}</TableCell>
                            <TableCell>€{pkg.price}</TableCell>
                            <TableCell>{format(new Date(pkg.created_at), "dd MMM yyyy", { locale: it })}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={pkg.notes || ''}>{pkg.notes || '—'}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive hover:text-destructive" onClick={() => setDeletingPackageId(pkg.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="font-display tracking-wider">Storico Pagamenti</CardTitle>
              <CardDescription>Ultimi {payments.length} pagamenti registrati</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : payments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><Euro className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>Nessun pagamento registrato</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead><TableHead>Cliente</TableHead>
                        <TableHead>Importo</TableHead><TableHead>Metodo</TableHead><TableHead>Stato</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{format(new Date(payment.payment_date), "dd MMM yyyy", { locale: it })}</TableCell>
                          <TableCell className="font-medium">{payment.profiles?.first_name} {payment.profiles?.last_name}</TableCell>
                          <TableCell className="font-medium">€{payment.amount.toFixed(2)}</TableCell>
                          <TableCell className="capitalize">{payment.method}</TableCell>
                          <TableCell>
                            <Badge variant={payment.status === "completato" ? "default" : "secondary"}>
                              {paymentStatusLabels[payment.status]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="font-display tracking-wider">Gestione Piani</CardTitle>
                <CardDescription>{allPlans.length} piani configurati</CardDescription>
              </div>
              <Button className="gap-2 w-full md:w-auto" onClick={openCreatePlanDialog}>
                <Plus className="w-4 h-4" />
                Nuovo Piano
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : allPlans.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun piano configurato</p>
                  <Button variant="outline" className="mt-4 gap-2" onClick={openCreatePlanDialog}>
                    <Plus className="w-4 h-4" />Crea il primo piano
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
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
                      {allPlans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium">{plan.name}</TableCell>
                          <TableCell><span className="flex items-center gap-1"><Euro className="w-4 h-4" />{plan.price}</span></TableCell>
                          <TableCell>{plan.duration_months} {plan.duration_months === 1 ? "mese" : "mesi"}</TableCell>
                          <TableCell><Badge variant="outline">{planTypeLabels[plan.plan_type] || plan.plan_type}</Badge></TableCell>
                          <TableCell><Badge variant={plan.is_active ? "default" : "secondary"}>{plan.is_active ? "Attivo" : "Inattivo"}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditPlanDialog(plan)}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeletePlanId(plan.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Plan Create/Edit Dialog */}
      <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
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
              <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Es. Abbonamento Mensile" />
            </div>
            <div className="space-y-2">
              <Label>Descrizione</Label>
              <Input value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} placeholder="Descrizione opzionale..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prezzo (€) *</Label>
                <Input type="number" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Durata (mesi)</Label>
                <Select value={planForm.duration_months} onValueChange={(v) => setPlanForm({ ...planForm, duration_months: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Select value={planForm.plan_type} onValueChange={(v: UserRole) => setPlanForm({ ...planForm, plan_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente_palestra">Cliente Palestra</SelectItem>
                  <SelectItem value="cliente_coaching">Cliente Coaching</SelectItem>
                  <SelectItem value="cliente_corso">Cliente Corso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Piano Attivo</Label>
              <Switch checked={planForm.is_active} onCheckedChange={(checked) => setPlanForm({ ...planForm, is_active: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPlanDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSavePlan} disabled={savingPlan}>
              {savingPlan && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingPlan ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Plan Confirmation */}
      <AlertDialog open={!!deletePlanId} onOpenChange={() => setDeletePlanId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il piano?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione non può essere annullata.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Package Confirmation */}
      <AlertDialog open={!!deletingPackageId} onOpenChange={() => setDeletingPackageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il pacchetto lezioni?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Il pacchetto e il suo storico verranno rimossi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={deletePackage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default SubscriptionManagement;