import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Search, Loader2, Trash2, Edit, Eye } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import type { Database } from "@/integrations/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  fiscal_code: string | null;
  emergency_contact: string | null;
  created_at: string;
}

const roleLabels: Record<UserRole, string> = {
  admin: "Amministratore",
  coach: "Coach",
  cliente_palestra: "Cliente Palestra",
  cliente_coaching: "Cliente Coaching",
  cliente_corso: "Cliente Corso"
};

const roleBadgeVariant: Record<UserRole, "default" | "secondary" | "destructive" | "outline"> = {
  admin: "destructive",
  coach: "default",
  cliente_palestra: "secondary",
  cliente_coaching: "outline",
  cliente_corso: "secondary"
};

const UserManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  
  // Create dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "cliente_palestra" as UserRole,
    phone: "",
    address: "",
    date_of_birth: "",
    fiscal_code: "",
    emergency_contact: ""
  });

  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Errore", description: "Impossibile caricare gli utenti", variant: "destructive" });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const createUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.first_name || !newUser.last_name) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const response = await supabase.functions.invoke("create-user", {
        body: {
          email: newUser.email,
          password: newUser.password,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          role: newUser.role,
          phone: newUser.phone || undefined,
          address: newUser.address || undefined,
          date_of_birth: newUser.date_of_birth || undefined,
          fiscal_code: newUser.fiscal_code || undefined,
          emergency_contact: newUser.emergency_contact || undefined
        }
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || response.error?.message);
      }

      toast({ title: "Utente creato", description: `${newUser.first_name} ${newUser.last_name} è stato creato` });
      setNewUser({ email: "", password: "", first_name: "", last_name: "", role: "cliente_palestra", phone: "", address: "", date_of_birth: "", fiscal_code: "", emergency_contact: "" });
      setIsCreateDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Errore", description: error.message || "Impossibile creare l'utente", variant: "destructive" });
    }
    setCreating(false);
  };

  const openEditDialog = (user: Profile) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const saveUser = async () => {
    if (!editingUser) return;

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: editingUser.first_name,
        last_name: editingUser.last_name,
        role: editingUser.role,
        phone: editingUser.phone,
        address: editingUser.address,
        date_of_birth: editingUser.date_of_birth,
        fiscal_code: editingUser.fiscal_code,
        emergency_contact: editingUser.emergency_contact
      })
      .eq("id", editingUser.id);

    if (error) {
      toast({ title: "Errore", description: "Impossibile aggiornare l'utente", variant: "destructive" });
    } else {
      toast({ title: "Successo", description: "Utente aggiornato" });
      setIsEditDialogOpen(false);
      setEditingUser(null);
      fetchUsers();
    }
    setSaving(false);
  };

  const deleteUser = async () => {
    if (!deleteUserId) return;

    setDeleting(true);
    const { error } = await supabase.from("profiles").delete().eq("id", deleteUserId);

    if (error) {
      toast({ title: "Errore", description: "Impossibile eliminare l'utente", variant: "destructive" });
    } else {
      toast({ title: "Successo", description: "Utente eliminato" });
      fetchUsers();
    }
    setDeleteUserId(null);
    setDeleting(false);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <AdminLayout title="GESTIONE UTENTI" icon={<Users className="w-6 h-6" />}>
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca utenti..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Filtra per ruolo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i ruoli</SelectItem>
            <SelectItem value="admin">Amministratori</SelectItem>
            <SelectItem value="coach">Coach</SelectItem>
            <SelectItem value="cliente_palestra">Clienti Palestra</SelectItem>
            <SelectItem value="cliente_coaching">Clienti Coaching</SelectItem>
            <SelectItem value="cliente_corso">Clienti Corso</SelectItem>
          </SelectContent>
        </Select>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><UserPlus className="w-4 h-4" />Nuovo Utente</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider">Crea Nuovo Utente</DialogTitle>
              <DialogDescription>Inserisci i dati del nuovo utente.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} placeholder="Mario" />
                </div>
                <div className="space-y-2">
                  <Label>Cognome *</Label>
                  <Input value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} placeholder="Rossi" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="mario.rossi@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Minimo 6 caratteri" />
              </div>
              <div className="space-y-2">
                <Label>Ruolo *</Label>
                <Select value={newUser.role} onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Amministratore</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="cliente_palestra">Cliente Palestra</SelectItem>
                    <SelectItem value="cliente_coaching">Cliente Coaching</SelectItem>
                    <SelectItem value="cliente_corso">Cliente Corso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefono</Label>
                  <Input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} placeholder="+39 123 456 7890" />
                </div>
                <div className="space-y-2">
                  <Label>Data di Nascita</Label>
                  <Input type="date" value={newUser.date_of_birth} onChange={(e) => setNewUser({ ...newUser, date_of_birth: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Indirizzo</Label>
                <Input value={newUser.address} onChange={(e) => setNewUser({ ...newUser, address: e.target.value })} placeholder="Via Example, 123" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Codice Fiscale</Label>
                  <Input value={newUser.fiscal_code} onChange={(e) => setNewUser({ ...newUser, fiscal_code: e.target.value })} placeholder="RSSMRA..." />
                </div>
                <div className="space-y-2">
                  <Label>Contatto Emergenza</Label>
                  <Input value={newUser.emergency_contact} onChange={(e) => setNewUser({ ...newUser, emergency_contact: e.target.value })} placeholder="+39 123 456 7890" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Annulla</Button>
              <Button onClick={createUser} disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Crea Utente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display tracking-wider">Utenti Registrati</CardTitle>
          <CardDescription>{filteredUsers.length} utenti trovati</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessun utente trovato</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Ruolo</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Data Registrazione</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow 
                      key={user.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/utenti/${user.user_id}`)}
                    >
                      <TableCell className="font-medium">{user.first_name} {user.last_name}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant[user.role]}>{roleLabels[user.role]}</Badge>
                      </TableCell>
                      <TableCell>{user.phone || "-"}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString("it-IT")}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => { e.stopPropagation(); navigate(`/admin/utenti/${user.user_id}`); }}
                          title="Visualizza dettaglio"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => { e.stopPropagation(); openEditDialog(user); }}
                          title="Modifica"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => { e.stopPropagation(); setDeleteUserId(user.id); }} 
                          disabled={user.role === 'admin'}
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">Modifica Utente</DialogTitle>
            <DialogDescription>Modifica i dati dell'utente</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={editingUser.first_name} onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cognome</Label>
                  <Input value={editingUser.last_name} onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ruolo</Label>
                <Select value={editingUser.role} onValueChange={(value: UserRole) => setEditingUser({ ...editingUser, role: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Amministratore</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="cliente_palestra">Cliente Palestra</SelectItem>
                    <SelectItem value="cliente_coaching">Cliente Coaching</SelectItem>
                    <SelectItem value="cliente_corso">Cliente Corso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefono</Label>
                  <Input value={editingUser.phone || ""} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value || null })} />
                </div>
                <div className="space-y-2">
                  <Label>Data di Nascita</Label>
                  <Input type="date" value={editingUser.date_of_birth || ""} onChange={(e) => setEditingUser({ ...editingUser, date_of_birth: e.target.value || null })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Indirizzo</Label>
                <Input value={editingUser.address || ""} onChange={(e) => setEditingUser({ ...editingUser, address: e.target.value || null })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Codice Fiscale</Label>
                  <Input value={editingUser.fiscal_code || ""} onChange={(e) => setEditingUser({ ...editingUser, fiscal_code: e.target.value || null })} />
                </div>
                <div className="space-y-2">
                  <Label>Contatto Emergenza</Label>
                  <Input value={editingUser.emergency_contact || ""} onChange={(e) => setEditingUser({ ...editingUser, emergency_contact: e.target.value || null })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Annulla</Button>
            <Button onClick={saveUser} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. L'utente e tutti i suoi dati verranno eliminati permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default UserManagement;
