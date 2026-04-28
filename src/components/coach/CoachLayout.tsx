import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Calendar, 
  Dumbbell,
  LogOut,
  Menu,
  X,
  ClipboardList,
  MessageSquare
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface CoachLayoutProps {
  children: ReactNode;
  title: string;
  icon?: ReactNode;
}

const navigationItems = [
  { icon: ClipboardList, label: "Dashboard", href: "/coach" },
  { icon: Users, label: "I Miei Clienti", href: "/coach/clienti" },
  { icon: Dumbbell, label: "Schede Allenamento", href: "/coach/schede" },
  { icon: Calendar, label: "Calendario", href: "/coach/calendario" },
  { icon: MessageSquare, label: "Feedback Clienti", href: "/coach/segnalazioni" },
];

const CoachLayout = ({ children, title, icon }: CoachLayoutProps) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen bg-background flex overflow-hidden w-full">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-background border-r border-sidebar-border
        transform transition-transform duration-300 lg:translate-x-0 lg:static
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
            <Link to="/coach" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl tracking-wider text-sidebar-foreground">COACH</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== "/coach" && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-colors ${
                    isActive 
                      ? 'bg-sidebar-accent text-sidebar-primary' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-sidebar-border">
            <div className="mb-3 px-4">
              <p className="text-sm font-medium text-sidebar-foreground">{profile?.first_name} {profile?.last_name}</p>
              <p className="text-xs text-muted-foreground">Coach</p>
            </div>
            <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground hover:text-destructive" onClick={signOut}>
              <LogOut className="w-5 h-5" />Esci
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-background/80 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="flex-1 flex flex-col min-h-0 min-w-0 w-full">
        <header className="h-16 flex-shrink-0 bg-card border-b border-border flex items-center px-4 md:px-6 min-w-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-foreground mr-4">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 min-w-0">
            {icon}
            <h1 className="font-display text-xl md:text-2xl tracking-wider truncate">{title}</h1>
          </div>
        </header>

        <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};

export default CoachLayout;
