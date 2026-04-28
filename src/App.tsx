import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";

// Public pages
import Index from "./pages/Index";
import Contatti from "./pages/Contatti";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Dashboard router
import Dashboard from "./pages/Dashboard";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import ClientDetailPage from "./pages/admin/ClientDetailPage";
import SubscriptionManagement from "./pages/admin/SubscriptionManagement";
import CalendarManagement from "./pages/admin/CalendarManagement";
import WorkoutPlanEditor from "./pages/admin/WorkoutPlanEditor";

import GymHoursManagement from "./pages/admin/GymHoursManagement";
import CourseManagement from "./pages/admin/CourseManagement";
import MembershipPlanManagement from "./pages/admin/MembershipPlanManagement";
import AdminReportsPage from "./pages/admin/AdminReportsPage";
import StructurePerformancePage from "./pages/admin/StructurePerformancePage";
import ExpensesManagement from "./pages/admin/ExpensesManagement";

// Coach pages
import CoachDashboard from "./pages/coach/CoachDashboard";
import CoachClientsPage from "./pages/coach/CoachClientsPage";
import CoachWorkoutsPage from "./pages/coach/CoachWorkoutsPage";
import CoachCalendarPage from "./pages/coach/CoachCalendarPage";
import CoachReportsPage from "./pages/coach/CoachReportsPage";

// Client pages
import PalestraDashboard from "./pages/cliente/PalestraDashboard";
import CoachingDashboard from "./pages/cliente/CoachingDashboard";
import WorkoutPlanPage from "./pages/cliente/WorkoutPlanPage";

import ProgressPage from "./pages/cliente/ProgressPage";
import AppointmentsPage from "./pages/cliente/AppointmentsPage";

import DocumentsPage from "./pages/cliente/DocumentsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/contatti" element={<Contatti />} />
            <Route path="/login" element={<Login />} />
            
            {/* Protected dashboard router */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/utenti" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/utenti/nuovo" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/utenti/:userId" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ClientDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/utenti/:userId/scheda/nuova" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <WorkoutPlanEditor />
              </ProtectedRoute>
            } />
            <Route path="/admin/utenti/:userId/scheda/:planId/modifica" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <WorkoutPlanEditor />
              </ProtectedRoute>
            } />
            <Route path="/admin/abbonamenti" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <SubscriptionManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/calendario" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CalendarManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/orari" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <GymHoursManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/corsi" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CourseManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/piani" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <MembershipPlanManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/segnalazioni" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminReportsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/andamento-struttura" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <StructurePerformancePage />
              </ProtectedRoute>
            } />
            <Route path="/admin/spese" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ExpensesManagement />
              </ProtectedRoute>
            } />
            
            {/* Coach routes */}
            <Route path="/coach" element={
              <ProtectedRoute allowedRoles={['coach', 'admin']}>
                <CoachDashboard />
              </ProtectedRoute>
            } />
            <Route path="/coach/clienti" element={
              <ProtectedRoute allowedRoles={['coach', 'admin']}>
                <CoachClientsPage />
              </ProtectedRoute>
            } />
            <Route path="/coach/schede" element={
              <ProtectedRoute allowedRoles={['coach', 'admin']}>
                <CoachWorkoutsPage />
              </ProtectedRoute>
            } />
            <Route path="/coach/calendario" element={
              <ProtectedRoute allowedRoles={['coach', 'admin']}>
                <CoachCalendarPage />
              </ProtectedRoute>
            } />
            <Route path="/coach/segnalazioni" element={
              <ProtectedRoute allowedRoles={['coach', 'admin']}>
                <CoachReportsPage />
              </ProtectedRoute>
            } />
            <Route path="/coach/*" element={
              <ProtectedRoute allowedRoles={['coach', 'admin']}>
                <CoachDashboard />
              </ProtectedRoute>
            } />
            
            {/* Cliente Palestra routes */}
            <Route path="/palestra" element={
              <ProtectedRoute allowedRoles={['cliente_palestra', 'cliente_corso']}>
                <PalestraDashboard />
              </ProtectedRoute>
            } />
            <Route path="/palestra/*" element={
              <ProtectedRoute allowedRoles={['cliente_palestra', 'cliente_corso']}>
                <PalestraDashboard />
              </ProtectedRoute>
            } />
            
            {/* Cliente Coaching routes */}
            <Route path="/coaching" element={
              <ProtectedRoute allowedRoles={['cliente_coaching']}>
                <CoachingDashboard />
              </ProtectedRoute>
            } />
            <Route path="/coaching/scheda" element={
              <ProtectedRoute allowedRoles={['cliente_coaching']}>
                <WorkoutPlanPage />
              </ProtectedRoute>
            } />
            <Route path="/coaching/scheda/:dayId" element={
              <ProtectedRoute allowedRoles={['cliente_coaching']}>
                <WorkoutPlanPage />
              </ProtectedRoute>
            } />
            <Route path="/coaching/progressi" element={
              <ProtectedRoute allowedRoles={['cliente_coaching']}>
                <ProgressPage />
              </ProtectedRoute>
            } />
            <Route path="/coaching/appuntamenti" element={
              <ProtectedRoute allowedRoles={['cliente_coaching']}>
                <AppointmentsPage />
              </ProtectedRoute>
            } />
            <Route path="/coaching/documenti" element={
              <ProtectedRoute allowedRoles={['cliente_coaching']}>
                <DocumentsPage />
              </ProtectedRoute>
            } />
            <Route path="/coaching/*" element={
              <ProtectedRoute allowedRoles={['cliente_coaching']}>
                <CoachingDashboard />
              </ProtectedRoute>
            } />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
