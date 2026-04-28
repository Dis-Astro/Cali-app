-- Fix difficulty rating range to match UI (1-10)
ALTER TABLE public.workout_completions
  DROP CONSTRAINT IF EXISTS workout_completions_difficulty_rating_check;

ALTER TABLE public.workout_completions
  ADD CONSTRAINT workout_completions_difficulty_rating_check
  CHECK (difficulty_rating IS NULL OR (difficulty_rating >= 1 AND difficulty_rating <= 10));
