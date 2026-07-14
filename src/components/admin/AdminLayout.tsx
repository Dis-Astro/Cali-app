import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import AdminBottomNav from "./AdminBottomNav";
import MobileAdminCalendar from "./MobileAdminCalendar";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  icon?: ReactNode;
  showBackLink?: boolean;
  hideSidebar?: boolean;
}

const AdminLayout = ({ children, title, icon, showBackLink = false, hideSidebar = false }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isCalendar = title === "CALENDARIO";

  if (hideSidebar) {
    return (
      <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-background">
        <header className="flex min-h-14 items-center border-b border-border bg-card px-4 native-safe-top">
          {icon && <span className="mr-3 text-primary">{icon}</span>}
          <h1 className="font-display text-lg tracking-wider">{title}</h1>
        </header>
        <div className="min-w-0 flex-1 overflow-auto p-4 native-safe-bottom">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showBackLink={showBackLink} />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 shrink-0 items-center border-b border-border bg-card px-4 native-safe-top md:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="mr-4 hidden text-foreground sm:inline-flex lg:hidden"
            aria-label="Apri menu amministratore"
          >
            <Menu className="h-6 w-6" />
          </button>
          {icon && <span className="mr-3 text-primary">{icon}</span>}
          <h1 className="truncate font-display text-xl tracking-wider md:text-2xl">{title}</h1>
        </header>

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-[calc(5rem+var(--safe-bottom))] pt-4 sm:p-4 sm:native-safe-bottom md:p-6">
          {isCalendar ? (
            <>
              <div className="sm:hidden"><MobileAdminCalendar /></div>
              <div className="hidden sm:block">{children}</div>
            </>
          ) : children}
        </div>
      </main>

      <AdminBottomNav />
    </div>
  );
};

export default AdminLayout;
