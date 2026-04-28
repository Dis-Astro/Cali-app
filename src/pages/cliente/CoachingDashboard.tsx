import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Dumbbell, 
  Calendar, 
  TrendingUp,
  Play,
  FileText,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Flame,
  Target,
  Trophy,
  ChevronRight,
  Clock,
  Star,
  Loader2,
  User,
  AlertCircle,
  CalendarDays,
  CreditCard
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { format, isSameDay, parseISO, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";

interface WorkoutPlan {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  coach_id: string;
}

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
}

interface Coach {
  first_name: string;
  last_name: string;
}

interface Subscription {
  id: string;
  status: string;
  end_date: string;
  plan_name: string;
}

const CoachingDashboard = () => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [myCoach, setMyCoach] = useState<Coach | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [weekProgress, setWeekProgress] = useState(0);
  const [completedWorkouts, setCompletedWorkouts] = useState(0);

  const navigationItems = [
    { icon: Target, label: "Dashboard", href: "/coaching" },
    { icon: Dumbbell, label: "La Mia Scheda", href: "/coaching/scheda" },
    { icon: TrendingUp, label: "I Miei Progressi", href: "/coaching/progressi" },
    { icon: Calendar, label: "Appuntamenti", href: "/coaching/appuntamenti" },
    { icon: MessageSquare, label: "Segnala Problema", href: "/coaching/segnala" },
    { icon: FileText, label: "Documenti", href: "/coaching/documenti" },
  ];

  useEffect(() => {
    if (profile?.user_id) {
      fetchData();
    }
  }, [profile?.user_id]);

  const fetchData = async () => {
    setLoading(true);
    const userId = profile?.user_id;
    const today = new Date().toISOString();

    // Fetch active workout plan
    const { data: plans } = await supabase
      .from("workout_plans")
      .select("*")
      .eq("client_id", userId)
      .eq("is_active", true)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("created_at", { ascending: false })
      .limit(1);

    if (plans && plans.length > 0) {
      setActivePlan(plans[0]);

      // Fetch coach info
      const { data: coachData } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", plans[0].coach_id)
        .single();

      if (coachData) setMyCoach(coachData);
    }

    // Fetch upcoming appointments
    const { data: appointments } = await supabase
      .from("appointments")
      .select("*")
      .eq("client_id", userId)
      .gte("start_time", today)
      .order("start_time")
      .limit(3);

    if (appointments) setUpcomingAppointments(appointments);

    // Fetch active subscription
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id, status, end_date, plan:membership_plans(name)")
      .eq("user_id", userId)
      .eq("status", "attivo")
      .order("end_date", { ascending: false })
      .limit(1);

    if (subs && subs.length > 0) {
      setSubscription({
        id: subs[0].id,
        status: subs[0].status,
        end_date: subs[0].end_date,
        plan_name: (subs[0].plan as any)?.name || "Piano"
      });
    }

    // Calculate actual week progress from workout_completions
    if (plans && plans.length > 0) {
      const planId = plans[0].id;
      
      // Get all exercises in the plan
      const { data: planExercises } = await supabase
        .from("workout_plan_exercises")
        .select("id, sets")
        .eq("workout_plan_id", planId);
      
      if (planExercises && planExercises.length > 0) {
        // Calculate total expected sets
        const totalExpectedSets = planExercises.reduce((sum, ex) => sum + (ex.sets || 3), 0);
        
        // Get completions for this week
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
        weekStart.setHours(0, 0, 0, 0);
        
        const exerciseIds = planExercises.map(e => e.id);
        const { data: completions } = await supabase
          .from("workout_completions")
          .select("id")
          .eq("client_id", userId!)
          .in("workout_plan_exercise_id", exerciseIds)
          .gte("completed_at", weekStart.toISOString());
        
        const completedSets = completions?.length || 0;
        const progress = totalExpectedSets > 0 ? Math.round((completedSets / totalExpectedSets) * 100) : 0;
        
        setWeekProgress(Math.min(progress, 100));
        setCompletedWorkouts(completedSets);
      } else {
        setWeekProgress(0);
        setCompletedWorkouts(0);
      }
    } else {
      setWeekProgress(0);
      setCompletedWorkouts(0);
    }

    setLoading(false);
  };

  const getDaysRemaining = () => {
    if (!activePlan) return 0;
    return differenceInDays(new Date(activePlan.end_date), new Date());
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Premium Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 
        bg-gradient-to-b from-sidebar-background via-sidebar-background to-card
        border-r border-sidebar-border
        transform transition-transform duration-300 lg:translate-x-0 lg:static
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="h-20 flex items-center px-6 border-b border-sidebar-border">
            <Link to="/coaching" className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                <Flame className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <span className="font-display text-2xl tracking-wider text-sidebar-foreground block">COACHING</span>
                <span className="text-xs text-primary font-medium tracking-widest">PREMIUM</span>
              </div>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Card */}
          <div className="p-4">
            <div className="bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-4 border border-primary/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="font-display text-xl text-primary">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{profile?.first_name} {profile?.last_name}</p>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-primary fill-primary" />
                    <span className="text-xs text-primary">Cliente Premium</span>
                  </div>
                </div>
              </div>
              {myCoach && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>Coach: {myCoach.first_name} {myCoach.last_name}</span>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-primary/20 to-primary/5 text-primary border-l-2 border-primary' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-sidebar-border">
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive" onClick={signOut}>
              <LogOut className="w-5 h-5" />Esci
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <header className="h-16 bg-gradient-to-r from-card to-background border-b border-border flex items-center px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-foreground mr-4">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h1 className="font-display text-xl tracking-wider">LA TUA GIORNATA</h1>
          </div>
        </header>

        <div className="flex-1 p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Active Plan Card */}
              <Card className="relative overflow-hidden bg-gradient-to-br from-card via-card to-primary/5 border-border">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <CardHeader>
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <Dumbbell className="w-5 h-5" />
                    <span className="text-sm font-medium tracking-wider uppercase">Scheda Attiva</span>
                  </div>
                  <CardTitle className="font-display text-3xl tracking-wider">
                    {activePlan?.name || "Nessuna scheda attiva"}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {activePlan?.description || "Attendi la tua scheda personalizzata dal coach"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activePlan ? (
                    <div className="flex items-center gap-6">
                      <Link to="/coaching/scheda">
                        <Button size="lg" className="gap-2 font-display tracking-wider">
                          <Play className="w-5 h-5" />VEDI SCHEDA
                        </Button>
                      </Link>
                      <Badge variant="secondary" className="text-sm">
                        {getDaysRemaining()} giorni rimanenti
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Clock className="w-5 h-5" />
                      <span>In attesa della scheda dal tuo coach</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-muted-foreground">Progresso Settimanale</span>
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-end justify-between">
                        <span className="text-3xl font-display">{weekProgress}%</span>
                        <span className="text-sm text-muted-foreground">{completedWorkouts}/5 sessioni</span>
                      </div>
                      <Progress value={weekProgress} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-muted-foreground">Prossimo Appuntamento</span>
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    {upcomingAppointments.length > 0 ? (
                      <div>
                        <p className="text-lg font-medium">{upcomingAppointments[0].title}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(upcomingAppointments[0].start_time), "d MMMM 'alle' HH:mm", { locale: it })}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Nessun appuntamento</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-muted-foreground">Il Tuo Coach</span>
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    {myCoach ? (
                      <div>
                        <p className="text-lg font-medium">{myCoach.first_name} {myCoach.last_name}</p>
                        <Link to="/coaching/segnala">
                          <Button variant="link" className="p-0 h-auto text-primary">Invia messaggio</Button>
                        </Link>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Non assegnato</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Scadenze */}
              {(activePlan || subscription) && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="font-display tracking-wider flex items-center gap-2">
                      <CalendarDays className="w-5 h-5 text-primary" />
                      Le Tue Scadenze
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activePlan && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Dumbbell className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium text-sm">Scheda: {activePlan.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Scade il {format(new Date(activePlan.end_date), "d MMMM yyyy", { locale: it })}
                            </p>
                          </div>
                        </div>
                        <Badge variant={getDaysRemaining() <= 7 ? "destructive" : "secondary"}>
                          {getDaysRemaining() > 0 ? `${getDaysRemaining()} giorni` : "Scaduta"}
                        </Badge>
                      </div>
                    )}
                    {subscription && (() => {
                      const subDays = differenceInDays(new Date(subscription.end_date), new Date());
                      return (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-medium text-sm">Abbonamento: {subscription.plan_name}</p>
                              <p className="text-xs text-muted-foreground">
                                Scade il {format(new Date(subscription.end_date), "d MMMM yyyy", { locale: it })}
                              </p>
                            </div>
                          </div>
                          <Badge variant={subDays <= 7 ? "destructive" : "secondary"}>
                            {subDays > 0 ? `${subDays} giorni` : "Scaduto"}
                          </Badge>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="font-display tracking-wider flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      Prossimi Appuntamenti
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {upcomingAppointments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Nessun appuntamento in programma</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {upcomingAppointments.map(apt => (
                          <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div>
                              <p className="font-medium">{apt.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(parseISO(apt.start_time), "EEEE d MMMM 'alle' HH:mm", { locale: it })}
                              </p>
                            </div>
                            {apt.location && (
                              <Badge variant="outline">{apt.location}</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="font-display tracking-wider flex items-center gap-2">
                      <Play className="w-5 h-5 text-primary" />
                      Azioni Rapide
                    </CardTitle>
                  </CardHeader>
                <CardContent className="space-y-3">
                    <Link to="/coaching/scheda">
                      <Button className="w-full justify-start gap-3" variant="secondary">
                        <Dumbbell className="w-5 h-5" />Vedi Scheda Allenamento
                      </Button>
                    </Link>
                    <Link to="/coaching/progressi">
                      <Button className="w-full justify-start gap-3" variant="secondary">
                        <TrendingUp className="w-5 h-5" />I Miei Progressi
                      </Button>
                    </Link>
                    <Link to="/coaching/segnala">
                      <Button className="w-full justify-start gap-3" variant="secondary">
                        <MessageSquare className="w-5 h-5" />Segnala Problema
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default CoachingDashboard;
