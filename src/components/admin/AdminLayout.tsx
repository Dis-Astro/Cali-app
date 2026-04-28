import { useState, ReactNode } from "react";
import AdminSidebar from "./AdminSidebar";
import { Menu } from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  icon?: ReactNode;
  showBackLink?: boolean;
  hideSidebar?: boolean;
}

const AdminLayout = ({ children, title, icon, showBackLink = false, hideSidebar = false }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (hideSidebar) {
    return (
      <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
        <header className="h-12 bg-card border-b border-border flex items-center px-4">
          {icon && <span className="mr-3 text-primary">{icon}</span>}
          <h1 className="font-display text-lg tracking-wider">{title}</h1>
        </header>
        <div className="flex-1 min-w-0 p-4 overflow-auto">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden w-full">
      <AdminSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        showBackLink={showBackLink}
      />

      <main className="flex-1 flex flex-col min-h-0 min-w-0 w-full">
        {/* Header */}
        <header className="h-16 flex-shrink-0 bg-card border-b border-border flex items-center px-4 md:px-6 min-w-0">
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="lg:hidden text-foreground mr-4"
          >
            <Menu className="w-6 h-6" />
          </button>
          {icon && <span className="mr-3 text-primary">{icon}</span>}
          <h1 className="font-display text-xl md:text-2xl tracking-wider truncate">{title}</h1>
        </header>

        {/* Content - scrollable */}
        <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
