import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Dumbbell,
  FileText,
  LogOut,
  MessageSquare,
  Target,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface ClientLayoutProps {
  children: ReactNode;
  title: string;
}

const primaryNavigation = [
  { icon: Target, label: "Home", href: "/coaching" },
  { icon: Dumbbell, label: "Scheda", href: "/coaching/scheda" },
  { icon: Calendar, label: "Agenda", href: "/coaching/appuntamenti" },
  { icon: TrendingUp, label: "Progressi", href: "/coaching/progressi" },
];

const secondaryNavigation = [
  { icon: FileText, label: "Documenti", href: "/coaching/documenti" },
  { icon: MessageSquare, label: "Segnala problema", href: "/coaching/segnala" },
];

const ClientLayout = ({ children, title }: ClientLayoutProps) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const isActive = (href: string) =>
    location.pathname === href || (href !== "/coaching" && location.pathname.startsWith(`${href}/`));

  return (
    <div className="min-h-[100dvh] bg-background text-foreground lg:flex">
      <aside className="hidden min-h-screen w-72 flex-col border-r border-border bg-card/70 lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-border px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary">
            <Zap className="h-6 w-6 fill-current text-primary-foreground" />
          </div>
          <div>
            <p className="font-display text-xl tracking-wider">SUPER POWER GYM</p>
            <p className="text-xs text-primary">Coaching</p>
          </div>
        </div>

        <div className="px-4 py-5">
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{profile?.first_name} {profile?.last_name}</p>
                <p className="text-xs text-muted-foreground">Cliente coaching</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {[...primaryNavigation, ...secondaryNavigation].map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                isActive(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive" onClick={signOut}>
            <LogOut className="h-5 w-5" />
            Esci
          </Button>
        </div>
      </aside>

      <div className="flex min-h-[100dvh] flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 px-4 backdrop-blur-xl native-safe-top">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Super Power Gym</p>
              <h1 className="font-display text-xl tracking-wide">{title}</h1>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary lg:hidden">
              <span className="font-display text-base">
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-28 md:px-6 lg:pb-8">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[max(0.5rem,var(--safe-bottom))] pt-2 backdrop-blur-xl lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
            {primaryNavigation.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition ${
                  isActive(item.href) ? "bg-primary/12 text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive(item.href) ? "stroke-[2.5]" : ""}`} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default ClientLayout;
