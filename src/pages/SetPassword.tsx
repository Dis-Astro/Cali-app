import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const getAuthErrorFromUrl = () => {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

  return url.searchParams.get("error_description") || hash.get("error_description");
};

const SetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeInvite = async () => {
      const authError = getAuthErrorFromUrl();
      if (authError) {
        if (mounted) {
          setError("Il link non è più valido. Richiedi un nuovo invito all'amministratore.");
          setCheckingSession(false);
        }
        return;
      }

      let { data, error: sessionError } = await supabase.auth.getSession();
      const code = new URL(window.location.href).searchParams.get("code");

      if (!data.session && code) {
        const exchange = await supabase.auth.exchangeCodeForSession(code);
        data = exchange.data;
        sessionError = exchange.error;
      }

      if (!mounted) return;

      if (sessionError || !data.session) {
        setError("Invito non valido o scaduto. Richiedi un nuovo collegamento.");
      } else {
        setSessionReady(true);
      }
      setCheckingSession(false);
    };

    void initializeInvite();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La password deve contenere almeno 8 caratteri.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Le due password non coincidono.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message || "Impossibile impostare la password.");
      setSaving(false);
      return;
    }

    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background px-5 native-safe-top native-safe-bottom">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(218,0,255,0.2),transparent_65%)]" />

      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center py-8">
        <div className="mb-7">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <KeyRound className="h-7 w-7 text-primary-foreground" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Super Power Gym</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide">CREA LA PASSWORD</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Completa l'attivazione del tuo account scegliendo una password personale.
          </p>
        </div>

        {checkingSession ? (
          <div className="flex items-center justify-center gap-3 rounded-3xl border border-border bg-card/90 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Verifica dell'invito in corso…
          </div>
        ) : sessionReady ? (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-border bg-card/90 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            {error && (
              <Alert variant="destructive" className="rounded-2xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-medium">Nuova password</label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-2xl bg-background/70 pr-11"
                  autoComplete="new-password"
                  minLength={8}
                  required
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
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium">Conferma password</label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-12 rounded-2xl bg-background/70"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <div className="flex items-start gap-2 rounded-2xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Usa almeno 8 caratteri e non riutilizzare la password di altri servizi.
            </div>

            <Button type="submit" className="h-12 w-full rounded-2xl font-semibold" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {saving ? "Salvataggio…" : "Attiva account"}
            </Button>
          </form>
        ) : (
          <div className="rounded-3xl border border-destructive/30 bg-card/90 p-5 shadow-2xl shadow-black/20">
            <Alert variant="destructive" className="rounded-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button asChild variant="outline" className="mt-4 h-12 w-full rounded-2xl">
              <Link to="/login">Torna all'accesso</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default SetPassword;
