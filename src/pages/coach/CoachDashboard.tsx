import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Calendar, 
  Dumbbell,
  LogOut,
  Menu,
  X,
  ClipboardList,
  MessageSquare,
  ChevronRight,
  Loader2
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface Stats {
  clientsCount: number;
  activePlansCount: number;
  todayAppointments: number;
  openReports: number;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface ErrorReport {
  id: string;
  title: string;
  status: string;
  reported_at: string;
  client_id: string;
}

const CoachDashboard = () => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ clientsCount: 0, activePlansCount: 0, todayAppointments: 0, openReports: 0 });
  const [myClients, setMyClients] = useState<Client[]>([]);
  const [recentReports, setRecentReports] = useState<ErrorReport[]>([]);

  const navigationItems = [
    { icon: ClipboardList, label: "Dashboard", href: "/coach" },
    { icon: Users, label: "I Miei Clienti", href: "/coach/clienti" },
    { icon: Dumbbell, label: "Schede Allenamento", href: "/coach/schede" },
    { icon: Calendar, label: "Calendario", href: "/coach/calendario" },
    { icon: MessageSquare, label: "Feedback Clienti", href: "/coach/segnalazioni" },
  ];

  useEffect(() => {
    if (profile?.user_id) {
      fetchData();
    }
  }, [profile?.user_id]);

  const fetchData = async () => {
    setLoading(true);
    const coachId = profile?.user_id;

    // Fetch my assigned clients
    const { data: assignments } = await supabase
      .from("coach_assignments")
      .select("client_id")
      .eq("coach_id", coachId);

    const clientIds = assignments?.map(a => a.client_id) || [];

    // Fetch client profiles
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, role, user_id")
        .in("user_id", clientIds);
      setMyClients(clients?.map(c => ({ id: c.user_id, first_name: c.first_name, last_name: c.last_name, role: c.role })) || []);
    }

    // Count active workout plans
    const { count: plansCount } = await supabase
      .from("workout_plans")
      .select("*", { count: "exact", head: true })
      .eq("coach_id", coachId)
      .eq("is_active", true);

    // Count today's appointments
    const today = new Date().toISOString().split("T")[0];
    const { count: appointmentsCount } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("coach_id", coachId)
      .gte("start_time", today)
      .lt("start_time", today + "T23:59:59");

    // Fetch open reports
    const { data: reports, count: reportsCount } = await supabase
      .from("error_reports")
      .select("*", { count: "exact" })
      .eq("coach_id", coachId)
      .in("status", ["aperta", "in_lavorazione"])
      .order("reported_at", { ascending: false })
      .limit(5);

    setRecentReports(reports || []);
    setStats({
      clientsCount: clientIds.length,
      activePlansCount: plansCount || 0,
      todayAppointments: appointmentsCount || 0,
      openReports: reportsCount || 0
    });
    setLoading(false);
  };

  const statCards = [
    { label: "Clienti Assegnati", value: stats.clientsCount, icon: Users, color: "text-primary" },
    { label: "Schede Attive", value: stats.activePlansCount, icon: Dumbbell, color: "text-green-500" },
    { label: "Appuntamenti Oggi", value: stats.todayAppointments, icon: Calendar, color: "text-blue-500" },
    { label: "Feedback Aperti", value: stats.openReports, icon: MessageSquare, color: "text-destructive" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-background border-r border-sidebar-border
        transform transition-transform duration-300 lg:translate-x-0 lg:static
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
            <Link to="/coach" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl tracking-wider text-sidebar-foreground">COACH</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-colors ${
                    isActive 
                      ? 'bg-sidebar-accent text-sidebar-primary' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-sidebar-border">
            <div className="mb-3 px-4">
              <p className="text-sm font-medium text-sidebar-foreground">{profile?.first_name} {profile?.last_name}</p>
              <p className="text-xs text-muted-foreground">Coach</p>
            </div>
            <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground hover:text-destructive" onClick={signOut}>
              <LogOut className="w-5 h-5" />Esci
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-background/80 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 bg-card border-b border-border flex items-center px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-foreground mr-4">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="font-display text-2xl tracking-wider">PANNELLO COACH</h1>
        </header>

        <div className="flex-1 p-6">
          <div className="mb-8">
            <h2 className="text-2xl font-display tracking-wider mb-2">Ciao, {profile?.first_name}!</h2>
            <p className="text-muted-foreground">Gestisci i tuoi clienti e le loro schede di allenamento.</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {statCards.map((stat) => (
                  <Card key={stat.label} className="bg-card border-border">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{stat.label}</p>
                          <p className="text-3xl font-display tracking-wider mt-1">{stat.value}</p>
                        </div>
                        <stat.icon className={`w-10 h-10 ${stat.color}`} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="font-display tracking-wider flex items-center justify-between">
                      I Miei Clienti
                      <Link to="/coach/clienti">
                        <Button variant="ghost" size="sm"><ChevronRight className="w-4 h-4" /></Button>
                      </Link>
                    </CardTitle>
                    <CardDescription>{myClients.length} clienti assegnati</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {myClients.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Nessun cliente assegnato</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {myClients.slice(0, 5).map(client => (
                          <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <span className="font-medium">{client.first_name} {client.last_name}</span>
                            <span className="text-xs text-muted-foreground capitalize">{client.role.replace("_", " ")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="font-display tracking-wider flex items-center justify-between">
                      Feedback Recenti
                      <Link to="/coach/segnalazioni">
                        <Button variant="ghost" size="sm"><ChevronRight className="w-4 h-4" /></Button>
                      </Link>
                    </CardTitle>
                    <CardDescription>Feedback dai clienti</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recentReports.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Nessun feedback</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recentReports.map(report => (
                          <div key={report.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <span className="font-medium truncate">{report.title}</span>
                            <span className={`text-xs px-2 py-1 rounded ${report.status === 'aperta' ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}`}>
                              {report.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
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

export default CoachDashboard;
