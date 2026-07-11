import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Calendar,
  Dumbbell,
  Loader2,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  format,
  isSameDay,
  isSameMonth,
  isSameWeek,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { it } from "date-fns/locale";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getOfflineCache, setOfflineCache } from "@/lib/offlineSync";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WorkoutCompletion {
  id: string;
  completed_at: string;
  difficulty_rating: number | null;
  workout_plan_exercise_id: string;
}

interface Props {
  clientId: string;
}

type PeriodKey = "7d" | "30d" | "3m" | "1y";

const PERIODS = {
  "7d": { label: "Ultima settimana", short: "7g", start: () => subDays(new Date(), 6), bucket: "day" },
  "30d": { label: "Ultimo mese", short: "30g", start: () => subDays(new Date(), 29), bucket: "day" },
  "3m": { label: "Ultimo trimestre", short: "3 mesi", start: () => subMonths(new Date(), 3), bucket: "week" },
  "1y": { label: "Ultimo anno", short: "1 anno", start: () => subYears(new Date(), 1), bucket: "month" },
} as const;

const OfflineClientProgressView = ({ clientId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [completions, setCompletions] = useState<WorkoutCompletion[]>([]);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    const fetchProgress = async () => {
      setLoading(true);
      const cacheKey = `progress:${clientId}`;
      const cached = await getOfflineCache<WorkoutCompletion[]>(cacheKey);

      if (cached) {
        setCompletions(cached.value);
        setFromCache(true);
      }

      if (!navigator.onLine) {
        setLoading(false);
        return;
      }

      try {
        const oneYearAgo = subYears(new Date(), 1).toISOString();
        const { data, error } = await supabase
          .from("workout_completions")
          .select("id, completed_at, difficulty_rating, workout_plan_exercise_id")
          .eq("client_id", clientId)
          .gte("completed_at", oneYearAgo)
          .order("completed_at", { ascending: false });
        if (error) throw error;

        const normalized = (data || []) as WorkoutCompletion[];
        setCompletions(normalized);
        setFromCache(false);
        await setOfflineCache(cacheKey, normalized);
      } catch {
        if (!cached) setCompletions([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchProgress();
  }, [clientId]);

  const config = PERIODS[period];

  const filtered = useMemo(() => {
    const start = startOfDay(config.start());
    const end = endOfDay(new Date());
    return completions.filter((completion) =>
      isWithinInterval(parseISO(completion.completed_at), { start, end }),
    );
  }, [completions, period]);

  const series = useMemo(() => {
    const start = startOfDay(config.start());
    const end = endOfDay(new Date());

    const makePoint = (label: string, items: WorkoutCompletion[]) => {
      const ratings = items
        .map((item) => item.difficulty_rating)
        .filter((value): value is number => typeof value === "number" && value > 0);
      return {
        label,
        completions: items.length,
        avgDifficulty: ratings.length
          ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
          : 0,
      };
    };

    if (config.bucket === "day") {
      return eachDayOfInterval({ start, end }).map((day) =>
        makePoint(
          period === "7d" ? format(day, "EEE", { locale: it }) : format(day, "d MMM", { locale: it }),
          filtered.filter((item) => isSameDay(parseISO(item.completed_at), day)),
        ),
      );
    }

    if (config.bucket === "week") {
      return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((week) =>
        makePoint(
          format(week, "d MMM", { locale: it }),
          filtered.filter((item) => isSameWeek(parseISO(item.completed_at), week, { weekStartsOn: 1 })),
        ),
      );
    }

    return eachMonthOfInterval({ start, end }).map((month) =>
      makePoint(
        format(month, "MMM yy", { locale: it }),
        filtered.filter((item) => isSameMonth(parseISO(item.completed_at), month)),
      ),
    );
  }, [filtered, period]);

  const stats = useMemo(() => {
    const ratings = filtered
      .map((item) => item.difficulty_rating)
      .filter((value): value is number => typeof value === "number" && value > 0);

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const thisWeek = completions.filter((item) => parseISO(item.completed_at) >= weekStart).length;

    let streak = 0;
    for (let index = 0; index < 365; index += 1) {
      const day = subDays(new Date(), index);
      const hasCompletion = completions.some((item) => isSameDay(parseISO(item.completed_at), day));
      if (hasCompletion) streak += 1;
      else if (index > 0) break;
    }

    return {
      total: filtered.length,
      thisWeek,
      average: ratings.length
        ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
        : 0,
      streak,
    };
  }, [filtered, completions]);

  if (loading && !completions.length) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const cards = [
    { label: `Esercizi (${config.short})`, value: stats.total, icon: Dumbbell },
    { label: "Questa settimana", value: stats.thisWeek, icon: Calendar },
    { label: "Difficoltà media", value: `${stats.average}/10`, icon: Activity },
    { label: "Streak", value: `${stats.streak} gg`, icon: Zap },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg tracking-wider">Andamento</h3>
            {fromCache && <Badge variant="outline">Dati offline</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </div>
        <Tabs value={period} onValueChange={(value) => setPeriod(value as PeriodKey)}>
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="7d">7 gg</TabsTrigger>
            <TabsTrigger value="30d">30 gg</TabsTrigger>
            <TabsTrigger value="3m">3 mesi</TabsTrigger>
            <TabsTrigger value="1y">Anno</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div><p className="text-xs text-muted-foreground">{card.label}</p><p className="mt-1 font-display text-2xl tracking-wider">{card.value}</p></div>
                <card.icon className="h-7 w-7 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display tracking-wider"><Target className="h-5 w-5 text-primary" />Attività</CardTitle>
            <CardDescription>Esercizi valutati nel periodo</CardDescription>
          </CardHeader>
          <CardContent>
            {series.every((point) => point.completions === 0) ? (
              <div className="py-10 text-center text-muted-foreground">Nessuna attività in questo periodo</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={series}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Bar dataKey="completions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display tracking-wider"><TrendingUp className="h-5 w-5 text-primary" />Difficoltà percepita</CardTitle>
            <CardDescription>Media delle valutazioni registrate</CardDescription>
          </CardHeader>
          <CardContent>
            {series.every((point) => point.avgDifficulty === 0) ? (
              <div className="py-10 text-center text-muted-foreground">Nessuna valutazione nel periodo</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={series}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis axisLine={false} tickLine={false} domain={[0, 10]} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Line type="monotone" dataKey="avgDifficulty" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OfflineClientProgressView;
