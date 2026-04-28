
CREATE TYPE public.expense_category AS ENUM ('fissa', 'variabile');

CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category public.expense_category NOT NULL DEFAULT 'variabile',
  subcategory TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  provider TEXT,
  notes TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  is_deductible BOOLEAN NOT NULL DEFAULT true,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expenses: solo admin può gestire"
  ON public.expenses
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Expenses: nega accesso anonimo"
  ON public.expenses
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_expenses_date ON public.expenses(date DESC);
CREATE INDEX idx_expenses_category ON public.expenses(category);
