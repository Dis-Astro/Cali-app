import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Edit2, Loader2, DollarSign, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Expense {
  id: string;
  category: "fissa" | "variabile";
  subcategory: string;
  amount: number;
  date: string;
  provider: string;
  notes: string;
  is_recurring: boolean;
  is_deductible: boolean;
  is_paid: boolean;
  created_at: string;
}

const EXPENSE_CATEGORIES = {
  fissa: ["Affitto", "Utenze", "Assicurazioni", "Stipendi", "Canone Software", "Manutenzione Attrezzature"],
  variabile: ["Acquisto Attrezzature", "Materiali", "Marketing", "Formazione", "Consulenze", "Trasporti"]
};

const ExpensesManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedExpenseForDelete, setSelectedExpenseForDelete] = useState<Expense | null>(null);
  const [filterCategory, setFilterCategory] = useState<"all" | "fissa" | "variabile">("all");
  const [filterPaid, setFilterPaid] = useState<"all" | "paid" | "unpaid">("all");

  const [formData, setFormData] = useState({
    category: "variabile" as "fissa" | "variabile",
    subcategory: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    provider: "",
    notes: "",
    is_recurring: false,
    is_deductible: true,
    is_paid: false,
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast({ title: "Errore", description: "Impossibile caricare le spese", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExpense = async () => {
    if (!formData.subcategory || !formData.amount || !formData.provider) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }

    try {
      if (editingExpense) {
        const { error } = await supabase
          .from("expenses")
          .update({
            category: formData.category,
            subcategory: formData.subcategory,
            amount: parseFloat(formData.amount),
            date: formData.date,
            provider: formData.provider,
            notes: formData.notes,
            is_recurring: formData.is_recurring,
            is_deductible: formData.is_deductible,
            is_paid: formData.is_paid,
          })
          .eq("id", editingExpense.id);

        if (error) throw error;
        toast({ title: "Successo", description: "Spesa aggiornata" });
      } else {
        const { error } = await supabase
          .from("expenses")
          .insert([{
            category: formData.category,
            subcategory: formData.subcategory,
            amount: parseFloat(formData.amount),
            date: formData.date,
            provider: formData.provider,
            notes: formData.notes,
            is_recurring: formData.is_recurring,
            is_deductible: formData.is_deductible,
            is_paid: formData.is_paid,
          }]);

        if (error) throw error;
        toast({ title: "Successo", description: "Spesa aggiunta" });
      }

      setIsDialogOpen(false);
      setEditingExpense(null);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast({ title: "Errore", description: "Impossibile salvare la spesa", variant: "destructive" });
    }
  };

  const handleDeleteExpense = async () => {
    if (!selectedExpenseForDelete) return;

    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", selectedExpenseForDelete.id);

      if (error) throw error;
      toast({ title: "Successo", description: "Spesa eliminata" });
      setIsDeleteDialogOpen(false);
      setSelectedExpenseForDelete(null);
      fetchExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({ title: "Errore", description: "Impossibile eliminare la spesa", variant: "destructive" });
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      subcategory: expense.subcategory,
      amount: expense.amount.toString(),
      date: expense.date,
      provider: expense.provider,
      notes: expense.notes,
      is_recurring: expense.is_recurring,
      is_deductible: expense.is_deductible,
      is_paid: expense.is_paid,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      category: "variabile",
      subcategory: "",
      amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
      provider: "",
      notes: "",
      is_recurring: false,
      is_deductible: true,
      is_paid: false,
    });
    setEditingExpense(null);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const filteredExpenses = expenses.filter((expense) => {
    const categoryMatch = filterCategory === "all" || expense.category === filterCategory;
    const paidMatch = filterPaid === "all" || (filterPaid === "paid" ? expense.is_paid : !expense.is_paid);
    return categoryMatch && paidMatch;
  });

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const fixedExpenses = filteredExpenses.filter(e => e.category === "fissa").reduce((sum, e) => sum + e.amount, 0);
  const variableExpenses = filteredExpenses.filter(e => e.category === "variabile").reduce((sum, e) => sum + e.amount, 0);
  const deductibleExpenses = filteredExpenses.filter(e => e.is_deductible).reduce((sum, e) => sum + e.amount, 0);

  return (
    <AdminLayout title="GESTIONE SPESE" icon={<TrendingDown className="w-6 h-6" />}>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Spese Totali</p>
              <p className="text-2xl font-display tracking-wider mt-2">€{totalExpenses.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Spese Fisse</p>
              <p className="text-2xl font-display tracking-wider mt-2 text-orange-600 dark:text-orange-400">€{fixedExpenses.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Spese Variabili</p>
              <p className="text-2xl font-display tracking-wider mt-2 text-blue-600 dark:text-blue-400">€{variableExpenses.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Deducibili</p>
              <p className="text-2xl font-display tracking-wider mt-2 text-green-600 dark:text-green-400">€{deductibleExpenses.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Add Expense Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4" />
              Aggiungi Spesa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingExpense ? "Modifica Spesa" : "Nuova Spesa"}</DialogTitle>
              <DialogDescription>
                {editingExpense ? "Aggiorna i dettagli della spesa" : "Inserisci i dettagli della nuova spesa"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={formData.category} onValueChange={(value: any) => {
                  setFormData({ ...formData, category: value, subcategory: "" });
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fissa">Fissa</SelectItem>
                    <SelectItem value="variabile">Variabile</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sottocategoria *</Label>
                <Select value={formData.subcategory} onValueChange={(value) => {
                  setFormData({ ...formData, subcategory: value });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES[formData.category].map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Importo (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Fornitore *</Label>
                <Input
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  placeholder="Nome fornitore"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Note</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Note aggiuntive"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recurring"
                  checked={formData.is_recurring}
                  onCheckedChange={(checked: any) => setFormData({ ...formData, is_recurring: checked })}
                />
                <Label htmlFor="recurring" className="cursor-pointer">Ricorrente</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="deductible"
                  checked={formData.is_deductible}
                  onCheckedChange={(checked: any) => setFormData({ ...formData, is_deductible: checked })}
                />
                <Label htmlFor="deductible" className="cursor-pointer">Deducibile</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="paid"
                  checked={formData.is_paid}
                  onCheckedChange={(checked: any) => setFormData({ ...formData, is_paid: checked })}
                />
                <Label htmlFor="paid" className="cursor-pointer">Pagata</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>Annulla</Button>
              <Button onClick={handleSaveExpense}>Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display tracking-wider">Filtri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={filterCategory} onValueChange={(value: any) => setFilterCategory(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte</SelectItem>
                    <SelectItem value="fissa">Fisse</SelectItem>
                    <SelectItem value="variabile">Variabili</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Stato Pagamento</Label>
                <Select value={filterPaid} onValueChange={(value: any) => setFilterPaid(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte</SelectItem>
                    <SelectItem value="paid">Pagate</SelectItem>
                    <SelectItem value="unpaid">Da Pagare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display tracking-wider">Elenco Spese</CardTitle>
            <CardDescription>{filteredExpenses.length} spese</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Sottocategoria</TableHead>
                      <TableHead>Fornitore</TableHead>
                      <TableHead>Importo</TableHead>
                      <TableHead>Ricorrente</TableHead>
                      <TableHead>Deducibile</TableHead>
                      <TableHead>Pagata</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Nessuna spesa trovata
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredExpenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>{format(new Date(expense.date), "dd MMM yyyy", { locale: it })}</TableCell>
                          <TableCell>
                            <Badge variant={expense.category === "fissa" ? "secondary" : "outline"}>
                              {expense.category === "fissa" ? "Fissa" : "Variabile"}
                            </Badge>
                          </TableCell>
                          <TableCell>{expense.subcategory}</TableCell>
                          <TableCell>{expense.provider}</TableCell>
                          <TableCell className="font-medium">€{expense.amount.toFixed(2)}</TableCell>
                          <TableCell>{expense.is_recurring ? "✓" : "-"}</TableCell>
                          <TableCell>{expense.is_deductible ? "✓" : "-"}</TableCell>
                          <TableCell>
                            <Badge variant={expense.is_paid ? "default" : "destructive"}>
                              {expense.is_paid ? "Pagata" : "Da Pagare"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditExpense(expense)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedExpenseForDelete(expense);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Elimina Spesa</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare questa spesa? L'azione non può essere annullata.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteExpense} className="bg-destructive">
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default ExpensesManagement;
