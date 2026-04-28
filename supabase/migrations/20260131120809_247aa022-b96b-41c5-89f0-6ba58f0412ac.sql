-- Add set_number to workout_completions for per-set feedback
ALTER TABLE public.workout_completions 
ADD COLUMN IF NOT EXISTS set_number integer NOT NULL DEFAULT 1;

-- Add unique constraint to prevent duplicate set entries
ALTER TABLE public.workout_completions
ADD CONSTRAINT unique_completion_per_set UNIQUE (workout_plan_exercise_id, client_id, set_number);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_workout_completions_set ON public.workout_completions(workout_plan_exercise_id, set_number);