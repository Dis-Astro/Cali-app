
-- Fase 1: Aggiungere stato scheda (attiva/in_pausa/conclusa)
-- Enum per lo stato della scheda
CREATE TYPE public.workout_plan_status AS ENUM ('attiva', 'in_pausa', 'conclusa');

-- Aggiungere colonne per gestione pausa
ALTER TABLE public.workout_plans
  ADD COLUMN status public.workout_plan_status NOT NULL DEFAULT 'attiva',
  ADD COLUMN paused_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN total_paused_days integer NOT NULL DEFAULT 0;

-- Migrare dati esistenti: is_active=false → conclusa
UPDATE public.workout_plans
SET status = 'conclusa'
WHERE is_active = false;
