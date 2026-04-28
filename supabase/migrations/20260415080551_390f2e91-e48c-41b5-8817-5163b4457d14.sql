-- Allow staff (admin/coach) to update workout completions (e.g. correct client feedback)
CREATE POLICY "Completions: staff può aggiornare"
ON public.workout_completions
FOR UPDATE
USING (is_staff(auth.uid()));

-- Allow staff to delete workout completions if needed
CREATE POLICY "Completions: staff può eliminare"
ON public.workout_completions
FOR DELETE
USING (is_staff(auth.uid()));