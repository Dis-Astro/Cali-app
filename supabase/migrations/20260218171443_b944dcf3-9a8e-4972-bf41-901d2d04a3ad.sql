-- Aggiungo colonna exercise_name per supportare esercizi scritti liberamente
-- senza vincolo FK obbligatorio
ALTER TABLE public.workout_plan_exercises
ADD COLUMN IF NOT EXISTS exercise_name text;

-- Rendo exercise_id nullable per supportare esercizi custom (solo nome libero)
ALTER TABLE public.workout_plan_exercises
ALTER COLUMN exercise_id DROP NOT NULL;
