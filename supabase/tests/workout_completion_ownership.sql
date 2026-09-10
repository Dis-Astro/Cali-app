-- Run ONLY in a disposable local/staging database after all migrations.
-- With psql, use -v ON_ERROR_STOP=1. Fixtures and every change are rolled back.
BEGIN;

INSERT INTO auth.users (id) VALUES
  ('f1000000-0000-4000-8000-000000000001'),
  ('f1000000-0000-4000-8000-000000000002'),
  ('f1000000-0000-4000-8000-000000000003'),
  ('f1000000-0000-4000-8000-000000000004');
INSERT INTO public.profiles (user_id, role, first_name, last_name) VALUES
  ('f1000000-0000-4000-8000-000000000001', 'cliente_coaching', 'Test', 'Client A'),
  ('f1000000-0000-4000-8000-000000000002', 'cliente_coaching', 'Test', 'Client B'),
  ('f1000000-0000-4000-8000-000000000003', 'coach', 'Test', 'Coach'),
  ('f1000000-0000-4000-8000-000000000004', 'admin', 'Test', 'Admin');

INSERT INTO public.workout_plans (id, client_id, coach_id, name, start_date, end_date, is_active, status) VALUES
  ('f1000000-0000-4000-8000-000000000011', 'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000003', 'Past client A plan', CURRENT_DATE - 60, CURRENT_DATE - 30, false, 'conclusa'),
  ('f1000000-0000-4000-8000-000000000012', 'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003', 'Client B plan', CURRENT_DATE, CURRENT_DATE + 30, true, 'attiva');
INSERT INTO public.workout_plan_exercises (id, workout_plan_id, exercise_name) VALUES
  ('f1000000-0000-4000-8000-000000000021', 'f1000000-0000-4000-8000-000000000011', 'Test exercise A'),
  ('f1000000-0000-4000-8000-000000000022', 'f1000000-0000-4000-8000-000000000012', 'Test exercise B');

-- Existing mismatched records must not disappear after tightening client writes.
-- Only the fixture/setup connection creates this deliberate legacy inconsistency.
INSERT INTO public.workout_completions (id, workout_plan_exercise_id, client_id, set_number, client_notes) VALUES
  ('f1000000-0000-4000-8000-000000000031', 'f1000000-0000-4000-8000-000000000022', 'f1000000-0000-4000-8000-000000000001', 1, 'Legacy mismatch'),
  ('f1000000-0000-4000-8000-000000000032', 'f1000000-0000-4000-8000-000000000022', 'f1000000-0000-4000-8000-000000000002', 1, 'Client B note');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- Positive path: delayed feedback and replay/upsert for a completed historical plan.
INSERT INTO public.workout_completions (id, workout_plan_exercise_id, client_id, set_number, client_notes) VALUES
  ('f1000000-0000-4000-8000-000000000033', 'f1000000-0000-4000-8000-000000000021', auth.uid(), 2, 'Delayed feedback');
INSERT INTO public.workout_completions (workout_plan_exercise_id, client_id, set_number, client_notes)
VALUES ('f1000000-0000-4000-8000-000000000021', auth.uid(), 2, 'Replayed feedback')
ON CONFLICT (workout_plan_exercise_id, client_id, set_number)
DO UPDATE SET client_notes = excluded.client_notes;

DO $$
DECLARE
  affected INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workout_completions WHERE id = 'f1000000-0000-4000-8000-000000000033' AND client_notes = 'Replayed feedback') THEN
    RAISE EXCEPTION 'Own historical feedback/replay failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workout_completions WHERE id = 'f1000000-0000-4000-8000-000000000031' AND client_notes = 'Legacy mismatch') THEN
    RAISE EXCEPTION 'Existing legacy feedback is no longer readable';
  END IF;
  IF EXISTS (SELECT 1 FROM public.workout_completions WHERE id = 'f1000000-0000-4000-8000-000000000032') THEN
    RAISE EXCEPTION 'SECURITY FAILURE: client read another client feedback';
  END IF;

  BEGIN
    INSERT INTO public.workout_completions (workout_plan_exercise_id, client_id, set_number)
    VALUES ('f1000000-0000-4000-8000-000000000022', auth.uid(), 99);
    RAISE EXCEPTION 'SECURITY FAILURE: feedback on foreign exercise accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.workout_completions (workout_plan_exercise_id, client_id, set_number)
    VALUES ('f1000000-0000-4000-8000-000000000022', 'f1000000-0000-4000-8000-000000000002', 99);
    RAISE EXCEPTION 'SECURITY FAILURE: feedback for another client accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.workout_completions
    SET workout_plan_exercise_id = 'f1000000-0000-4000-8000-000000000022'
    WHERE id = 'f1000000-0000-4000-8000-000000000033';
    RAISE EXCEPTION 'SECURITY FAILURE: feedback retargeted to a foreign exercise';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.workout_completions
    SET client_id = 'f1000000-0000-4000-8000-000000000002'
    WHERE id = 'f1000000-0000-4000-8000-000000000033';
    RAISE EXCEPTION 'SECURITY FAILURE: feedback reassigned to another client';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.workout_completions SET client_notes = 'Forbidden legacy write'
    WHERE id = 'f1000000-0000-4000-8000-000000000031';
    RAISE EXCEPTION 'SECURITY FAILURE: invalid legacy relationship accepted on write';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  UPDATE public.workout_completions SET client_notes = 'Forbidden cross-client write'
  WHERE id = 'f1000000-0000-4000-8000-000000000032';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: client changed another client feedback';
  END IF;
END $$;

-- Existing staff correction permissions are preserved, including legacy records.
SELECT set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
UPDATE public.workout_completions SET client_notes = 'Coach corrected'
WHERE id IN ('f1000000-0000-4000-8000-000000000031', 'f1000000-0000-4000-8000-000000000032');
DO $$
BEGIN
  IF (SELECT count(*) FROM public.workout_completions WHERE id IN (
    'f1000000-0000-4000-8000-000000000031', 'f1000000-0000-4000-8000-000000000032'
  ) AND client_notes = 'Coach corrected') <> 2 THEN
    RAISE EXCEPTION 'Existing coach feedback correction failed';
  END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
UPDATE public.workout_completions SET client_notes = 'Admin corrected'
WHERE id = 'f1000000-0000-4000-8000-000000000031';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workout_completions WHERE id = 'f1000000-0000-4000-8000-000000000031' AND client_notes = 'Admin corrected') THEN
    RAISE EXCEPTION 'Existing admin feedback correction failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workout_completions WHERE id = 'f1000000-0000-4000-8000-000000000033'
    AND client_id = 'f1000000-0000-4000-8000-000000000001'
    AND workout_plan_exercise_id = 'f1000000-0000-4000-8000-000000000021'
    AND client_notes = 'Replayed feedback') THEN
    RAISE EXCEPTION 'SECURITY FAILURE: rejected feedback mutation persisted';
  END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$
BEGIN
  BEGIN
    IF EXISTS (SELECT 1 FROM public.workout_completions WHERE id = 'f1000000-0000-4000-8000-000000000033') THEN
      RAISE EXCEPTION 'SECURITY FAILURE: anonymous feedback read accepted';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.workout_completions (workout_plan_exercise_id, client_id, set_number)
    VALUES ('f1000000-0000-4000-8000-000000000021', 'f1000000-0000-4000-8000-000000000001', 99);
    RAISE EXCEPTION 'SECURITY FAILURE: anonymous feedback write accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

ROLLBACK;
