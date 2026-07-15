import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock,
  CreditCard,
  Layers3,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const primaryItems = [
  { label: "Home", href: "/admin", icon: BarChart3 },
  { label: "Clienti", href: "/admin/utenti", icon: Users },
  { label: "Calendario", href: "/admin/calendario", icon: CalendarDays },
  { label: "Abb.", href: "/admin/abbonamenti", icon: CreditCard },
];

const moreItems = [
  { label: "Corsi", href: "/admin/corsi", icon: BookOpen },
  { label: "Orari palestra", href: "/admin/orari", icon: Clock },
  { label: "Piani", href: "/admin/piani", icon: Layers3 },
  { label: "Feedback", href: "/admin/segnalazioni", icon: MessageSquare },
  { label: "Spese", href: "/admin/spese", icon: Receipt },
  { label: "Andamento", href: "/admin/andamento-struttura", icon: TrendingUp },
];

const AdminBottomNav = () => {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const isActive = (href: string) => {
    if (href === "/admin") return location.pathname === "/admin";
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const moreActive = moreItems.some((item) => isActive(item.href));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-1 pt-1.5 shadow-[0_-10px_30px_rgba(0,0,0,0.14)] lg:hidden"
      aria-label="Navigazione amministratore"
    >
      <div className="grid grid-cols-5 pb-[max(0.35rem,var(--safe-bottom))]">
        {primaryItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 transition active:scale-95 ${
                active ? "bg-primary/10 text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${active ? "stroke-[2.7]" : "stroke-[2]"}`} />
              <span className="w-full truncate text-center text-[9px] font-semibold leading-none">{item.label}</span>
            </Link>
          );
        })}

        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-current={moreActive ? "page" : undefined}
              className={`flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 transition active:scale-95 ${
                moreActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
              }`}
            >
              <MoreHorizontal className={`h-5 w-5 ${moreActive ? "stroke-[2.7]" : "stroke-[2]"}`} />
              <span className="text-[9px] font-semibold leading-none">Altro</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[82dvh] rounded-t-3xl px-4 pb-[max(1.25rem,var(--safe-bottom))] pt-5">
            <SheetHeader className="pr-8 text-left">
              <SheetTitle className="font-display text-2xl tracking-wide">ALTRE FUNZIONI</SheetTitle>
              <SheetDescription>
                {profile?.first_name} {profile?.last_name} · Amministratore
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {moreItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <SheetClose asChild key={item.href}>
                    <Link
                      to={item.href}
                      className={`flex min-h-20 items-center gap-3 rounded-2xl border p-4 transition active:scale-[0.98] ${
                        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold leading-tight">{item.label}</span>
                    </Link>
                  </SheetClose>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 text-sm font-semibold text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Esci dall’account
            </button>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
};

export default AdminBottomNav;
