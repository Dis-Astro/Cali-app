
-- Lesson packages table for tracking private lesson credits
CREATE TABLE public.lesson_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  total_lessons INTEGER NOT NULL,
  remaining_lessons INTEGER NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.lesson_packages ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Packages: admin può gestire" ON public.lesson_packages
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Packages: staff e proprietario possono vedere" ON public.lesson_packages
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id 
    OR public.is_staff(auth.uid())
  );

-- Lesson usage log for tracking each deduction
CREATE TABLE public.lesson_usage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.lesson_packages(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID
);

ALTER TABLE public.lesson_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usage log: admin può gestire" ON public.lesson_usage_log
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Usage log: staff e proprietario possono vedere" ON public.lesson_usage_log
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.lesson_packages lp 
      WHERE lp.id = lesson_usage_log.package_id 
      AND lp.user_id = auth.uid()
    )
  );
