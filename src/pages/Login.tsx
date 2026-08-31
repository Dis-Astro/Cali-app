import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck, Zap } from "lucide-react";
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
  const { signIn, isAuthenticated, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !authLoading) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, authLoading, navigate]);

  if (authLoading) return null;

  const handleChange = (field: keyof LoginFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (authError) setAuthError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);

    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LoginFormData, string>> = {};
      result.error.errors.forEach((error) => {
        if (error.path[0]) fieldErrors[error.path[0] as keyof LoginFormData] = error.message;
      });
      setErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }

    const { error } = await signIn(formData.email, formData.password);
    if (error) {
      if (error.message.includes("Invalid login credentials")) setAuthError("Email o password non corretti");
      else if (error.message.includes("Email not confirmed")) setAuthError("Email non confermata. Contatta l'amministratore.");
      else setAuthError(error.message);
      setIsSubmitting(false);
      return;
    }

    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background px-5 native-safe-top native-safe-bottom">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(218,0,255,0.2),transparent_65%)]" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
        <header className="flex items-center justify-between pt-5">
          <Link
            to="/"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card/80"
            aria-label="Torna alla home"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Accesso protetto
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-8">
          <div className="mb-7">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
              <Zap className="h-7 w-7 fill-current text-primary-foreground" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Super Power Gym</p>
            <h1 className="mt-2 font-display text-4xl tracking-wide">BENTORNATO</h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Accedi per continuare il tuo percorso, controllare la scheda e gestire gli appuntamenti.
            </p>
          </div>

          {authError && (
            <Alert variant="destructive" className="mb-4 rounded-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-border bg-card/90 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  className={`h-12 rounded-2xl bg-background/70 pl-11 ${errors.email ? "border-destructive" : ""}`}
                  placeholder="nome@email.it"
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="mt-1.5 text-xs text-destructive">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(event) => handleChange("password", event.target.value)}
                  className={`h-12 rounded-2xl bg-background/70 pl-11 pr-11 ${errors.password ? "border-destructive" : ""}`}
                  placeholder="La tua password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground"
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="h-12 w-full rounded-2xl font-semibold" disabled={isSubmitting}>
              {isSubmitting ? "Accesso in corso..." : "Accedi"}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
            Non hai ancora le credenziali? Contatta la reception.
          </p>
        </main>
      </div>
    </div>
  );
};

export default Login;
