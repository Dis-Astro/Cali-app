import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  LogOut,
  Phone,
  MapPin,
  CalendarDays,
  Loader2,
  AlertCircle,
  Mail,
  MessageCircle,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";

interface GymHour {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  note: string | null;
}

interface Subscription {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  plan: {
    name: string;
    description: string | null;
  };
}

const dayNames = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

const PalestraDashboard = () => {
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [gymHours, setGymHours] = useState<GymHour[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    if (profile?.user_id) fetchData();
  }, [profile?.user_id]);

  const fetchData = async () => {
    setLoading(true);

    const { data: hours } = await supabase
      .from("gym_hours")
      .select("*")
      .order("day_of_week");

    if (hours) setGymHours(hours);

    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*, plan:membership_plans(*)")
      .eq("user_id", profile?.user_id)
      .eq("status", "attivo")
      .order("end_date", { ascending: false })
      .limit(1);

    if (subs && subs.length > 0) {
      setSubscription({
        id: subs[0].id,
        status: subs[0].status,
        start_date: subs[0].start_date,
        end_date: subs[0].end_date,
        plan: {
          name: subs[0].plan?.name || "Piano",
          description: subs[0].plan?.description,
        },
      });
    } else {
      setSubscription(null);
    }

    setLoading(false);
  };

  const daysRemaining = subscription
    ? differenceInDays(new Date(subscription.end_date), new Date())
    : 0;

  return (
    <div className="app-screen bg-background">
      <header className="bg-card border-b border-border native-safe-x">
        <div className="max-w-4xl mx-auto py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary">Super Power Gym</p>
            <h1 className="font-display text-xl tracking-wider">AREA CLIENTI</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4" />
            Esci
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 native-safe-x">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl font-display tracking-wider mb-1">
            Ciao, {profile?.first_name || "atleta"}!
          </h2>
          <p className="text-muted-foreground">Qui trovi abbonamento, orari e contatti utili.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Card className={`mb-6 ${subscription ? (daysRemaining <= 7 ? "border-destructive/50" : "border-green-500/50") : "border-muted"}`}>
              <CardHeader>
                <CardTitle className="font-display tracking-wider flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Il Tuo Abbonamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subscription ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-medium">{subscription.plan.name}</h3>
                        {subscription.plan.description && (
                          <p className="text-sm text-muted-foreground">{subscription.plan.description}</p>
                        )}
                      </div>
                      <Badge className="w-fit" variant={daysRemaining > 7 ? "default" : "destructive"}>
                        {daysRemaining > 0 ? `${daysRemaining} giorni rimanenti` : "Scaduto"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                      <div>
                        <p className="text-sm text-muted-foreground">Data inizio</p>
                        <p className="font-medium">{format(new Date(subscription.start_date), "d MMMM yyyy", { locale: it })}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Data scadenza</p>
                        <p className="font-medium">{format(new Date(subscription.end_date), "d MMMM yyyy", { locale: it })}</p>
                      </div>
                    </div>

                    {daysRemaining <= 7 && daysRemaining > 0 && (
                      <div className="flex items-start gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>Il tuo abbonamento sta per scadere. Contatta la reception per rinnovare.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nessun abbonamento attivo</p>
                    <p className="text-sm mt-2">Contatta la reception per verificare la tua posizione.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="font-display tracking-wider flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Orari Palestra
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gymHours.length > 0 ? (
                  <div className="space-y-1">
                    {gymHours.map((hour) => (
                      <div key={hour.day_of_week} className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0">
                        <span className="font-medium">{dayNames[hour.day_of_week]}</span>
                        <span className={`text-right ${hour.is_closed ? "text-muted-foreground" : ""}`}>
                          {hour.is_closed ? "Chiuso" : `${hour.open_time.slice(0, 5)} - ${hour.close_time.slice(0, 5)}`}
                          {hour.note && <span className="block text-xs text-muted-foreground">{hour.note}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Orari non disponibili. Contatta la reception.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display tracking-wider">Contatti</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <a href="tel:+393484157414" className="flex items-center gap-3 rounded-lg p-2 -m-2 hover:bg-secondary/40">
                  <Phone className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Telefono</p>
                    <p className="font-medium">+39 348 415 7414</p>
                  </div>
                </a>

                <a href="mailto:mariano@superpowergym.it" className="flex items-center gap-3 rounded-lg p-2 -m-2 hover:bg-secondary/40">
                  <Mail className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium break-all">mariano@superpowergym.it</p>
                  </div>
                </a>

                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Indirizzo</p>
                    <p className="font-medium">Via Carlo Riccioni 1, 64100 San Nicolò (TE)</p>
                  </div>
                </div>

                <a
                  href="https://wa.me/393484157414?text=Ciao%21%20Ho%20bisogno%20di%20assistenza%20con%20l%27app%20Super%20Power%20Gym."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#25D366] px-4 py-3 font-semibold text-white"
                >
                  <MessageCircle className="w-5 h-5" />
                  Scrivi su WhatsApp
                </a>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default PalestraDashboard;
