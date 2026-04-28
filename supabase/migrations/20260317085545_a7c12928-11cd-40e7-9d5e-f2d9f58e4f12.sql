
-- Table for coach annotations on test exercises
CREATE TABLE public.coach_test_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_plan_exercise_id uuid NOT NULL REFERENCES public.workout_plan_exercises(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL,
  note text,
  rating integer CHECK (rating >= 0 AND rating <= 10),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (workout_plan_exercise_id, coach_id)
);

ALTER TABLE public.coach_test_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach test notes: staff può gestire"
ON public.coach_test_notes FOR ALL
TO authenticated
USING (is_staff(auth.uid()));

CREATE POLICY "Coach test notes: staff può vedere"
ON public.coach_test_notes FOR SELECT
TO authenticated
USING (is_staff(auth.uid()));
