import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Archive,
  CalendarDays,
  Dumbbell,
  FileText,
  HelpCircle,
  Home,
  LogOut,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import OfflineSyncStatus from "@/components/coaching/OfflineSyncStatus";

interface ClientLayoutProps {
  children: ReactNode;
  title: string;
}

const navigationItems = [
  { icon: Home, shortLabel: "Home", label: "Home", href: "/coaching" },
  { icon: Dumbbell, shortLabel: "Scheda", label: "Scheda", href: "/coaching/scheda" },
  { icon: Archive, shortLabel: "Archivio", label: "Archivio schede", href: "/coaching/archivio" },
  { icon: CalendarDays, shortLabel: "App.", label: "Appuntamenti", href: "/coaching/appuntamenti" },
  { icon: FileText, shortLabel: "Documenti", label: "Documenti", href: "/coaching/documenti" },
  { icon: HelpCircle, shortLabel: "Aiuto", label: "Aiuto", href: "/coaching/segnala" },
  { icon: TrendingUp, shortLabel: "Progressi", label: "Progressi", href: "/coaching/progressi" },
];

const ClientLayout = ({ children, title }: ClientLayoutProps) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/coaching") return location.pathname === "/coaching";
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

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

        <div className="space-y-3 px-4 py-5">
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{profile?.first_name} {profile?.last_name}</p>
                <p className="text-xs text-muted-foreground">Cliente coaching</p>
              </div>
            </div>
          </div>
          <OfflineSyncStatus />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {navigationItems.map((item) => (
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
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
            Esci
          </Button>
        </div>
      </aside>

      <div className="flex min-h-[100dvh] flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 backdrop-blur-xl native-safe-top">
          <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Super Power Gym</p>
              <h1 className="truncate font-display text-xl tracking-wide">{title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <OfflineSyncStatus />
              <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex lg:hidden">
                <span className="font-display text-base">
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-32 md:px-6 lg:pb-8">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/97 px-1 pt-1.5 backdrop-blur-xl lg:hidden" aria-label="Navigazione cliente">
          <div className="grid grid-cols-7 pb-[max(0.35rem,var(--safe-bottom))]">
            {navigationItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 transition active:scale-95 ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <item.icon className={`h-[19px] w-[19px] shrink-0 ${active ? "stroke-[2.7]" : "stroke-[2]"}`} />
                  <span className="w-full truncate text-center text-[8px] font-semibold leading-none tracking-[-0.02em]">
                    {item.shortLabel}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default ClientLayout;
