
ALTER TABLE public.workout_plans 
ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'workout_plan',
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.workout_plans.plan_type IS 'Type: workout_plan or test';
COMMENT ON COLUMN public.workout_plans.deleted_at IS 'Soft delete timestamp, NULL = not deleted';
