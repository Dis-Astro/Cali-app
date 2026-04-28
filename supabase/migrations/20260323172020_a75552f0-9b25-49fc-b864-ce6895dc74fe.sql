-- Allow clients to see coach test notes for their own workout plan exercises
CREATE POLICY "Coach test notes: client can view own"
  ON public.coach_test_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_plan_exercises wpe
      JOIN public.workout_plans wp ON wp.id = wpe.workout_plan_id
      WHERE wpe.id = coach_test_notes.workout_plan_exercise_id
        AND wp.client_id = auth.uid()
    )
  );