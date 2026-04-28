import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  Dumbbell,
  Calendar,
  Zap,
  Loader2,
  Activity,
  Target,
} from "lucide-react";
import {
  format,
  subDays,
  subMonths,
  subYears,
  parseISO,
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  isWithinInterval,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  isSameDay,
  isSameWeek,
  isSameMonth,
} from "date-fns";
import { it } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface WorkoutCompletion {
  id: string;
  completed_at: string;
  difficulty_rating: number | null;
  workout_plan_exercise_id: string;
}

interface PeriodPoint {
  label: string;
  completions: number;
  avgDifficulty: number;
}

interface ClientProgressViewProps {
  clientId: string;
}

type PeriodKey = "7d" | "30d" | "3m" | "1y";

interface PeriodConfig {
  label: string;
  short: string;
  start: () => Date;
  bucket: "day" | "week" | "month";
}

const PERIODS: Record<PeriodKey, PeriodConfig> = {
  "7d": {
    label: "Ultima settimana",
    short: "7g",
    start: () => subDays(new Date(), 6),
    bucket: "day",
  },
  "30d": {
    label: "Ultimo mese",
    short: "30g",
    start: () => subDays(new Date(), 29),
    bucket: "day",
  },
  "3m": {
    label: "Ultimo trimestre",
    short: "3 mesi",
    start: () => subMonths(new Date(), 3),
    bucket: "week",
  },
  "1y": {
    label: "Ultimo anno",
    short: "1 anno",
    start: () => subYears(new Date(), 1),
    bucket: "month",
  },
};

/**
 * Vista andamento riutilizzabile per cliente, coach e admin.
 * Mostra: stats rapide, attività e difficoltà percepita su periodo selezionabile,
 * attività recente.
 */
const ClientProgressView = ({ clientId }: ClientProgressViewProps) => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [completions, setCompletions] = useState<WorkoutCompletion[]>([]);

  useEffect(() => {
    if (clientId) fetchProgress();
  }, [clientId]);

  const fetchProgress = async () => {
    setLoading(true);
    // Carica un anno intero così possiamo cambiare periodo lato client senza rifetch
    const oneYearAgo = subYears(new Date(), 1).toISOString();

    const { data: completionsData } = await supabase
      .from("workout_completions")
      .select("*")
      .eq("client_id", clientId)
      .gte("completed_at", oneYearAgo)
      .order("completed_at", { ascending: false });

    setCompletions(completionsData || []);
    setLoading(false);
  };

  const config = PERIODS[period];

  // Filtra le completion sul periodo selezionato
  const filtered = useMemo(() => {
    const start = startOfDay(config.start());
    const end = endOfDay(new Date());
    return completions.filter((c) => {
      const d = parseISO(c.completed_at);
      return isWithinInterval(d, { start, end });
    });
  }, [completions, period]);

  // Genera serie temporale a bucket dinamici
  const series: PeriodPoint[] = useMemo(() => {
    const start = startOfDay(config.start());
    const end = endOfDay(new Date());

    if (config.bucket === "day") {
      const days = eachDayOfInterval({ start, end });
      return days.map((day) => {
        const dayCompletions = filtered.filter((c) =>
          isSameDay(parseISO(c.completed_at), day)
        );
        const difficulties = dayCompletions
          .map((c) => c.difficulty_rating)
          .filter(Boolean) as number[];
        return {
          label:
            period === "7d"
              ? format(day, "EEE", { locale: it })
              : format(day, "d MMM", { locale: it }),
          completions: dayCompletions.length,
          avgDifficulty:
            difficulties.length > 0
              ? difficulties.reduce((a, b) => a + b, 0) / difficulties.length
              : 0,
        };
      });
    }

    if (config.bucket === "week") {
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      return weeks.map((weekStart) => {
        const weekCompletions = filtered.filter((c) =>
          isSameWeek(parseISO(c.completed_at), weekStart, { weekStartsOn: 1 })
        );
        const difficulties = weekCompletions
          .map((c) => c.difficulty_rating)
          .filter(Boolean) as number[];
        return {
          label: `${format(weekStart, "d MMM", { locale: it })}`,
          completions: weekCompletions.length,
          avgDifficulty:
            difficulties.length > 0
              ? difficulties.reduce((a, b) => a + b, 0) / difficulties.length
              : 0,
        };
      });
    }

    // bucket = month
    const months = eachMonthOfInterval({ start, end });
    return months.map((monthStart) => {
      const monthCompletions = filtered.filter((c) =>
        isSameMonth(parseISO(c.completed_at), monthStart)
      );
      const difficulties = monthCompletions
        .map((c) => c.difficulty_rating)
        .filter(Boolean) as number[];
      return {
        label: format(monthStart, "MMM yy", { locale: it }),
        completions: monthCompletions.length,
        avgDifficulty:
          difficulties.length > 0
            ? difficulties.reduce((a, b) => a + b, 0) / difficulties.length
            : 0,
      };
    });
  }, [filtered, period]);

  // Statistiche del periodo selezionato
  const stats = useMemo(() => {
    const allDifficulties = filtered
      .map((c) => c.difficulty_rating)
      .filter(Boolean) as number[];

    // streak: giorni consecutivi a partire da oggi con almeno una completion
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const checkDay = subDays(today, i);
      const hasCompletion = completions.some((c) =>
        isSameDay(parseISO(c.completed_at), checkDay)
      );
      if (hasCompletion) streak++;
      else if (i > 0) break;
    }

    // questa settimana (per stat secondaria)
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const thisWeek = completions.filter(
      (c) => parseISO(c.completed_at) >= weekStart
    ).length;

    return {
      totalCompletions: filtered.length,
      thisWeek,
      avgDifficulty:
        allDifficulties.length > 0
          ? Math.round(
              (allDifficulties.reduce((a, b) => a + b, 0) /
                allDifficulties.length) *
                10
            ) / 10
          : 0,
      streak,
    };
  }, [filtered, completions]);

  const statCards = [
    {
      label: `Esercizi (${config.short})`,
      value: stats.totalCompletions,
      icon: Dumbbell,
      color: "text-primary",
    },
    {
      label: "Questa Settimana",
      value: stats.thisWeek,
      icon: Calendar,
      color: "text-blue-500",
    },
    {
      label: "Difficoltà Media",
      value: `${stats.avgDifficulty}/10`,
      icon: Activity,
      color: "text-orange-500",
    },
    {
      label: "Streak (giorni)",
      value: stats.streak,
      icon: Zap,
      color: "text-yellow-500",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selettore periodo */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display text-lg tracking-wider">Andamento</h3>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </div>
        <Tabs
          value={period}
          onValueChange={(v) => setPeriod(v as PeriodKey)}
        >
          <TabsList>
            <TabsTrigger value="7d">7 gg</TabsTrigger>
            <TabsTrigger value="30d">30 gg</TabsTrigger>
            <TabsTrigger value="3m">Trimestre</TabsTrigger>
            <TabsTrigger value="1y">Anno</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-display tracking-wider mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display tracking-wider flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Attività
            </CardTitle>
            <CardDescription>
              Esercizi valutati — {config.label.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {series.every((d) => d.completions === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nessuna attività in questo periodo</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={series}>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="completions"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name="Esercizi"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display tracking-wider flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Difficoltà Percepita
            </CardTitle>
            <CardDescription>
              Andamento medio — {config.label.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {series.every((d) => d.avgDifficulty === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nessun dato sulla difficoltà</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={series}>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis domain={[0, 10]} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgDifficulty"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                    name="Difficoltà"
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display tracking-wider">Attività Recente</CardTitle>
          <CardDescription>{config.label}</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Dumbbell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna attività registrata</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filtered.slice(0, 30).map((completion) => (
                <div
                  key={completion.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <Dumbbell className="w-4 h-4 text-primary" />
                    <span className="text-sm">
                      {format(parseISO(completion.completed_at), "dd MMM 'alle' HH:mm", {
                        locale: it,
                      })}
                    </span>
                  </div>
                  {completion.difficulty_rating && (
                    <Badge variant="outline" className="gap-1">
                      <Zap className="w-3 h-3" />
                      {completion.difficulty_rating}/10
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientProgressView;
