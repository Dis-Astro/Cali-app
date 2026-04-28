import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
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
import { Calendar, Plus, ChevronLeft, ChevronRight, Loader2, Clock, User, ExternalLink, Trash2, Dumbbell, CalendarIcon, Repeat, GripVertical, RefreshCw, CreditCard, Package } from "lucide-react";
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfDay,
  eachDayOfInterval, 
  addWeeks, 
  subWeeks, 
  addMonths, 
  subMonths,
  isSameDay, 
  isSameMonth,
  parseISO, 
  addHours,
  addDays,
  setHours,
  setMinutes,
  differenceInMilliseconds
} from "date-fns";
import { it } from "date-fns/locale";

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Appointment {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  coach_id: string;
  client_id: string | null;
  color: string;
  location: string | null;
}

interface Course {
  id: string;
  name: string;
  description: string | null;
  coach_id: string | null;
  color: string;
  max_participants: number | null;
  duration_minutes: number;
  is_active: boolean;
}

interface CourseSession {
  id: string;
  course_id: string;
  start_time: string;
  end_time: string;
  is_cancelled: boolean;
  course?: Course;
}

interface WorkoutPlan {
  id: string;
  name: string;
  client_id: string;
  end_date: string;
}

interface SubscriptionDeadline {
  id: string;
  user_id: string;
  end_date: string;
  status: string;
  plan_name: string;
  plan_id: string;
}

interface LessonPackage {
  id: string;
  user_id: string;
  remaining_lessons: number;
  total_lessons: number;
}
type ViewMode = 'weekly' | 'monthly';

type DragItem = 
  | { type: 'appointment'; id: string; data: Appointment }
  | { type: 'session'; id: string; data: CourseSession };

const CalendarManagement = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [courseSessions, setCourseSessions] = useState<CourseSession[]>([]);
  const [workoutDeadlines, setWorkoutDeadlines] = useState<WorkoutPlan[]>([]);
  const [subscriptionDeadlines, setSubscriptionDeadlines] = useState<SubscriptionDeadline[]>([]);
  const [coaches, setCoaches] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessonPackages, setLessonPackages] = useState<LessonPackage[]>([]);
  const [loading, setLoading] = useState(true);
  // Dialog states
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false);
  const [isCourseSessionDialogOpen, setIsCourseSessionDialogOpen] = useState(false);
  const [deleteAppointmentId, setDeleteAppointmentId] = useState<string | null>(null);
  const [deleteCourseSessionId, setDeleteCourseSessionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Client autocomplete for title
  const [titleSuggestions, setTitleSuggestions] = useState<Profile[]>([]);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [editTitleSuggestions, setEditTitleSuggestions] = useState<Profile[]>([]);
  const [showEditTitleSuggestions, setShowEditTitleSuggestions] = useState(false);
  const titleInputRef = useRef<HTMLDivElement>(null);
  const editTitleInputRef = useRef<HTMLDivElement>(null);
  
  // Edit appointment
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editDate, setEditDate] = useState<Date | undefined>();
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("10:00");
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    coach_id: "",
    client_id: "",
    color: "#3B82F6",
    location: ""
  });
  
  // Day detail dialog
  const [dayDetailDate, setDayDetailDate] = useState<Date | null>(null);

  // Drag and drop
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  
  // Form states
  const [appointmentDate, setAppointmentDate] = useState<Date | undefined>();
  const [appointmentStartTime, setAppointmentStartTime] = useState("09:00");
  const [appointmentEndTime, setAppointmentEndTime] = useState("10:00");
  const [newAppointment, setNewAppointment] = useState({
    title: "",
    description: "",
    coach_id: "",
    client_id: "",
    color: "#3B82F6",
    location: ""
  });
  
  const [courseSessionStartTime, setCourseSessionStartTime] = useState("09:00");
  const [courseSessionEndTime, setCourseSessionEndTime] = useState("10:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [newCourseSession, setNewCourseSession] = useState({
    course_id: ""
  });

  const weekDays = [
    { value: 1, label: "Lunedì", short: "Lun" },
    { value: 2, label: "Martedì", short: "Mar" },
    { value: 3, label: "Mercoledì", short: "Mer" },
    { value: 4, label: "Giovedì", short: "Gio" },
    { value: 5, label: "Venerdì", short: "Ven" },
    { value: 6, label: "Sabato", short: "Sab" },
    { value: 0, label: "Domenica", short: "Dom" }
  ];

  // Calculate date ranges based on view mode
  const getDateRange = () => {
    if (viewMode === 'weekly') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
      };
    }
    return {
      start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    };
  };

  const { start: rangeStart, end: rangeEnd } = getDateRange();
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  useEffect(() => {
    fetchData();
  }, [currentDate, viewMode]);

  const fetchData = async () => {
    setLoading(true);
    
    const startRange = format(rangeStart, "yyyy-MM-dd");
    const endRange = format(addHours(rangeEnd, 24), "yyyy-MM-dd");

    const [appointmentsRes, sessionsRes, coachesRes, clientsRes, coursesRes, workoutRes, subsRes, packagesRes] = await Promise.all([
      supabase.from("appointments").select("*").gte("start_time", startRange).lte("start_time", endRange),
      supabase.from("course_sessions").select("*, course:courses(*)").gte("start_time", startRange).lte("start_time", endRange),
      supabase.from("profiles").select("*").in("role", ["admin", "coach"]),
      supabase.from("profiles").select("*").in("role", ["cliente_palestra", "cliente_coaching", "cliente_corso"]),
      supabase.from("courses").select("*").eq("is_active", true),
      (supabase.from("workout_plans").select("id, name, client_id, end_date").gte("end_date", startRange).lte("end_date", endRange).eq("is_active", true) as any).is("deleted_at", null),
      supabase.from("subscriptions").select("id, user_id, end_date, status, plan_id, membership_plans(name)").gte("end_date", startRange).lte("end_date", endRange),
      supabase.from("lesson_packages").select("id, user_id, remaining_lessons, total_lessons").gt("remaining_lessons", 0)
    ]);

    if (appointmentsRes.data) setAppointments(appointmentsRes.data);
    if (sessionsRes.data) {
      const activeSessions = (sessionsRes.data as CourseSession[]).filter(
        session => session.course?.is_active !== false
      );
      setCourseSessions(activeSessions);
    }
    if (coachesRes.data) setCoaches(coachesRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
    if (coursesRes.data) setCourses(coursesRes.data);
    if (workoutRes.data) setWorkoutDeadlines(workoutRes.data);
    if (subsRes.data) {
      setSubscriptionDeadlines(subsRes.data.map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        end_date: s.end_date,
        status: s.status,
        plan_name: s.membership_plans?.name || 'Piano',
        plan_id: s.plan_id
      })));
    }
    if (packagesRes.data) setLessonPackages(packagesRes.data as unknown as LessonPackage[]);

    setLoading(false);
  };

  // Helper: get active lesson package for a client
  const getClientPackage = (clientId: string | null) => {
    if (!clientId) return null;
    return lessonPackages.find(p => p.user_id === clientId && p.remaining_lessons > 0) || null;
  };

  // Auto-decrement lesson from package
  const decrementLessonPackage = async (clientId: string, appointmentId: string) => {
    const pkg = getClientPackage(clientId);
    if (!pkg) return;

    // Decrement remaining_lessons
    const { error: updateError } = await supabase
      .from("lesson_packages")
      .update({ remaining_lessons: pkg.remaining_lessons - 1 })
      .eq("id", pkg.id);

    if (updateError) {
      console.error("Error decrementing lesson package:", updateError);
      return;
    }

    // Log the usage
    await supabase.from("lesson_usage_log").insert({
      package_id: pkg.id,
      appointment_id: appointmentId,
      created_by: profile?.user_id
    });

    toast({
      title: "Lezione scalata",
      description: `Pacchetto: ${pkg.remaining_lessons - 1}/${pkg.total_lessons} lezioni rimanenti`
    });
  };

  // --- Click on day to create appointment (pre-fill date) ---
  const handleDayClick = (day: Date) => {
    setAppointmentDate(day);
    setAppointmentStartTime("09:00");
    setAppointmentEndTime("10:00");
    setNewAppointment({ title: "", description: "", coach_id: profile?.user_id || "", client_id: "", color: "#3B82F6", location: "" });
    setIsAppointmentDialogOpen(true);
  };

  // --- Click on day number to see all events ---
  const handleDayNumberClick = (day: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    setDayDetailDate(day);
  };

  // --- Drag and Drop ---
  const handleDragStart = (item: DragItem) => {
    setDragItem(item);
  };

  const handleDragOver = (e: React.DragEvent, dayKey: string) => {
    e.preventDefault();
    setDragOverDay(dayKey);
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
  };

  const handleDrop = async (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault();
    setDragOverDay(null);
    if (!dragItem) return;

    if (dragItem.type === 'appointment') {
      const apt = dragItem.data as Appointment;
      const oldStart = parseISO(apt.start_time);
      const oldEnd = parseISO(apt.end_time);
      const duration = differenceInMilliseconds(oldEnd, oldStart);
      
      // Keep same time, change date
      const newStart = setMinutes(setHours(targetDay, oldStart.getHours()), oldStart.getMinutes());
      const newEnd = new Date(newStart.getTime() + duration);

      const { error } = await supabase.from("appointments").update({
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString()
      }).eq("id", apt.id);

      if (error) {
        toast({ title: "Errore", description: "Impossibile spostare l'appuntamento", variant: "destructive" });
      } else {
        toast({ title: "Spostato", description: `Appuntamento spostato a ${format(targetDay, "d MMMM", { locale: it })}` });
        fetchData();
      }
    } else if (dragItem.type === 'session') {
      const session = dragItem.data as CourseSession;
      const oldStart = parseISO(session.start_time);
      const oldEnd = parseISO(session.end_time);
      const duration = differenceInMilliseconds(oldEnd, oldStart);

      const newStart = setMinutes(setHours(targetDay, oldStart.getHours()), oldStart.getMinutes());
      const newEnd = new Date(newStart.getTime() + duration);

      const { error } = await supabase.from("course_sessions").update({
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString()
      }).eq("id", session.id);

      if (error) {
        toast({ title: "Errore", description: "Impossibile spostare la sessione", variant: "destructive" });
      } else {
        toast({ title: "Spostato", description: `Sessione spostata a ${format(targetDay, "d MMMM", { locale: it })}` });
        fetchData();
      }
    }

    setDragItem(null);
  };

  // --- Renew subscription ---
  const handleRenewSubscription = async (sub: SubscriptionDeadline) => {
    // Navigate to subscriptions page with pre-selected user
    navigate(`/admin/abbonamenti?renew=${sub.user_id}`);
  };

  const createAppointment = async () => {
    if (!newAppointment.title || !appointmentDate || !newAppointment.coach_id) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }

    const [startH, startM] = appointmentStartTime.split(":").map(Number);
    const [endH, endM] = appointmentEndTime.split(":").map(Number);
    const startDateTime = setMinutes(setHours(appointmentDate, startH), startM);
    const endDateTime = setMinutes(setHours(appointmentDate, endH), endM);

    setSaving(true);
    const { data: insertedData, error } = await supabase.from("appointments").insert({
      title: newAppointment.title,
      description: newAppointment.description || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      coach_id: newAppointment.coach_id,
      client_id: newAppointment.client_id || null,
      color: newAppointment.color,
      location: newAppointment.location || null
    }).select("id").single();

    if (error) {
      toast({ title: "Errore", description: "Impossibile creare l'appuntamento", variant: "destructive" });
    } else {
      toast({ title: "Successo", description: "Appuntamento creato" });
      
      // Auto-decrement lesson package if client has one
      if (newAppointment.client_id && insertedData) {
        await decrementLessonPackage(newAppointment.client_id, insertedData.id);
      }
      
      setIsAppointmentDialogOpen(false);
      setNewAppointment({ title: "", description: "", coach_id: "", client_id: "", color: "#3B82F6", location: "" });
      setAppointmentDate(undefined);
      setAppointmentStartTime("09:00");
      setAppointmentEndTime("10:00");
      fetchData();
    }
    setSaving(false);
  };

  const deleteAppointment = async () => {
    if (!deleteAppointmentId) return;

    const { error } = await supabase.from("appointments").delete().eq("id", deleteAppointmentId);

    if (error) {
      toast({ title: "Errore", description: "Impossibile eliminare l'appuntamento", variant: "destructive" });
    } else {
      toast({ title: "Eliminato", description: "Appuntamento eliminato" });
      fetchData();
    }
    setDeleteAppointmentId(null);
  };

  const createCourseSession = async () => {
    if (!newCourseSession.course_id || selectedDays.length === 0) {
      toast({ title: "Errore", description: "Seleziona un corso e almeno un giorno della settimana", variant: "destructive" });
      return;
    }

    const [startH, startM] = courseSessionStartTime.split(":").map(Number);
    const [endH, endM] = courseSessionEndTime.split(":").map(Number);
    
    setSaving(true);

    const sessionsToCreate = [];
    const today = new Date();
    const oneYearFromNow = addDays(today, 365);
    
    for (const dayOfWeek of selectedDays) {
      let currentDateIter = startOfDay(today);
      
      const currentDayOfWeek = currentDateIter.getDay();
      let daysToAdd = dayOfWeek - currentDayOfWeek;
      if (daysToAdd < 0) daysToAdd += 7;
      currentDateIter = addDays(currentDateIter, daysToAdd);
      
      while (currentDateIter <= oneYearFromNow) {
        const startDateTime = setMinutes(setHours(new Date(currentDateIter), startH), startM);
        const endDateTime = setMinutes(setHours(new Date(currentDateIter), endH), endM);
        
        sessionsToCreate.push({
          course_id: newCourseSession.course_id,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString()
        });
        
        currentDateIter = addDays(currentDateIter, 7);
      }
    }

    const { error } = await supabase.from("course_sessions").insert(sessionsToCreate);

    if (error) {
      toast({ title: "Errore", description: "Impossibile creare le sessioni", variant: "destructive" });
    } else {
      const daysText = selectedDays.map(d => weekDays.find(w => w.value === d)?.short).join(", ");
      toast({ title: "Successo", description: `Create ${sessionsToCreate.length} sessioni per ${daysText} (1 anno)` });
      setIsCourseSessionDialogOpen(false);
      setNewCourseSession({ course_id: "" });
      setSelectedDays([]);
      setCourseSessionStartTime("09:00");
      setCourseSessionEndTime("10:00");
      fetchData();
    }
    setSaving(false);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const deleteCourseSession = async () => {
    if (!deleteCourseSessionId) return;

    const { error } = await supabase.from("course_sessions").delete().eq("id", deleteCourseSessionId);

    if (error) {
      toast({ title: "Errore", description: "Impossibile eliminare la sessione", variant: "destructive" });
    } else {
      toast({ title: "Eliminato", description: "Sessione eliminata" });
      fetchData();
    }
    setDeleteCourseSessionId(null);
  };

  // Client name autocomplete helper
  const handleTitleChange = (value: string, isEdit = false) => {
    if (isEdit) {
      setEditForm({ ...editForm, title: value });
    } else {
      setNewAppointment({ ...newAppointment, title: value });
    }
    
    if (value.length >= 3) {
      const query = value.toLowerCase();
      const matches = clients.filter(c => 
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(query) ||
        c.first_name.toLowerCase().includes(query) ||
        c.last_name.toLowerCase().includes(query)
      ).slice(0, 5);
      if (isEdit) {
        setEditTitleSuggestions(matches);
        setShowEditTitleSuggestions(matches.length > 0);
      } else {
        setTitleSuggestions(matches);
        setShowTitleSuggestions(matches.length > 0);
      }
    } else {
      if (isEdit) {
        setShowEditTitleSuggestions(false);
      } else {
        setShowTitleSuggestions(false);
      }
    }
  };

  const selectTitleSuggestion = (client: Profile, isEdit = false) => {
    const name = `${client.first_name} ${client.last_name}`;
    if (isEdit) {
      setEditForm({ ...editForm, title: name, client_id: client.user_id });
      setShowEditTitleSuggestions(false);
    } else {
      setNewAppointment({ ...newAppointment, title: name, client_id: client.user_id });
      setShowTitleSuggestions(false);
    }
  };

  const isoDatePart = (iso: string) => iso.slice(0, 10);

  const getEventsForDay = (day: Date) => {
    const dayAppointments = appointments.filter(a => isSameDay(parseISO(a.start_time), day));
    const dayKey = format(day, "yyyy-MM-dd");
    const daySessions = courseSessions.filter(s => isoDatePart(s.start_time) === dayKey);
    const dayDeadlines = workoutDeadlines.filter(w => isSameDay(parseISO(w.end_date), day));
    const daySubDeadlines = subscriptionDeadlines.filter(s => s.end_date === dayKey);
    return { appointments: dayAppointments, sessions: daySessions, deadlines: dayDeadlines, subDeadlines: daySubDeadlines };
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return null;
    const client = clients.find(c => c.user_id === clientId);
    return client ? `${client.first_name} ${client.last_name}` : null;
  };

  const handleAppointmentClick = (apt: Appointment, e: React.MouseEvent) => {
    e.stopPropagation();
    // Open edit dialog for this appointment
    setEditingAppointment(apt);
    const startDate = parseISO(apt.start_time);
    const endDate = parseISO(apt.end_time);
    setEditDate(startDate);
    setEditStartTime(format(startDate, "HH:mm"));
    setEditEndTime(format(endDate, "HH:mm"));
    setEditForm({
      title: apt.title,
      description: apt.description || "",
      coach_id: apt.coach_id,
      client_id: apt.client_id || "",
      color: apt.color,
      location: apt.location || ""
    });
    setIsEditDialogOpen(true);
  };

  const updateAppointment = async () => {
    if (!editingAppointment || !editDate || !editForm.title || !editForm.coach_id) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }

    const [startH, startM] = editStartTime.split(":").map(Number);
    const [endH, endM] = editEndTime.split(":").map(Number);
    const startDateTime = setMinutes(setHours(editDate, startH), startM);
    const endDateTime = setMinutes(setHours(editDate, endH), endM);

    setSaving(true);
    const { error } = await supabase.from("appointments").update({
      title: editForm.title,
      description: editForm.description || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      coach_id: editForm.coach_id,
      client_id: editForm.client_id || null,
      color: editForm.color,
      location: editForm.location || null
    }).eq("id", editingAppointment.id);

    if (error) {
      toast({ title: "Errore", description: "Impossibile aggiornare l'appuntamento", variant: "destructive" });
    } else {
      toast({ title: "Aggiornato", description: "Appuntamento aggiornato" });
      setIsEditDialogOpen(false);
      setEditingAppointment(null);
      fetchData();
    }
    setSaving(false);
  };

  const handleDeadlineClick = (deadline: WorkoutPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/admin/utenti/${deadline.client_id}/scheda/${deadline.id}/modifica`);
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (viewMode === 'weekly') {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    }
  };

  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 - 20:00

  // Day detail events
  const dayDetailEvents = dayDetailDate ? getEventsForDay(dayDetailDate) : null;

  return (
    <AdminLayout title="CALENDARIO" icon={<Calendar className="w-6 h-6" />}>
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => handleNavigate('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="font-display text-lg tracking-wider min-w-[200px] text-center">
            {viewMode === 'weekly' 
              ? `${format(rangeStart, "d MMM", { locale: it })} - ${format(rangeEnd, "d MMM yyyy", { locale: it })}`
              : format(currentDate, "MMMM yyyy", { locale: it })
            }
          </h2>
          <Button variant="outline" size="icon" onClick={() => handleNavigate('next')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Oggi</Button>
        </div>

        <div className="flex gap-2 items-center">
          {/* View Mode Toggle */}
          <div className="flex border rounded-md overflow-hidden">
            <Button 
              variant={viewMode === 'weekly' ? 'default' : 'ghost'} 
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('weekly')}
            >
              Settimana
            </Button>
            <Button 
              variant={viewMode === 'monthly' ? 'default' : 'ghost'} 
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('monthly')}
            >
              Mese
            </Button>
          </div>

          <Dialog open={isAppointmentDialogOpen} onOpenChange={setIsAppointmentDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Appuntamento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Nuovo Appuntamento</DialogTitle>
                <DialogDescription>Crea un appuntamento con un cliente</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4">
                <div className="grid gap-4 py-4">
                  <div className="space-y-2 relative" ref={titleInputRef}>
                    <Label>Titolo *</Label>
                    <Input 
                      value={newAppointment.title} 
                      onChange={(e) => handleTitleChange(e.target.value)} 
                      onFocus={() => { if (titleSuggestions.length > 0) setShowTitleSuggestions(true); }}
                      onBlur={() => setTimeout(() => setShowTitleSuggestions(false), 200)}
                      placeholder="Es. Sessione PT o nome cliente..." 
                      autoComplete="off"
                    />
                    {showTitleSuggestions && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {titleSuggestions.map(c => {
                          const pkg = getClientPackage(c.user_id);
                          return (
                            <button
                              key={c.user_id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                              onMouseDown={(e) => { e.preventDefault(); selectTitleSuggestion(c); }}
                            >
                              <span>{c.first_name} {c.last_name}</span>
                              {pkg && <span className="text-xs text-muted-foreground">📦 {pkg.remaining_lessons}/{pkg.total_lessons}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Date Picker */}
                  <div className="space-y-2">
                    <Label>Data *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !appointmentDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {appointmentDate ? format(appointmentDate, "PPP", { locale: it }) : "Seleziona data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={appointmentDate}
                          onSelect={setAppointmentDate}
                          locale={it}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ora Inizio *</Label>
                      <Input type="time" value={appointmentStartTime} onChange={(e) => setAppointmentStartTime(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Ora Fine *</Label>
                      <Input type="time" value={appointmentEndTime} onChange={(e) => setAppointmentEndTime(e.target.value)} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Coach *</Label>
                    <Select value={newAppointment.coach_id} onValueChange={(v) => setNewAppointment({ ...newAppointment, coach_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleziona coach" /></SelectTrigger>
                      <SelectContent>
                        {coaches.map(c => (
                          <SelectItem key={c.user_id} value={c.user_id}>{c.first_name} {c.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select value={newAppointment.client_id} onValueChange={(v) => setNewAppointment({ ...newAppointment, client_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleziona cliente (opzionale)" /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => {
                          const pkg = getClientPackage(c.user_id);
                          return (
                            <SelectItem key={c.user_id} value={c.user_id}>
                              {c.first_name} {c.last_name}
                              {pkg && ` 📦 ${pkg.remaining_lessons}/${pkg.total_lessons}`}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {newAppointment.client_id && getClientPackage(newAppointment.client_id) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Pacchetto: {getClientPackage(newAppointment.client_id)!.remaining_lessons}/{getClientPackage(newAppointment.client_id)!.total_lessons} lezioni — verrà scalata 1 lezione
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Descrizione</Label>
                    <Textarea value={newAppointment.description} onChange={(e) => setNewAppointment({ ...newAppointment, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Luogo</Label>
                      <Input value={newAppointment.location} onChange={(e) => setNewAppointment({ ...newAppointment, location: e.target.value })} placeholder="Es. Sala 1" />
                    </div>
                    <div className="space-y-2">
                      <Label>Colore</Label>
                      <Input type="color" value={newAppointment.color} onChange={(e) => setNewAppointment({ ...newAppointment, color: e.target.value })} className="h-10" />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="flex-shrink-0 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsAppointmentDialogOpen(false)}>Annulla</Button>
                <Button onClick={createAppointment} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Crea
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCourseSessionDialogOpen} onOpenChange={setIsCourseSessionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="gap-2"><Plus className="w-4 h-4" />Sessione Corso</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Nuova Sessione Corso</DialogTitle>
                <DialogDescription>Aggiungi una sessione per un corso esistente</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4">
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Corso *</Label>
                    <Select value={newCourseSession.course_id} onValueChange={(v) => setNewCourseSession({ ...newCourseSession, course_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleziona corso" /></SelectTrigger>
                      <SelectContent>
                        {courses.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Repeat className="w-4 h-4" />
                      Giorni della settimana *
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Seleziona i giorni in cui si ripete il corso (verranno create sessioni per 1 anno)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {weekDays.map((day) => (
                        <Button
                          key={day.value}
                          type="button"
                          variant={selectedDays.includes(day.value) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleDay(day.value)}
                          className="min-w-[50px]"
                        >
                          {day.short}
                        </Button>
                      ))}
                    </div>
                    {selectedDays.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Selezionati: {selectedDays.map(d => weekDays.find(w => w.value === d)?.label).join(", ")}
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ora Inizio *</Label>
                      <Input type="time" value={courseSessionStartTime} onChange={(e) => setCourseSessionStartTime(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Ora Fine *</Label>
                      <Input type="time" value={courseSessionEndTime} onChange={(e) => setCourseSessionEndTime(e.target.value)} />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="flex-shrink-0 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsCourseSessionDialogOpen(false)}>Annulla</Button>
                <Button onClick={createCourseSession} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Crea
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : viewMode === 'weekly' ? (
        /* Weekly View */
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="grid grid-cols-8 border-b border-border">
                <div className="p-3 text-sm text-muted-foreground text-center border-r border-border">Ora</div>
                {days.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "p-3 text-center border-r border-border last:border-r-0 cursor-pointer hover:bg-accent/50 transition-colors",
                        isSameDay(day, new Date()) && 'bg-primary/10',
                        dragOverDay === dayKey && 'bg-primary/20'
                      )}
                      onClick={() => handleDayClick(day)}
                    >
                      <div className="text-xs text-muted-foreground uppercase">{format(day, "EEE", { locale: it })}</div>
                      <div 
                        className={cn(
                          "text-lg font-display cursor-pointer hover:text-primary transition-colors",
                          isSameDay(day, new Date()) && 'text-primary'
                        )}
                        onClick={(e) => handleDayNumberClick(day, e)}
                      >
                        {format(day, "d")}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time slots */}
              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-8 border-b border-border last:border-b-0">
                  <div className="p-2 text-xs text-muted-foreground text-center border-r border-border">
                    {hour}:00
                  </div>
                  {days.map((day) => {
                    const events = getEventsForDay(day);
                    const hourAppointments = events.appointments.filter(a => new Date(a.start_time).getHours() === hour);
                    const hourSessions = events.sessions.filter(s => new Date(s.start_time).getHours() === hour);
                    const dayKey = format(day, "yyyy-MM-dd");

                    return (
                      <div
                        key={`${day.toISOString()}-${hour}`}
                        className={cn(
                          "p-0.5 md:p-1 min-h-[40px] md:min-h-[60px] border-r border-border last:border-r-0 relative cursor-pointer hover:bg-accent/30 transition-colors",
                          dragOverDay === dayKey && 'bg-primary/10'
                        )}
                        onClick={() => handleDayClick(day)}
                        onDragOver={(e) => handleDragOver(e, dayKey)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, day)}
                      >
                        {hourAppointments.map((apt) => {
                          const clientName = getClientName(apt.client_id);
                          const clientPkg = getClientPackage(apt.client_id);
                          return (
                            <div
                              key={apt.id}
                              draggable
                              onDragStart={() => handleDragStart({ type: 'appointment', id: apt.id, data: apt })}
                              className="text-xs p-1.5 rounded mb-1 text-white cursor-grab active:cursor-grabbing hover:opacity-90 group relative"
                              style={{ backgroundColor: apt.color }}
                              title={`${apt.title}${clientName ? ` - ${clientName}` : ''}${clientPkg ? ` (📦 ${clientPkg.remaining_lessons}/${clientPkg.total_lessons})` : ''}`}
                              onClick={(e) => handleAppointmentClick(apt, e)}
                            >
                              <div className="flex items-center gap-1">
                                <GripVertical className="w-3 h-3 flex-shrink-0 opacity-50" />
                                <User className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{apt.title}</span>
                                {clientPkg && (
                                  <span className="text-[10px] bg-white/20 px-1 rounded flex-shrink-0">
                                    📦{clientPkg.remaining_lessons}
                                  </span>
                                )}
                                {apt.client_id && <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
                              </div>
                              {clientName && (
                                <div className="text-[10px] opacity-80 truncate mt-0.5 ml-4">
                                  {clientName}
                                </div>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteAppointmentId(apt.id); }}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded p-0.5"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                        {hourSessions.map((session) => (
                          <div
                            key={session.id}
                            draggable
                            onDragStart={() => handleDragStart({ type: 'session', id: session.id, data: session })}
                            className="text-xs p-1.5 rounded mb-1 text-white truncate cursor-grab active:cursor-grabbing hover:opacity-90 group relative"
                            style={{ backgroundColor: session.course?.color || '#10B981' }}
                            title={session.course?.name}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1">
                              <GripVertical className="w-3 h-3 flex-shrink-0 opacity-50" />
                              <Clock className="w-3 h-3" />
                              <span className="truncate">{session.course?.name}</span>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteCourseSessionId(session.id); }}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded p-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {/* Workout deadlines in weekly view */}
                        {hour === 7 && events.deadlines.map(deadline => {
                          const clientName = getClientName(deadline.client_id);
                          return (
                            <div
                              key={deadline.id}
                              className="text-xs p-1.5 rounded mb-1 bg-destructive/20 text-destructive truncate flex items-center gap-1 cursor-pointer hover:bg-destructive/30 transition-colors"
                              title={`Scadenza scheda: ${deadline.name}${clientName ? ` - ${clientName}` : ''}`}
                              onClick={(e) => handleDeadlineClick(deadline, e)}
                            >
                              <Dumbbell className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">Scad. {clientName || deadline.name}</span>
                            </div>
                          );
                        })}
                        {/* Subscription deadlines in weekly view */}
                        {hour === 7 && events.subDeadlines.map(sub => {
                          const clientName = getClientName(sub.user_id);
                          return (
                            <div
                              key={`sub-${sub.id}`}
                              className="text-xs p-1.5 rounded mb-1 bg-orange-500/20 text-orange-700 dark:text-orange-400 truncate flex items-center gap-1 group relative"
                              title={`Scadenza abb.: ${sub.plan_name}${clientName ? ` - ${clientName}` : ''}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <CreditCard className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">Abb. {clientName || sub.plan_name}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRenewSubscription(sub); }}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-orange-600/30 rounded p-0.5"
                                title="Rinnova abbonamento"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Monthly View */
        <Card>
          <CardContent className="p-2 md:p-4">
            <div className="overflow-x-auto">
            <div className="min-w-[320px]">
            <div className="grid grid-cols-7 gap-px md:gap-1">
              {/* Day headers */}
              {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                <div key={day} className="p-1 text-center text-[10px] md:text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {days.map((day) => {
                const events = getEventsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentDate);
                const dayKey = format(day, "yyyy-MM-dd");
                const totalEvents = events.appointments.length + events.sessions.length + events.deadlines.length + events.subDeadlines.length;
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={cn(
                      "h-[60px] md:h-[120px] p-0.5 md:p-1.5 border rounded cursor-pointer hover:bg-accent/30 transition-colors overflow-hidden",
                      isToday ? 'bg-primary/10 border-primary' : 'border-border',
                      !isCurrentMonth && 'opacity-40',
                      dragOverDay === dayKey && 'bg-primary/20 border-primary'
                    )}
                    onClick={() => handleDayClick(day)}
                    onDragOver={(e) => handleDragOver(e, dayKey)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day)}
                  >
                    <div 
                      className={cn(
                        "text-sm font-medium mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer",
                        isToday && 'bg-primary text-primary-foreground'
                      )}
                      onClick={(e) => handleDayNumberClick(day, e)}
                    >
                      {format(day, "d")}
                    </div>
                    
                    <div className="space-y-0.5">
                      {events.appointments.slice(0, 2).map(apt => {
                        const clientName = getClientName(apt.client_id);
                        return (
                          <div
                            key={apt.id}
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); handleDragStart({ type: 'appointment', id: apt.id, data: apt }); }}
                            className="text-[10px] p-1 rounded text-white truncate cursor-grab active:cursor-grabbing hover:opacity-90 group relative"
                            style={{ backgroundColor: apt.color }}
                            onClick={(e) => handleAppointmentClick(apt, e)}
                          >
                            {apt.title}
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteAppointmentId(apt.id); }}
                              className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-2 h-2" />
                            </button>
                          </div>
                        );
                      })}
                      
                      {events.sessions.slice(0, 2).map(session => (
                        <div
                          key={session.id}
                          draggable
                          onDragStart={(e) => { e.stopPropagation(); handleDragStart({ type: 'session', id: session.id, data: session }); }}
                          className="text-[10px] p-1 rounded text-white truncate cursor-grab active:cursor-grabbing group relative"
                          style={{ backgroundColor: session.course?.color || '#10B981' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {session.course?.name}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteCourseSessionId(session.id); }}
                            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-2 h-2" />
                          </button>
                        </div>
                      ))}
                      
                      {/* Workout deadlines */}
                      {events.deadlines.slice(0, 1).map(deadline => {
                        const clientName = getClientName(deadline.client_id);
                        return (
                          <div
                            key={deadline.id}
                            className="text-[10px] p-1 rounded bg-destructive/20 text-destructive truncate flex items-center gap-1 cursor-pointer hover:bg-destructive/30 transition-colors"
                            title={`Scadenza scheda: ${deadline.name}${clientName ? ` - ${clientName}` : ''}`}
                            onClick={(e) => handleDeadlineClick(deadline, e)}
                          >
                            <Dumbbell className="w-2 h-2" />
                            Scad. {clientName || deadline.name}
                          </div>
                        );
                      })}

                      {/* Subscription deadlines */}
                      {events.subDeadlines.slice(0, 1).map(sub => {
                        const clientName = getClientName(sub.user_id);
                        return (
                          <div
                            key={`sub-${sub.id}`}
                            className="text-[10px] p-1 rounded bg-orange-500/20 text-orange-700 dark:text-orange-400 truncate flex items-center gap-1 group relative"
                            title={`Scadenza abb.: ${sub.plan_name}${clientName ? ` - ${clientName}` : ''}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <CreditCard className="w-2 h-2" />
                            Abb. {clientName || sub.plan_name}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRenewSubscription(sub); }}
                              className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100"
                              title="Rinnova"
                            >
                              <RefreshCw className="w-2 h-2" />
                            </button>
                          </div>
                        );
                      })}
                      
                      {/* Show "+X altri" when there are more than what's shown */}
                      {(() => {
                        const shownAppts = Math.min(events.appointments.length, 2);
                        const shownSessions = Math.min(events.sessions.length, 2);
                        const shownDeadlines = Math.min(events.deadlines.length, 1);
                        const shownSubDeadlines = Math.min(events.subDeadlines.length, 1);
                        const totalShown = shownAppts + shownSessions + shownDeadlines + shownSubDeadlines;
                        const remaining = totalEvents - totalShown;
                        if (remaining > 0) {
                          return (
                            <div 
                              className="text-[10px] text-muted-foreground cursor-pointer hover:text-primary font-medium"
                              onClick={(e) => handleDayNumberClick(day, e)}
                            >
                              + {remaining} altri
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[#3B82F6]"></div>
          <span className="text-muted-foreground">Appuntamenti</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[#10B981]"></div>
          <span className="text-muted-foreground">Corsi</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-destructive/50"></div>
          <span className="text-muted-foreground">Scadenza Schede</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-500/50"></div>
          <span className="text-muted-foreground">Scadenza Abbonamenti</span>
        </div>
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={!!dayDetailDate} onOpenChange={() => setDayDetailDate(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {dayDetailDate && format(dayDetailDate, "EEEE d MMMM yyyy", { locale: it })}
            </DialogTitle>
            <DialogDescription>Tutti gli eventi della giornata</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-2">
            {dayDetailEvents && (
              <div className="space-y-3 pr-4">
                {dayDetailEvents.appointments.length === 0 && dayDetailEvents.sessions.length === 0 && dayDetailEvents.deadlines.length === 0 && dayDetailEvents.subDeadlines.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">Nessun evento per questa giornata</p>
                )}

                {dayDetailEvents.appointments.map(apt => {
                  const clientName = getClientName(apt.client_id);
                  return (
                    <div key={apt.id} className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { setDayDetailDate(null); handleAppointmentClick(apt, { stopPropagation: () => {} } as React.MouseEvent); }}>
                      <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: apt.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{apt.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(apt.start_time), "HH:mm")} - {format(parseISO(apt.end_time), "HH:mm")}
                        </div>
                        {clientName && <div className="text-xs text-muted-foreground mt-1"><User className="w-3 h-3 inline mr-1" />{clientName}</div>}
                        {apt.location && <div className="text-xs text-muted-foreground mt-0.5">📍 {apt.location}</div>}
                      </div>
                      <div className="flex gap-1">
                        {apt.client_id && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); navigate(`/admin/utenti/${apt.client_id}`); }}>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteAppointmentId(apt.id); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {dayDetailEvents.sessions.map(session => (
                  <div key={session.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                    <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: session.course?.color || '#10B981' }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{session.course?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(parseISO(session.start_time), "HH:mm")} - {format(parseISO(session.end_time), "HH:mm")}
                      </div>
                      <Badge variant="secondary" className="mt-1 text-[10px]">Corso</Badge>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => setDeleteCourseSessionId(session.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}

                {dayDetailEvents.deadlines.map(deadline => {
                  const clientName = getClientName(deadline.client_id);
                  return (
                    <div key={deadline.id} className="flex items-start gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5 cursor-pointer hover:bg-destructive/10 transition-colors" onClick={() => { setDayDetailDate(null); navigate(`/admin/utenti/${deadline.client_id}/scheda/${deadline.id}/modifica`); }}>
                      <Dumbbell className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">Scadenza Scheda</div>
                        <div className="text-xs text-muted-foreground">{deadline.name}</div>
                        {clientName && <div className="text-xs text-muted-foreground mt-1">{clientName}</div>}
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground mt-1" />
                    </div>
                  );
                })}

                {dayDetailEvents.subDeadlines.map(sub => {
                  const clientName = getClientName(sub.user_id);
                  return (
                    <div key={`sub-${sub.id}`} className="flex items-start gap-3 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
                      <CreditCard className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">Scadenza Abbonamento</div>
                        <div className="text-xs text-muted-foreground">{sub.plan_name}</div>
                        {clientName && <div className="text-xs text-muted-foreground mt-1">{clientName}</div>}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 px-2 text-orange-600 border-orange-500/30 hover:bg-orange-500/10"
                        onClick={() => handleRenewSubscription(sub)}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Rinnova
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button onClick={() => { setDayDetailDate(null); if (dayDetailDate) handleDayClick(dayDetailDate); }} className="gap-2">
              <Plus className="w-4 h-4" />Nuovo Appuntamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Appointment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Modifica Appuntamento</DialogTitle>
            <DialogDescription>Modifica i dettagli dell'appuntamento</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="grid gap-4 py-4">
              <div className="space-y-2 relative" ref={editTitleInputRef}>
                <Label>Titolo *</Label>
                <Input 
                  value={editForm.title} 
                  onChange={(e) => handleTitleChange(e.target.value, true)} 
                  onFocus={() => { if (editTitleSuggestions.length > 0) setShowEditTitleSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowEditTitleSuggestions(false), 200)}
                  autoComplete="off"
                />
                {showEditTitleSuggestions && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {editTitleSuggestions.map(c => (
                      <button
                        key={c.user_id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); selectTitleSuggestion(c, true); }}
                      >
                        {c.first_name} {c.last_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Data *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editDate ? format(editDate, "PPP", { locale: it }) : "Seleziona data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={editDate} onSelect={setEditDate} locale={it} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ora Inizio *</Label>
                  <Input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ora Fine *</Label>
                  <Input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Coach *</Label>
                <Select value={editForm.coach_id} onValueChange={(v) => setEditForm({ ...editForm, coach_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona coach" /></SelectTrigger>
                  <SelectContent>
                    {coaches.map(c => (
                      <SelectItem key={c.user_id} value={c.user_id}>{c.first_name} {c.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={editForm.client_id} onValueChange={(v) => setEditForm({ ...editForm, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona cliente (opzionale)" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.user_id} value={c.user_id}>{c.first_name} {c.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Luogo</Label>
                  <Input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Colore</Label>
                  <Input type="color" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className="h-10" />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="flex-shrink-0 pt-4 border-t gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Annulla</Button>
            {editingAppointment?.client_id && (
              <Button variant="secondary" onClick={() => { setIsEditDialogOpen(false); navigate(`/admin/utenti/${editingAppointment.client_id}`); }}>
                <ExternalLink className="w-4 h-4 mr-2" />Profilo Cliente
              </Button>
            )}
            <Button onClick={updateAppointment} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <AlertDialog open={!!deleteAppointmentId} onOpenChange={() => setDeleteAppointmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare l'appuntamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. L'appuntamento verrà rimosso dal calendario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteAppointment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Course Session Confirmation */}
      <AlertDialog open={!!deleteCourseSessionId} onOpenChange={() => setDeleteCourseSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la sessione del corso?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. La sessione verrà rimossa dal calendario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteCourseSession}
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

export default CalendarManagement;
