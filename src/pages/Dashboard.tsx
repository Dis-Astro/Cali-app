import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

// Dashboard Router - redirects to the appropriate dashboard based on role
const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!profile) {
      navigate("/login", { replace: true });
      return;
    }

    // Redirect based on role
    switch (profile.role) {
      case 'admin':
        navigate("/admin", { replace: true });
        break;
      case 'coach':
        navigate("/coach", { replace: true });
        break;
      case 'cliente_coaching':
        navigate("/coaching", { replace: true });
        break;
      case 'cliente_palestra':
        navigate("/palestra", { replace: true });
        break;
      case 'cliente_corso':
        navigate("/palestra", { replace: true });
        break;
      default:
        navigate("/palestra", { replace: true });
    }
  }, [profile, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Reindirizzamento...</p>
      </div>
    </div>
  );
};

export default Dashboard;
