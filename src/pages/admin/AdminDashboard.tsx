import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, Calendar, CreditCard, UserPlus, BarChart3,
  Dumbbell, Clock, BookOpen, ChevronRight, MessageSquare, Receipt, TrendingUp
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { backfillTestReminders } from "@/lib/testReminder";

interface Stats {
  totalClients: number;
  expiredSubscriptions: number;
  expiringSubscriptions: number;
  todayAppointments: number;
  activeCourses: number;
  expiringPlans: number;
}

const AdminDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ totalClients: 0, expiredSubscriptions: 0, expiringSubscriptions: 0, todayAppointments: 0, activeCourses: 0, expiringPlans: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    // Backfill reminder appointments per schede esistenti — una sola volta per sessione
    const KEY = "test_reminders_backfilled_v1";
    if (!sessionStorage.getItem(KEY)) {
      backfillTestReminders()
        .then(({ created }) => {
          if (created > 0) console.info(`[Reminder] Generati ${created} avvisi 'Prepara test'.`);
          sessionStorage.setItem(KEY, "1");
        })
        .catch((err) => console.error("[Reminder] backfill failed", err));
    }
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [clientsRes, expiredRes, expiringRes, appointmentsRes, coursesRes, plansRes] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).in("role", ["cliente_palestra", "cliente_coaching"]),
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "attivo").lt("end_date", today),
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "attivo").gte("end_date", today).lte("end_date", weekFromNow),
      supabase.from("appointments").select("*", { count: "exact", head: true }).gte("start_time", today).lt("start_time", today + "T23:59:59"),
      supabase.from("courses").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("workout_plans").select("*", { count: "exact", head: true }).eq("is_active", true).lte("end_date", weekFromNow).gte("end_date", today),
    ]);

    setStats({
      totalClients: clientsRes.count || 0,
      expiredSubscriptions: expiredRes.count || 0,
      expiringSubscriptions: expiringRes.count || 0,
      todayAppointments: appointmentsRes.count || 0,
      activeCourses: coursesRes.count || 0,
      expiringPlans: plansRes.count || 0,
    });
    setLoading(false);
  };

  const statCards = [
    { label: "Clienti Attivi", value: stats.totalClients, icon: Users, color: "text-primary", onClick: () => navigate("/admin/utenti") },
    { label: "Abbonamenti Scaduti", value: stats.expiredSubscriptions, icon: CreditCard, color: "text-destructive", onClick: () => navigate("/admin/abbonamenti?filter=scaduti") },
    { label: "In Scadenza (7gg)", value: stats.expiringSubscriptions, icon: Clock, color: "text-yellow-500", onClick: () => navigate("/admin/abbonamenti?filter=in_scadenza") },
    { label: "Appuntamenti Oggi", value: stats.todayAppointments, icon: Calendar, color: "text-green-500", onClick: () => navigate("/admin/calendario") },
    { label: "Corsi Attivi", value: stats.activeCourses, icon: BookOpen, color: "text-blue-500", onClick: () => navigate("/admin/corsi") },
    { label: "Schede in Scadenza", value: stats.expiringPlans, icon: Dumbbell, color: "text-orange-500", onClick: () => navigate("/admin/utenti?filter=schede_scadenza") },
  ];

  return (
    <AdminLayout title="PANNELLO ADMIN" icon={<BarChart3 className="w-6 h-6" />}>
      <div className="mb-8">
        <h2 className="text-2xl font-display tracking-wider mb-2">Benvenuto, {profile?.first_name}!</h2>
        <p className="text-muted-foreground">Ecco una panoramica della tua palestra.</p>
      </div>

      {/* Stats Grid - CLICKABLE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-card border-border cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all" onClick={stat.onClick}>
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display tracking-wider">Azioni Rapide</CardTitle>
            <CardDescription>Operazioni comuni</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: UserPlus, label: "Gestisci Utenti", href: "/admin/utenti" },
              { icon: Calendar, label: "Gestisci Calendario", href: "/admin/calendario" },
              { icon: CreditCard, label: "Gestisci Abbonamenti", href: "/admin/abbonamenti" },
              { icon: BookOpen, label: "Gestisci Corsi", href: "/admin/corsi" },
            ].map(item => (
              <Link key={item.href} to={item.href}>
                <Button className="w-full justify-between" variant="secondary">
                  <span className="flex items-center gap-3"><item.icon className="w-5 h-5" />{item.label}</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display tracking-wider">Accesso Rapido</CardTitle>
            <CardDescription>Altre sezioni</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/admin/orari">
              <Button className="w-full justify-between" variant="outline">
                <span className="flex items-center gap-3"><Clock className="w-5 h-5" />Orari Palestra</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/admin/segnalazioni">
              <Button className="w-full justify-between" variant="outline">
                <span className="flex items-center gap-3"><MessageSquare className="w-5 h-5" />Feedback Clienti</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/admin/spese">
              <Button className="w-full justify-between" variant="outline">
                <span className="flex items-center gap-3"><Receipt className="w-5 h-5" />Spese</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/admin/andamento-struttura">
              <Button className="w-full justify-between" variant="outline">
                <span className="flex items-center gap-3"><TrendingUp className="w-5 h-5" />Andamento Struttura</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
