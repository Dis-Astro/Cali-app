-- Restrict client feedback to exercises belonging to that client's plan.
-- Keep historical/paused/completed plans eligible for delayed and offline notes.
-- Existing rows and staff SELECT/UPDATE/DELETE policies are intentionally unchanged.
ALTER POLICY "Completions: cliente può inserire propri"
ON public.workout_completions
WITH CHECK (
  auth.uid() = client_id
  AND EXISTS (
    SELECT 1
    FROM public.workout_plan_exercises plan_exercise
    JOIN public.workout_plans plan ON plan.id = plan_exercise.workout_plan_id
    WHERE plan_exercise.id = workout_completions.workout_plan_exercise_id
      AND plan.client_id = auth.uid()
  )
);

ALTER POLICY "Completions: cliente può aggiornare propri"
ON public.workout_completions
USING (auth.uid() = client_id)
WITH CHECK (
  auth.uid() = client_id
  AND EXISTS (
    SELECT 1
    FROM public.workout_plan_exercises plan_exercise
    JOIN public.workout_plans plan ON plan.id = plan_exercise.workout_plan_id
    WHERE plan_exercise.id = workout_completions.workout_plan_exercise_id
      AND plan.client_id = auth.uid()
  )
);
