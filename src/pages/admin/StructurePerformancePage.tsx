import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  AlertTriangle,
  Loader2,
  Download,
  Filter,
  BarChart3
} from "lucide-react";
import {
  format,
  subMonths,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  differenceInDays,
} from "date-fns";
import { it } from "date-fns/locale";

interface KPIData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  marginPercentage: number;
  netCash: number;
  activeClients: number;
  averageClientValue: number;
  monthlyRecurringRevenue: number;
}

interface TrendData {
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface ExpenseCategory {
  category: string;
  subcategory: string;
  amount: number;
  date: string;
  provider: string;
  notes: string;
  isRecurring: boolean;
  isDeductible: boolean;
  isPaid: boolean;
}

interface RevenueSource {
  source: string;
  client: string;
  amount: number;
  date: string;
  paymentStatus: string;
  paymentMethod: string;
}

interface BusinessLineMetrics {
  name: string;
  revenue: number;
  costs: number;
  margin: number;
  clients: number;
  averageTicket: number;
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

const StructurePerformancePage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  
  const [kpiData, setKpiData] = useState<KPIData>({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    marginPercentage: 0,
    netCash: 0,
    activeClients: 0,
    averageClientValue: 0,
    monthlyRecurringRevenue: 0
  });

  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [trendTitle, setTrendTitle] = useState("Andamento Mensile");
  const [expenses, setExpenses] = useState<ExpenseCategory[]>([]);
  const [revenues, setRevenues] = useState<RevenueSource[]>([]);
  const [businessMetrics, setBusinessMetrics] = useState<BusinessLineMetrics[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [period, customStartDate, customEndDate]);

  const getDateRange = () => {
    const today = new Date();
    let start, end;

    switch (period) {
      case "month":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "quarter":
        start = startOfMonth(subMonths(today, 2));
        end = endOfMonth(today);
        break;
      case "year":
        start = startOfMonth(subMonths(today, 11));
        end = endOfMonth(today);
        break;
      case "custom":
        start = new Date(customStartDate);
        end = new Date(customEndDate);
        break;
      default:
        start = startOfMonth(today);
        end = endOfMonth(today);
    }

    return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
  };

  const fetchData = async () => {
    setLoading(true);
    const { start, end } = getDateRange();

    try {
      // Fetch subscriptions for revenue
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("*, membership_plans(price, duration_months, plan_type)")
        .gte("start_date", start)
        .lte("start_date", end);

      // Fetch payments
      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .gte("payment_date", start)
        .lte("payment_date", end);

      // Fetch expenses
      const { data: expensesData } = await supabase
        .from("expenses")
        .select("*")
        .gte("date", start)
        .lte("date", end);

      // Fetch active clients
      const { data: clients } = await supabase
        .from("profiles")
        .select("*")
        .in("role", ["cliente_palestra", "cliente_coaching", "cliente_corso"]);

      // Fetch courses for business line metrics
      const { data: courses } = await supabase
        .from("courses")
        .select("*, course_sessions(id)")
        .eq("is_active", true);

      // Calculate KPIs
      const totalRevenue = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalExpenses = (expensesData || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const netProfit = totalRevenue - totalExpenses;
      const marginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      const activeClients = clients?.length || 0;
      const averageClientValue = activeClients > 0 ? totalRevenue / activeClients : 0;
      const monthlyRecurringRevenue = (subscriptions || []).reduce(
        (sum, s) => sum + (s.membership_plans?.price || 0),
        0
      );

      setKpiData({
        totalRevenue,
        totalExpenses,
        netProfit,
        marginPercentage,
        netCash: totalRevenue - totalExpenses,
        activeClients,
        averageClientValue,
        monthlyRecurringRevenue
      });

      // Generate trend data with adaptive granularity (day / week / month)
      const rangeStart = new Date(start);
      const rangeEnd = new Date(end);
      const daysDiff = differenceInDays(rangeEnd, rangeStart);

      let granularity: "day" | "week" | "month" = "month";
      if (daysDiff <= 31) granularity = "day";
      else if (daysDiff <= 120) granularity = "week";

      // Re-fetch payments/expenses for the full window to bucketize
      const [{ data: trendPayments }, { data: trendExpenses }] = await Promise.all([
        supabase.from("payments").select("amount, payment_date").gte("payment_date", start).lte("payment_date", end),
        supabase.from("expenses").select("amount, date").gte("date", start).lte("date", end),
      ]);

      const buckets: TrendData[] = [];

      if (granularity === "day") {
        const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
        days.forEach((day) => {
          const dayStr = format(day, "yyyy-MM-dd");
          const rev = (trendPayments || [])
            .filter((p) => p.payment_date === dayStr)
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
          const exp = (trendExpenses || [])
            .filter((e) => e.date === dayStr)
            .reduce((sum, e) => sum + Number(e.amount || 0), 0);
          buckets.push({
            label: format(day, "dd MMM", { locale: it }),
            revenue: rev,
            expenses: exp,
            profit: rev - exp,
          });
        });
        setTrendTitle("Andamento Giornaliero");
      } else if (granularity === "week") {
        const weeks = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 });
        weeks.forEach((weekStart) => {
          const wStart = format(startOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
          const wEnd = format(endOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
          const rev = (trendPayments || [])
            .filter((p) => p.payment_date >= wStart && p.payment_date <= wEnd)
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
          const exp = (trendExpenses || [])
            .filter((e) => e.date >= wStart && e.date <= wEnd)
            .reduce((sum, e) => sum + Number(e.amount || 0), 0);
          buckets.push({
            label: `${format(weekStart, "dd MMM", { locale: it })}`,
            revenue: rev,
            expenses: exp,
            profit: rev - exp,
          });
        });
        setTrendTitle("Andamento Settimanale");
      } else {
        const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
        months.forEach((month) => {
          const mStart = format(startOfMonth(month), "yyyy-MM-dd");
          const mEnd = format(endOfMonth(month), "yyyy-MM-dd");
          const rev = (trendPayments || [])
            .filter((p) => p.payment_date >= mStart && p.payment_date <= mEnd)
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
          const exp = (trendExpenses || [])
            .filter((e) => e.date >= mStart && e.date <= mEnd)
            .reduce((sum, e) => sum + Number(e.amount || 0), 0);
          buckets.push({
            label: format(month, "MMM yy", { locale: it }),
            revenue: rev,
            expenses: exp,
            profit: rev - exp,
          });
        });
        setTrendTitle("Andamento Mensile");
      }
      setTrendData(buckets);

      // Set business metrics
      const metrics: BusinessLineMetrics[] = [
        {
          name: "Palestra",
          revenue: (subscriptions || [])
            .filter(s => s.membership_plans?.plan_type === "cliente_palestra")
            .reduce((sum, s) => sum + (s.membership_plans?.price || 0), 0),
          costs: 0,
          margin: 0,
          clients: (clients || []).filter(c => c.role === "cliente_palestra").length,
          averageTicket: 0
        },
        {
          name: "Coaching",
          revenue: (subscriptions || [])
            .filter(s => s.membership_plans?.plan_type === "cliente_coaching")
            .reduce((sum, s) => sum + (s.membership_plans?.price || 0), 0),
          costs: 0,
          margin: 0,
          clients: (clients || []).filter(c => c.role === "cliente_coaching").length,
          averageTicket: 0
        },
        {
          name: "Corsi",
          revenue: (subscriptions || [])
            .filter(s => s.membership_plans?.plan_type === "cliente_corso")
            .reduce((sum, s) => sum + (s.membership_plans?.price || 0), 0),
          costs: 0,
          margin: 0,
          clients: (clients || []).filter(c => c.role === "cliente_corso").length,
          averageTicket: 0
        }
      ];

      metrics.forEach(m => {
        m.margin = m.revenue - m.costs;
        m.averageTicket = m.clients > 0 ? m.revenue / m.clients : 0;
      });

      setBusinessMetrics(metrics);

      // Generate alerts
      const newAlerts: string[] = [];
      if (marginPercentage < 30) {
        newAlerts.push("⚠️ Margine di profitto sotto il 30%");
      }
      if (activeClients < 10) {
        newAlerts.push("⚠️ Numero di clienti attivi inferiore a 10");
      }
      setAlerts(newAlerts);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Errore", description: "Impossibile caricare i dati", variant: "destructive" });
      setLoading(false);
    }
  };

  const KPICard = ({ label, value, icon: Icon, trend, color }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-display tracking-wider mt-2">
              {typeof value === "number" && label.includes("€") ? `€${value.toFixed(2)}` : value}
            </p>
            {trend && (
              <div className="flex items-center gap-1 mt-2 text-xs">
                {trend > 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className={trend > 0 ? "text-green-500" : "text-red-500"}>
                  {Math.abs(trend)}%
                </span>
              </div>
            )}
          </div>
          <Icon className={`w-10 h-10 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout title="ANDAMENTO STRUTTURA" icon={<BarChart3 className="w-6 h-6" />}>
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display tracking-wider">Filtri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Periodo</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Questo Mese</SelectItem>
                    <SelectItem value="quarter">Questo Trimestre</SelectItem>
                    <SelectItem value="year">Questo Anno</SelectItem>
                    <SelectItem value="custom">Personalizzato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {period === "custom" && (
                <>
                  <div className="space-y-2">
                    <Label>Data Inizio</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fine</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div className="flex items-end">
                <Button className="w-full gap-2">
                  <Download className="w-4 h-4" />
                  Esporta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-900 dark:text-yellow-100">
                <AlertTriangle className="w-5 h-5" />
                Avvisi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {alerts.map((alert, idx) => (
                  <li key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                    {alert}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* KPI Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label="Entrate Totali"
                value={kpiData.totalRevenue}
                icon={DollarSign}
                color="text-green-500"
              />
              <KPICard
                label="Spese Totali"
                value={kpiData.totalExpenses}
                icon={DollarSign}
                color="text-red-500"
              />
              <KPICard
                label="Utile Netto"
                value={kpiData.netProfit}
                icon={TrendingUp}
                color="text-blue-500"
              />
              <KPICard
                label="Margine %"
                value={`${kpiData.marginPercentage.toFixed(1)}%`}
                icon={BarChart3}
                color="text-purple-500"
              />
              <KPICard
                label="Cassa Netta"
                value={kpiData.netCash}
                icon={DollarSign}
                color="text-indigo-500"
              />
              <KPICard
                label="Clienti Attivi"
                value={kpiData.activeClients}
                icon={Users}
                color="text-orange-500"
              />
              <KPICard
                label="Valore Medio Cliente"
                value={kpiData.averageClientValue}
                icon={DollarSign}
                color="text-cyan-500"
              />
              <KPICard
                label="MRR"
                value={kpiData.monthlyRecurringRevenue}
                icon={TrendingUp}
                color="text-lime-500"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-display tracking-wider">{trendTitle}</CardTitle>
                  <CardDescription>Entrate, Spese e Utile nel periodo selezionato</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#10B981" name="Entrate" />
                      <Line type="monotone" dataKey="expenses" stroke="#EF4444" name="Spese" />
                      <Line type="monotone" dataKey="profit" stroke="#3B82F6" name="Utile" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Business Lines */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-display tracking-wider">Linee di Business</CardTitle>
                  <CardDescription>Ricavi per servizio</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={businessMetrics}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {businessMetrics.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Business Metrics Table */}
            <Card>
              <CardHeader>
                <CardTitle className="font-display tracking-wider">Confronto Linee di Business</CardTitle>
                <CardDescription>Analisi dettagliata per servizio</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Servizio</TableHead>
                        <TableHead>Ricavi</TableHead>
                        <TableHead>Costi</TableHead>
                        <TableHead>Margine</TableHead>
                        <TableHead>Clienti</TableHead>
                        <TableHead>Ticket Medio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {businessMetrics.map((metric) => (
                        <TableRow key={metric.name}>
                          <TableCell className="font-medium">{metric.name}</TableCell>
                          <TableCell>€{metric.revenue.toFixed(2)}</TableCell>
                          <TableCell>€{metric.costs.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={metric.margin > 0 ? "default" : "destructive"}>
                              €{metric.margin.toFixed(2)}
                            </Badge>
                          </TableCell>
                          <TableCell>{metric.clients}</TableCell>
                          <TableCell>€{metric.averageTicket.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default StructurePerformancePage;
