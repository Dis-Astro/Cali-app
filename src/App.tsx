import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";

const Index = lazy(() => import("./pages/Index"));
const Contatti = lazy(() => import("./pages/Contatti"));
const Login = lazy(() => import("./pages/Login"));
const SetPassword = lazy(() => import("./pages/SetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const NewUserManagementPage = lazy(() => import("./pages/admin/NewUserManagementPage"));
const ClientDetailPage = lazy(() => import("./pages/admin/ClientDetailPage"));
const SubscriptionManagement = lazy(() => import("./pages/admin/SubscriptionManagement"));
const CalendarManagement = lazy(() => import("./pages/admin/CalendarManagement"));
const WorkoutPlanEditor = lazy(() => import("./pages/admin/WorkoutPlanEditor"));
const GymHoursManagement = lazy(() => import("./pages/admin/GymHoursManagement"));
const CourseManagement = lazy(() => import("./pages/admin/CourseManagement"));
const MembershipPlanManagement = lazy(() => import("./pages/admin/MembershipPlanManagement"));
const AdminReportsPage = lazy(() => import("./pages/admin/AdminReportsPage"));
const StructurePerformancePage = lazy(() => import("./pages/admin/StructurePerformancePage"));
const ExpensesManagement = lazy(() => import("./pages/admin/ExpensesManagement"));
const TimerAudioManagement = lazy(() => import("./pages/shared/TimerAudioManagement"));

const CoachDashboard = lazy(() => import("./pages/coach/CoachDashboard"));
const CoachClientsPage = lazy(() => import("./pages/coach/CoachClientsPage"));
const CoachWorkoutsPage = lazy(() => import("./pages/coach/CoachWorkoutsPage"));
const CoachCalendarPage = lazy(() => import("./pages/coach/CoachCalendarPage"));
const CoachReportsPage = lazy(() => import("./pages/coach/CoachReportsPage"));

const PalestraDashboard = lazy(() => import("./pages/cliente/PalestraDashboard"));
const MobileCoachingHome = lazy(() => import("./pages/cliente/MobileCoachingHome"));
const WorkoutPlanPage = lazy(() => import("./pages/cliente/WorkoutPlanPage"));
const WorkoutArchivePage = lazy(() => import("./pages/cliente/WorkoutArchivePage"));
const ProgressPage = lazy(() => import("./pages/cliente/ProgressPage"));
const AppointmentsPage = lazy(() => import("./pages/cliente/AppointmentsPage"));
const DocumentsPage = lazy(() => import("./pages/cliente/DocumentsPage"));
const ReportProblemPage = lazy(() => import("./pages/cliente/ReportProblemPage"));

const queryClient = new QueryClient();

const AppEntry = () => {
  const { isAuthenticated, loading } = useAuth();
  if (!Capacitor.isNativePlatform()) return <Index />;
  if (loading) return <div className="flex min-h-[100dvh] items-center justify-center bg-background text-sm text-muted-foreground">Caricamento…</div>;
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-background text-sm text-muted-foreground">Caricamento…</div>}>
            <Routes>
            <Route path="/" element={<AppEntry />} />
            <Route path="/contatti" element={<Contatti />} />
            <Route path="/login" element={<Login />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/utenti" element={<ProtectedRoute allowedRoles={["admin"]}><UserManagement /></ProtectedRoute>} />
            <Route path="/admin/utenti/nuovo" element={<ProtectedRoute allowedRoles={["admin"]}><NewUserManagementPage /></ProtectedRoute>} />
            <Route path="/admin/utenti/:userId" element={<ProtectedRoute allowedRoles={["admin"]}><ClientDetailPage /></ProtectedRoute>} />
            <Route path="/admin/utenti/:userId/scheda/nuova" element={<ProtectedRoute allowedRoles={["admin"]}><WorkoutPlanEditor /></ProtectedRoute>} />
            <Route path="/admin/utenti/:userId/scheda/:planId/modifica" element={<ProtectedRoute allowedRoles={["admin"]}><WorkoutPlanEditor /></ProtectedRoute>} />
            <Route path="/admin/abbonamenti" element={<ProtectedRoute allowedRoles={["admin"]}><SubscriptionManagement /></ProtectedRoute>} />
            <Route path="/admin/calendario" element={<ProtectedRoute allowedRoles={["admin"]}><CalendarManagement /></ProtectedRoute>} />
            <Route path="/admin/orari" element={<ProtectedRoute allowedRoles={["admin"]}><GymHoursManagement /></ProtectedRoute>} />
            <Route path="/admin/corsi" element={<ProtectedRoute allowedRoles={["admin"]}><CourseManagement /></ProtectedRoute>} />
            <Route path="/admin/piani" element={<ProtectedRoute allowedRoles={["admin"]}><MembershipPlanManagement /></ProtectedRoute>} />
            <Route path="/admin/segnalazioni" element={<ProtectedRoute allowedRoles={["admin"]}><AdminReportsPage /></ProtectedRoute>} />
            <Route path="/admin/andamento-struttura" element={<ProtectedRoute allowedRoles={["admin"]}><StructurePerformancePage /></ProtectedRoute>} />
            <Route path="/admin/spese" element={<ProtectedRoute allowedRoles={["admin"]}><ExpensesManagement /></ProtectedRoute>} />
            <Route path="/admin/audio-timer" element={<ProtectedRoute allowedRoles={["admin"]}><TimerAudioManagement /></ProtectedRoute>} />

            <Route path="/coach" element={<ProtectedRoute allowedRoles={["coach", "admin"]}><CoachDashboard /></ProtectedRoute>} />
            <Route path="/coach/clienti" element={<ProtectedRoute allowedRoles={["coach", "admin"]}><CoachClientsPage /></ProtectedRoute>} />
            <Route path="/coach/schede" element={<ProtectedRoute allowedRoles={["coach", "admin"]}><CoachWorkoutsPage /></ProtectedRoute>} />
            <Route path="/coach/calendario" element={<ProtectedRoute allowedRoles={["coach", "admin"]}><CoachCalendarPage /></ProtectedRoute>} />
            <Route path="/coach/segnalazioni" element={<ProtectedRoute allowedRoles={["coach", "admin"]}><CoachReportsPage /></ProtectedRoute>} />
            <Route path="/coach/audio-timer" element={<ProtectedRoute allowedRoles={["coach", "admin"]}><TimerAudioManagement /></ProtectedRoute>} />
            <Route path="/coach/*" element={<ProtectedRoute allowedRoles={["coach", "admin"]}><CoachDashboard /></ProtectedRoute>} />

            <Route path="/palestra" element={<ProtectedRoute allowedRoles={["cliente_palestra", "cliente_corso"]}><PalestraDashboard /></ProtectedRoute>} />
            <Route path="/palestra/*" element={<ProtectedRoute allowedRoles={["cliente_palestra", "cliente_corso"]}><PalestraDashboard /></ProtectedRoute>} />

            <Route path="/coaching" element={<ProtectedRoute allowedRoles={["cliente_coaching"]}><MobileCoachingHome /></ProtectedRoute>} />
            <Route path="/coaching/scheda" element={<ProtectedRoute allowedRoles={["cliente_coaching"]}><WorkoutPlanPage /></ProtectedRoute>} />
            <Route path="/coaching/scheda/:dayId" element={<ProtectedRoute allowedRoles={["cliente_coaching"]}><WorkoutPlanPage /></ProtectedRoute>} />
            <Route path="/coaching/archivio" element={<ProtectedRoute allowedRoles={["cliente_coaching"]}><WorkoutArchivePage /></ProtectedRoute>} />
            <Route path="/coaching/progressi" element={<ProtectedRoute allowedRoles={["cliente_coaching"]}><ProgressPage /></ProtectedRoute>} />
            <Route path="/coaching/appuntamenti" element={<ProtectedRoute allowedRoles={["cliente_coaching"]}><AppointmentsPage /></ProtectedRoute>} />
            <Route path="/coaching/documenti" element={<ProtectedRoute allowedRoles={["cliente_coaching"]}><DocumentsPage /></ProtectedRoute>} />
            <Route path="/coaching/segnala" element={<ProtectedRoute allowedRoles={["cliente_coaching"]}><ReportProblemPage /></ProtectedRoute>} />
            <Route path="/coaching/*" element={<ProtectedRoute allowedRoles={["cliente_coaching"]}><MobileCoachingHome /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
