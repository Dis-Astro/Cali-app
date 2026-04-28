-- Pulizia: rimuove l'associazione cliente dagli appuntamenti reminder già creati
-- (i reminder "Prepara test" devono essere visibili solo al coach, non al cliente).
UPDATE public.appointments a
SET client_id = NULL
WHERE a.id IN (
  SELECT wp.reminder_appointment_id
  FROM public.workout_plans wp
  WHERE wp.reminder_appointment_id IS NOT NULL
)
AND a.title LIKE '🧪 Prepara test%';