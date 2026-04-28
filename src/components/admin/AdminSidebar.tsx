import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Calendar, 
  CreditCard, 
  BarChart3,
  LogOut,
  X,
  Dumbbell,
  Clock,
  ArrowLeft,
  BookOpen,
  MessageSquare,
  TrendingUp,
  Receipt
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
  { icon: BookOpen, label: "Corsi", href: "/admin/corsi" },
  { icon: Clock, label: "Orari Palestra", href: "/admin/orari" },
  { icon: MessageSquare, label: "Feedback Clienti", href: "/admin/segnalazioni" },
  { icon: Receipt, label: "Spese", href: "/admin/spese" },
  { icon: TrendingUp, label: "Andamento", href: "/admin/andamento-struttura" },
];

const AdminSidebar = ({ isOpen, onClose, showBackLink = false }: AdminSidebarProps) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  return (
    <>
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-background border-r border-sidebar-border
        transform transition-transform duration-300 lg:translate-x-0 lg:static
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
            <Link to="/admin" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl tracking-wider text-sidebar-foreground">ADMIN</span>
            </Link>
            <button 
              onClick={onClose} 
              className="ml-auto lg:hidden text-sidebar-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Back link */}
          {showBackLink && (
            <div className="p-4 border-b border-sidebar-border">
              <Link 
                to="/admin"
                className="flex items-center gap-2 text-sidebar-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Torna alla Dashboard
              </Link>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-sm transition-colors
                    ${isActive 
                      ? 'bg-sidebar-accent text-sidebar-primary' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-sidebar-border">
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
              <LogOut className="w-5 h-5" />
              Esci
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
};

export default AdminSidebar;
