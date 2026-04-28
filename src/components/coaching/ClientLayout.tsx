import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { 
  Dumbbell, 
  Calendar, 
  TrendingUp,
  Play,
  FileText,
  
  LogOut,
  Menu,
  X,
  Flame,
  Target,
  ChevronRight,
  Star,
  User
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface ClientLayoutProps {
  children: React.ReactNode;
  title: string;
}

const ClientLayout = ({ children, title }: ClientLayoutProps) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigationItems = [
    { icon: Target, label: "Dashboard", href: "/coaching" },
    { icon: Dumbbell, label: "La Mia Scheda", href: "/coaching/scheda" },
    { icon: TrendingUp, label: "I Miei Progressi", href: "/coaching/progressi" },
    { icon: Calendar, label: "Appuntamenti", href: "/coaching/appuntamenti" },
    
    { icon: FileText, label: "Documenti", href: "/coaching/documenti" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Premium Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 
        bg-gradient-to-b from-sidebar-background via-sidebar-background to-card
        border-r border-sidebar-border
        transform transition-transform duration-300 lg:translate-x-0 lg:static
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="h-20 flex items-center px-6 border-b border-sidebar-border">
            <Link to="/coaching" className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                <Flame className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <span className="font-display text-2xl tracking-wider text-sidebar-foreground block">COACHING</span>
                <span className="text-xs text-primary font-medium tracking-widest">PREMIUM</span>
              </div>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Card */}
          <div className="p-4">
            <div className="bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-4 border border-primary/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="font-display text-xl text-primary">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{profile?.first_name} {profile?.last_name}</p>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-primary fill-primary" />
                    <span className="text-xs text-primary">Cliente Premium</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-primary/20 to-primary/5 text-primary border-l-2 border-primary' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-sidebar-border">
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive" onClick={signOut}>
              <LogOut className="w-5 h-5" />Esci
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <header className="h-16 bg-gradient-to-r from-card to-background border-b border-border flex items-center px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-foreground mr-4">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h1 className="font-display text-xl tracking-wider">{title}</h1>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default ClientLayout;
