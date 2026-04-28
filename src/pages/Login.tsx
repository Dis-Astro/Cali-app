import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";

const loginSchema = z.object({
  email: z.string().trim().email("Email non valida"),
  password: z.string().min(1, "La password è obbligatoria"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login = () => {
  const navigate = useNavigate();
  const { signIn, user, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in - use useEffect to avoid calling navigate during render
  useEffect(() => {
    if (user && !authLoading) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading) return null;

  const handleChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    if (authError) {
      setAuthError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);

    const result = loginSchema.safeParse(formData);
    
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LoginFormData, string>> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof LoginFormData] = err.message;
        }
      });
      setErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }

    const { error } = await signIn(formData.email, formData.password);
    
    if (error) {
      // Handle specific error messages
      if (error.message.includes('Invalid login credentials')) {
        setAuthError('Email o password non corretti');
      } else if (error.message.includes('Email not confirmed')) {
        setAuthError('Email non confermata. Contatta l\'amministratore.');
      } else {
        setAuthError(error.message);
      }
      setIsSubmitting(false);
      return;
    }

    // Success - navigate to dashboard
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="page-container flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Back Link */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-body text-sm uppercase tracking-wider">Torna alla Home</span>
        </Link>

        {/* Header */}
        <header className="mb-8 text-center animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-sm bg-secondary">
              <Lock className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="section-title text-foreground">
            AREA CLIENTI
          </h1>
          <p className="text-muted-foreground font-body">
            Accedi per visualizzare le tue schede, i tuoi progressi e i pagamenti.
          </p>
        </header>

        {/* Auth Error Alert */}
        {authError && (
          <Alert variant="destructive" className="mb-6 animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="form-container space-y-5 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                placeholder="La tua email"
                autoComplete="email"
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                className={`pl-10 ${errors.password ? "border-destructive" : ""}`}
                placeholder="La tua password"
                autoComplete="current-password"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password}</p>}
          </div>

          <Button 
            type="submit" 
            className="w-full font-display text-lg tracking-wider"
            disabled={isSubmitting}
          >
            {isSubmitting ? "ACCESSO IN CORSO..." : "ACCEDI"}
          </Button>
        </form>

        {/* Info Notice */}
        <div className="mt-8 text-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="inline-block rounded-sm bg-secondary/50 px-4 py-3 border border-border">
            <p className="text-sm text-muted-foreground">
              <span className="text-primary font-semibold">Credenziali mancanti?</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Contatta l'amministratore per ricevere le tue credenziali di accesso
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
