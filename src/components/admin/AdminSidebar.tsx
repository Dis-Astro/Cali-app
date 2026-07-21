import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Calendar,
  Clock,
  CreditCard,
  Dumbbell,
  Layers3,
  LogOut,
  MessageSquare,
  Mic,
  Receipt,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  showBackLink?: boolean;
}

const navigationItems = [
  { icon: BarChart3, label: "Dashboard", href: "/admin" },
  { icon: Users, label: "Utenti", href: "/admin/utenti" },
  { icon: Calendar, label: "Calendario", href: "/admin/calendario" },
  { icon: CreditCard, label: "Abbonamenti", href: "/admin/abbonamenti" },
  { icon: Layers3, label: "Piani", href: "/admin/piani" },
  { icon: BookOpen, label: "Corsi", href: "/admin/corsi" },
  { icon: Clock, label: "Orari Palestra", href: "/admin/orari" },
  { icon: MessageSquare, label: "Feedback Clienti", href: "/admin/segnalazioni" },
  { icon: Mic, label: "Audio Timer", href: "/admin/audio-timer" },
  { icon: Receipt, label: "Spese", href: "/admin/spese" },
  { icon: TrendingUp, label: "Andamento", href: "/admin/andamento-struttura" },
];

const AdminSidebar = ({ isOpen, onClose, showBackLink = false }: AdminSidebarProps) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/admin") return location.pathname === "/admin";
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <aside
        style={{ backgroundColor: "hsl(var(--sidebar-background))" }}
        className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-sidebar-border shadow-2xl shadow-black/70 transition-transform duration-300 lg:static lg:w-64 lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col native-safe-top native-safe-bottom">
          <div className="flex min-h-16 items-center border-b border-sidebar-border px-6">
            <Link to="/admin" className="flex items-center gap-3" onClick={onClose}>
              <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary">
                <Dumbbell className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl tracking-wider text-sidebar-foreground">ADMIN</span>
            </Link>
            <button onClick={onClose} className="ml-auto text-sidebar-foreground lg:hidden" aria-label="Chiudi menu">
              <X className="h-5 w-5" />
            </button>
          </div>

          {showBackLink && (
            <div className="border-b border-sidebar-border p-4">
              <Link
                to="/admin"
                onClick={onClose}
                className="flex items-center gap-2 text-sidebar-foreground transition-colors hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                Torna alla Dashboard
              </Link>
            </div>
          )}

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {navigationItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="mb-3 px-4">
              <p className="text-sm font-medium text-sidebar-foreground">
                {profile?.first_name} {profile?.last_name}
              </p>
              <p className="text-xs text-muted-foreground">Amministratore</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:text-destructive"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
              Esci
            </Button>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/90 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default AdminSidebar;
