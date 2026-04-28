import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Key, Loader2, Mail } from "lucide-react";

interface PasswordResetDialogProps {
  userId: string;
  userEmail?: string;
  userName: string;
}

const PasswordResetDialog = ({ userId, userEmail, userName }: PasswordResetDialogProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ 
        title: "Errore", 
        description: "La password deve avere almeno 6 caratteri", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { user_id: userId, new_password: newPassword }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Errore sconosciuto");
      }

      toast({ title: "Successo", description: "Password aggiornata con successo" });
      setNewPassword("");
      setIsOpen(false);
    } catch (err: any) {
      toast({ 
        title: "Errore", 
        description: err.message || "Impossibile aggiornare la password", 
        variant: "destructive" 
      });
    }
    setLoading(false);
  };

  const handleSendResetEmail = async () => {
    if (!userEmail) {
      toast({ 
        title: "Errore", 
        description: "Email utente non disponibile", 
        variant: "destructive" 
      });
      return;
    }

    setSendingEmail(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/login`
      });

      if (error) throw error;

      toast({ 
        title: "Email inviata", 
        description: `Email di reset inviata a ${userEmail}` 
      });
      setIsOpen(false);
    } catch (err: any) {
      toast({ 
        title: "Errore", 
        description: err.message || "Impossibile inviare l'email", 
        variant: "destructive" 
      });
    }
    setSendingEmail(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Key className="w-4 h-4" />
          Password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">
            Gestione Password
          </DialogTitle>
          <DialogDescription>
            Gestisci la password per {userName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Admin set password */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Imposta nuova password</Label>
            <p className="text-sm text-muted-foreground">
              Imposta direttamente una nuova password per questo utente
            </p>
            <Input
              type="password"
              placeholder="Nuova password (min. 6 caratteri)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button onClick={handleSetPassword} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Imposta Password
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">oppure</span>
            </div>
          </div>

          {/* Email reset */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Invia email di reset</Label>
            <p className="text-sm text-muted-foreground">
              L'utente riceverà un'email con il link per reimpostare la password
            </p>
            <Button 
              variant="secondary" 
              onClick={handleSendResetEmail} 
              disabled={sendingEmail || !userEmail}
              className="w-full gap-2"
            >
              {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Invia Email Reset
            </Button>
            {!userEmail && (
              <p className="text-xs text-destructive">Email non disponibile per questo utente</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordResetDialog;
