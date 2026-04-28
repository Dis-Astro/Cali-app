ALTER TABLE public.workout_plans
ADD COLUMN IF NOT EXISTS test_reminder_days INTEGER NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS reminder_appointment_id UUID;

COMMENT ON COLUMN public.workout_plans.test_reminder_days IS 'Giorni di preavviso prima della scadenza per ricordare di preparare il test (0 = disattivato)';
COMMENT ON COLUMN public.workout_plans.reminder_appointment_id IS 'ID dell''appuntamento "Prepara test" creato automaticamente sul calendario del coach';