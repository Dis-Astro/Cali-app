import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  ArrowLeft, 
  Loader2, 
  CreditCard, 
  Dumbbell, 
  Calendar,
  Phone,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  Euro,
  FileText,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Users
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AdminLayout from "@/components/admin/AdminLayout";
import WorkoutPlanViewDialog from "@/components/admin/WorkoutPlanViewDialog";
import WorkoutPlanCard from "@/components/admin/WorkoutPlanCard";
import CoachAssignmentManager from "@/components/admin/CoachAssignmentManager";
import PasswordResetDialog from "@/components/admin/PasswordResetDialog";
import ClientProgressView from "@/components/coaching/ClientProgressView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { format, differenceInDays, isPast, addMonths } from "date-fns";
import { it } from "date-fns/locale";

type UserRole = Database["public"]["Enums"]["user_role"];
type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  fiscal_code: string | null;
  emergency_contact: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  duration_months: number;
}

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  status: SubscriptionStatus;
  notes: string | null;
  membership_plans?: MembershipPlan;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  method: string;
  status: string;
  notes: string | null;
}

interface WorkoutPlan {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface ClientAppointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  coach_id: string;
  description: string | null;
  location: string | null;
}

const roleLabels: Record<UserRole, string> = {
  admin: "Amministratore",
  coach: "Coach",
  cliente_palestra: "Cliente Palestra",
  cliente_coaching: "Cliente Coaching",
  cliente_corso: "Cliente Corso"
};

const ClientDetailPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [clientAppointments, setClientAppointments] = useState<ClientAppointment[]>([]);
  const [coachProfiles, setCoachProfiles] = useState<Map<string, string>>(new Map());
  
  // Dialog states
  const [viewPlanId, setViewPlanId] = useState<string | null>(null);

  // New subscription dialog
  const [isNewSubOpen, setIsNewSubOpen] = useState(false);
  const [newSubForm, setNewSubForm] = useState({ plan_id: "", notes: "", custom_end_date: "" });
  const [creatingSub, setCreatingSub] = useState(false);

  // New payment dialog
  const [isNewPayOpen, setIsNewPayOpen] = useState(false);
  const [newPayForm, setNewPayForm] = useState({ subscription_id: "", amount: "", method: "contanti", notes: "" });
  const [creatingPay, setCreatingPay] = useState(false);

  // Edit subscription end date
  const [editingEndDateSubId, setEditingEndDateSubId] = useState<string | null>(null);
  const [editingEndDate, setEditingEndDate] = useState("");
  const [savingEndDate, setSavingEndDate] = useState(false);

  useEffect(() => {
    if (userId) fetchClientData();
  }, [userId]);

  const fetchClientData = async () => {
    setLoading(true);
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profileError) {
      toast({ title: "Errore", description: "Cliente non trovato", variant: "destructive" });
      navigate("/admin/utenti");
      return;
    }
    setProfile(profileData);

    const [subsRes, paymentsRes, plansRes, membershipPlansRes, appointmentsRes, coachesRes] = await Promise.all([
      supabase.from("subscriptions").select("*, membership_plans(id, name, price, duration_months)").eq("user_id", userId).order("end_date", { ascending: false }),
      supabase.from("payments").select("*").eq("user_id", userId).order("payment_date", { ascending: false }),
      (supabase.from("workout_plans").select("*").eq("client_id", userId) as any).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("membership_plans").select("id, name, price, duration_months").eq("is_active", true).order("price"),
      supabase.from("appointments").select("id, title, start_time, end_time, coach_id, description, location").eq("client_id", userId).order("start_time", { ascending: false }),
      supabase.from("profiles").select("user_id, first_name, last_name").in("role", ["admin", "coach"])
    ]);

    setSubscriptions((subsRes.data as unknown as Subscription[]) || []);
    setPayments(paymentsRes.data || []);
    setWorkoutPlans(plansRes.data || []);
    setMembershipPlans(membershipPlansRes.data || []);
    setClientAppointments((appointmentsRes.data || []) as ClientAppointment[]);
    if (coachesRes.data) {
      const map = new Map<string, string>();
      coachesRes.data.forEach((c: any) => map.set(c.user_id, `${c.first_name} ${c.last_name}`));
      setCoachProfiles(map);
    }
    setLoading(false);
  };

  const handleDeleteSubscription = async (subId: string) => {
    const { error } = await supabase.from("subscriptions").delete().eq("id", subId);
    if (error) {
      toast({ title: "Errore", description: "Impossibile eliminare l'abbonamento", variant: "destructive" });
    } else {
      toast({ title: "Eliminato", description: "Abbonamento eliminato" });
      fetchClientData();
    }
  };

  const handleCreateSubscription = async () => {
    if (!newSubForm.plan_id) {
      toast({ title: "Errore", description: "Seleziona un piano", variant: "destructive" });
      return;
    }
    setCreatingSub(true);
    const selectedPlan = membershipPlans.find(p => p.id === newSubForm.plan_id);
    if (!selectedPlan) { setCreatingSub(false); return; }

    const startDate = new Date();
    const endDate = newSubForm.custom_end_date 
      ? new Date(newSubForm.custom_end_date)
      : addMonths(startDate, selectedPlan.duration_months);

    const { error } = await supabase.from("subscriptions").insert({
      user_id: userId!,
      plan_id: newSubForm.plan_id,
      start_date: format(startDate, "yyyy-MM-dd"),
      end_date: format(endDate, "yyyy-MM-dd"),
      status: "attivo",
      notes: newSubForm.notes || null
    });

    if (error) {
      toast({ title: "Errore", description: "Impossibile creare l'abbonamento", variant: "destructive" });
    } else {
      toast({ title: "Abbonamento creato!" });
      setNewSubForm({ plan_id: "", notes: "", custom_end_date: "" });
      setIsNewSubOpen(false);
      fetchClientData();
    }
    setCreatingSub(false);
  };

  const handleCreatePayment = async () => {
    if (!newPayForm.subscription_id || !newPayForm.amount) {
      toast({ title: "Errore", description: "Seleziona abbonamento e importo", variant: "destructive" });
      return;
    }
    setCreatingPay(true);
    const sub = subscriptions.find(s => s.id === newPayForm.subscription_id);
    if (!sub) { setCreatingPay(false); return; }

    const { error } = await supabase.from("payments").insert({
      user_id: userId!,
      subscription_id: newPayForm.subscription_id,
      amount: parseFloat(newPayForm.amount),
      method: newPayForm.method,
      status: "completato",
      notes: newPayForm.notes || null
    });

    if (error) {
      toast({ title: "Errore", description: "Impossibile registrare il pagamento", variant: "destructive" });
    } else {
      toast({ title: "Pagamento registrato!" });
      setNewPayForm({ subscription_id: "", amount: "", method: "contanti", notes: "" });
      setIsNewPayOpen(false);
      fetchClientData();
    }
    setCreatingPay(false);
  };

  const handleSaveEndDate = async (subId: string) => {
    if (!editingEndDate) return;
    setSavingEndDate(true);
    const { error } = await supabase.from("subscriptions").update({ end_date: editingEndDate }).eq("id", subId);
    if (error) {
      toast({ title: "Errore", description: "Impossibile aggiornare la scadenza", variant: "destructive" });
    } else {
      toast({ title: "Scadenza aggiornata!" });
      setEditingEndDateSubId(null);
      fetchClientData();
    }
    setSavingEndDate(false);
  };

  const getSubscriptionStatus = (sub: Subscription) => {
    const daysLeft = differenceInDays(new Date(sub.end_date), new Date());
    if (isPast(new Date(sub.end_date))) return { label: "Scaduto", variant: "destructive" as const, icon: AlertTriangle };
    if (daysLeft <= 7) return { label: `${daysLeft}g rimasti`, variant: "secondary" as const, icon: Clock };
    return { label: "Attivo", variant: "default" as const, icon: CheckCircle };
  };

  const activeSubscription = subscriptions.find(s => s.status === "attivo" && !isPast(new Date(s.end_date)));
  const totalPayments = payments.filter(p => p.status === "completato").reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <AdminLayout title="DETTAGLIO CLIENTE" icon={<User className="w-6 h-6" />} showBackLink>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!profile) return null;

  return (
    <AdminLayout title="DETTAGLIO CLIENTE" icon={<User className="w-6 h-6" />} showBackLink>
      <Button variant="ghost" onClick={() => navigate("/admin/utenti")} className="mb-4 gap-2">
        <ArrowLeft className="w-4 h-4" />
        Torna all'elenco utenti
      </Button>

      {/* ── HEADER CLIENTE ── */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-display tracking-wider">{profile.first_name} {profile.last_name}</h2>
                <Badge variant="outline">{roleLabels[profile.role]}</Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {profile.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{profile.phone}</span>}
                {profile.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{profile.address}</span>}
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Iscritto {format(new Date(profile.created_at), "dd MMM yyyy", { locale: it })}</span>
              </div>
              <div className="mt-3">
                <PasswordResetDialog userId={profile.user_id} userName={`${profile.first_name} ${profile.last_name}`} />
              </div>
            </div>
            {/* Stats rapide */}
            <div className="flex gap-3">
              <div className="text-center p-3 bg-muted rounded-lg min-w-[70px]">
                <p className="text-xl font-display text-primary">{activeSubscription ? "✓" : "✗"}</p>
                <p className="text-xs text-muted-foreground">Abbonamento</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg min-w-[70px]">
                <p className="text-xl font-display">{workoutPlans.length}</p>
                <p className="text-xs text-muted-foreground">Schede</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg min-w-[70px]">
                <p className="text-xl font-display">€{totalPayments}</p>
                <p className="text-xs text-muted-foreground">Pagato</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── LAYOUT A DUE COLONNE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COLONNA SINISTRA: Abbonamento + Pagamenti */}
        <div className="lg:col-span-1 space-y-6">

          {/* Abbonamento Attivo */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display tracking-wider flex items-center gap-2 text-base">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Abbonamento
                </CardTitle>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setIsNewSubOpen(true)}>
                  <Plus className="w-3 h-3" /> Nuovo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {subscriptions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Nessun abbonamento</p>
                  <Button variant="ghost" size="sm" className="mt-2 gap-1" onClick={() => setIsNewSubOpen(true)}>
                    <Plus className="w-3 h-3" /> Aggiungi
                  </Button>
                </div>
              ) : (
                subscriptions.map(sub => {
                  const status = getSubscriptionStatus(sub);
                  const isEditingThis = editingEndDateSubId === sub.id;
                  return (
                    <div key={sub.id} className={`p-3 rounded-lg border ${sub === activeSubscription ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">{sub.membership_plans?.name || "Piano"}</p>
                          <Badge variant={status.variant} className="gap-1 text-xs mt-1">
                            <status.icon className="w-2.5 h-2.5" />
                            {status.label}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 text-muted-foreground hover:text-foreground"
                            title="Modifica scadenza"
                            onClick={() => {
                              setEditingEndDateSubId(sub.id);
                              setEditingEndDate(sub.end_date);
                            }}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminare l'abbonamento?</AlertDialogTitle>
                                <AlertDialogDescription>Questa azione non può essere annullata.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteSubscription(sub.id)} className="bg-destructive text-destructive-foreground">Elimina</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      
                      {/* Modifica data scadenza inline */}
                      {isEditingThis ? (
                        <div className="space-y-2 mt-2 p-2 bg-background rounded border">
                          <Label className="text-xs text-muted-foreground">Nuova data scadenza</Label>
                          <Input
                            type="date"
                            value={editingEndDate}
                            onChange={e => setEditingEndDate(e.target.value)}
                            className="h-8 text-sm"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 gap-1 text-xs flex-1" onClick={() => handleSaveEndDate(sub.id)} disabled={savingEndDate}>
                              {savingEndDate ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              Salva
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditingEndDateSubId(null)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-2">
                          <div>
                            <p className="font-medium text-foreground/70">Inizio</p>
                            <p>{format(new Date(sub.start_date), "dd/MM/yyyy")}</p>
                          </div>
                          <div>
                            <p className="font-medium text-foreground/70">Scadenza</p>
                            <p className="flex items-center gap-1">
                              {format(new Date(sub.end_date), "dd/MM/yyyy")}
                              <button
                                className="text-primary hover:opacity-70 transition-opacity ml-1"
                                onClick={() => { setEditingEndDateSubId(sub.id); setEditingEndDate(sub.end_date); }}
                                title="Modifica scadenza"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Pagamenti */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display tracking-wider flex items-center gap-2 text-base">
                  <Euro className="w-4 h-4 text-primary" />
                  Pagamenti
                </CardTitle>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setIsNewPayOpen(true)} disabled={subscriptions.length === 0}>
                  <Plus className="w-3 h-3" /> Registra
                </Button>
              </div>
              {totalPayments > 0 && (
                <p className="text-sm text-muted-foreground">Totale pagato: <span className="font-medium text-foreground">€{totalPayments}</span></p>
              )}
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  <Euro className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p>Nessun pagamento</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.map(pay => (
                    <div key={pay.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                      <div>
                        <p className="font-medium">€{pay.amount}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(pay.payment_date), "dd/MM/yyyy")} · {pay.method}</p>
                      </div>
                      <Badge variant={pay.status === "completato" ? "default" : "secondary"} className="text-xs">
                        {pay.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Anagrafica compatta */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display tracking-wider flex items-center gap-2 text-base">
                <FileText className="w-4 h-4 text-primary" />
                Anagrafica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { label: "Data di nascita", value: profile.date_of_birth ? format(new Date(profile.date_of_birth), "dd/MM/yyyy") : null },
                { label: "Codice fiscale", value: profile.fiscal_code },
                { label: "Indirizzo", value: profile.address },
                { label: "Emergenza", value: profile.emergency_contact },
              ].map(({ label, value }) => value ? (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ) : null)}
            </CardContent>
          </Card>

          {/* Coach assegnato */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display tracking-wider flex items-center gap-2 text-base">
                <Users className="w-4 h-4 text-primary" />
                Coach Assegnato
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CoachAssignmentManager clientId={profile.user_id} clientRole={profile.role} onUpdate={fetchClientData} />
            </CardContent>
          </Card>
        </div>

        {/* COLONNA DESTRA: Schede Allenamento */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-display tracking-wider flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-primary" />
                    Schede di Allenamento
                  </CardTitle>
                  <CardDescription>Schede create per {profile.first_name}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => navigate(`/admin/utenti/${userId}/scheda/nuova?type=test`)}>
                    <Plus className="w-4 h-4" />
                    Nuovo Test
                  </Button>
                  <Button className="gap-2" onClick={() => navigate(`/admin/utenti/${userId}/scheda/nuova`)}>
                    <Plus className="w-4 h-4" />
                    Nuova Scheda
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="schede">
                <TabsList className="mb-4">
                  <TabsTrigger value="schede" className="gap-2"><Dumbbell className="w-4 h-4" />Schede</TabsTrigger>
                  <TabsTrigger value="andamento" className="gap-2"><TrendingUp className="w-4 h-4" />Andamento</TabsTrigger>
                </TabsList>
                <TabsContent value="schede">
                  {workoutPlans.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Dumbbell className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>Nessuna scheda assegnata</p>
                      <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate(`/admin/utenti/${userId}/scheda/nuova`)}>
                        <Plus className="w-4 h-4" />
                        Crea la prima scheda
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {workoutPlans.map(plan => (
                        <WorkoutPlanCard
                          key={plan.id}
                          plan={plan}
                          onEdit={(planId) => navigate(`/admin/utenti/${userId}/scheda/${planId}/modifica`)}
                          onView={(planId) => setViewPlanId(planId)}
                          onDelete={fetchClientData}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="andamento">
                  <ClientProgressView clientId={profile.user_id} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Storico Appuntamenti */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="font-display tracking-wider flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Storico Appuntamenti
              </CardTitle>
              <CardDescription>{clientAppointments.length} appuntamenti totali</CardDescription>
            </CardHeader>
            <CardContent>
              {clientAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nessun appuntamento registrato</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {clientAppointments.map(apt => {
                    const aptDate = new Date(apt.start_time);
                    const isPastApt = isPast(aptDate);
                    return (
                      <div key={apt.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isPastApt ? 'border-border bg-muted/20' : 'border-primary/30 bg-primary/5'}`}>
                        <div className="text-center min-w-[50px]">
                          <p className="text-lg font-display leading-none">{format(aptDate, "dd")}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{format(aptDate, "MMM yy", { locale: it })}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{apt.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(aptDate, "HH:mm")} - {format(new Date(apt.end_time), "HH:mm")}
                            {coachProfiles.get(apt.coach_id) && ` · ${coachProfiles.get(apt.coach_id)}`}
                          </p>
                          {apt.location && <p className="text-xs text-muted-foreground">📍 {apt.location}</p>}
                        </div>
                        <Badge variant={isPastApt ? "secondary" : "default"} className="text-xs flex-shrink-0">
                          {isPastApt ? "Completato" : "Prossimo"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── DIALOGS ── */}

      {/* Nuovo Abbonamento */}
      <Dialog open={isNewSubOpen} onOpenChange={setIsNewSubOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">Nuovo Abbonamento</DialogTitle>
            <DialogDescription>Crea un abbonamento per {profile.first_name} {profile.last_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Piano *</Label>
              <Select value={newSubForm.plan_id} onValueChange={v => setNewSubForm({ ...newSubForm, plan_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona piano" /></SelectTrigger>
                <SelectContent>
                  {membershipPlans.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — €{p.price} ({p.duration_months} mesi)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scadenza personalizzata <span className="text-muted-foreground">(opzionale, sovrascrive la durata del piano)</span></Label>
              <Input type="date" value={newSubForm.custom_end_date} onChange={e => setNewSubForm({ ...newSubForm, custom_end_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input value={newSubForm.notes} onChange={e => setNewSubForm({ ...newSubForm, notes: e.target.value })} placeholder="Note opzionali..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewSubOpen(false)}>Annulla</Button>
            <Button onClick={handleCreateSubscription} disabled={creatingSub}>
              {creatingSub && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crea Abbonamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nuovo Pagamento */}
      <Dialog open={isNewPayOpen} onOpenChange={setIsNewPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">Registra Pagamento</DialogTitle>
            <DialogDescription>Registra un pagamento per {profile.first_name} {profile.last_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Abbonamento *</Label>
              <Select value={newPayForm.subscription_id} onValueChange={v => setNewPayForm({ ...newPayForm, subscription_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona abbonamento" /></SelectTrigger>
                <SelectContent>
                  {subscriptions.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.membership_plans?.name} — scad. {format(new Date(s.end_date), "dd/MM/yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Importo (€) *</Label>
                <Input type="number" value={newPayForm.amount} onChange={e => setNewPayForm({ ...newPayForm, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Metodo</Label>
                <Select value={newPayForm.method} onValueChange={v => setNewPayForm({ ...newPayForm, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["contanti", "carta", "bonifico", "satispay"].map(m => (
                      <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input value={newPayForm.notes} onChange={e => setNewPayForm({ ...newPayForm, notes: e.target.value })} placeholder="Note opzionali..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewPayOpen(false)}>Annulla</Button>
            <Button onClick={handleCreatePayment} disabled={creatingPay}>
              {creatingPay && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registra Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Workout Plan */}
      <WorkoutPlanViewDialog
        planId={viewPlanId}
        open={!!viewPlanId}
        onOpenChange={(open) => !open && setViewPlanId(null)}
      />
    </AdminLayout>
  );
};

export default ClientDetailPage;
