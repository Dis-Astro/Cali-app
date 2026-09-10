-- Run ONLY in disposable local/staging database after migrations. Always rollback.
-- With psql, use -v ON_ERROR_STOP=1 so an assertion failure fails the test run.
BEGIN;
INSERT INTO auth.users (id) VALUES
  ('f0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000003'),
  ('f0000000-0000-4000-8000-000000000004');
INSERT INTO public.profiles (user_id, role, first_name, last_name) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'cliente_palestra', 'Test', 'Client'),
  ('f0000000-0000-4000-8000-000000000002', 'admin', 'Test', 'Admin'),
  ('f0000000-0000-4000-8000-000000000003', 'coach', 'Test', 'Coach');

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.protect_profile_identity()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.protect_profile_identity()', 'EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY FAILURE: identity trigger function is publicly callable';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
UPDATE public.profiles SET first_name = 'Allowed' WHERE user_id = auth.uid();
DO $$
DECLARE
  target_role public.user_role;
  affected INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND first_name = 'Allowed') THEN
    RAISE EXCEPTION 'Self-service profile edit failed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id IN (
    'f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003'
  )) THEN
    RAISE EXCEPTION 'SECURITY FAILURE: client can read another profile';
  END IF;

  FOREACH target_role IN ARRAY ARRAY['admin', 'coach', 'segretaria']::public.user_role[] LOOP
    BEGIN
      UPDATE public.profiles SET role = target_role WHERE user_id = auth.uid();
      RAISE EXCEPTION 'SECURITY FAILURE: self-promotion to % accepted', target_role;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;

  BEGIN
    UPDATE public.profiles SET user_id = 'f0000000-0000-4000-8000-000000000004' WHERE user_id = auth.uid();
    RAISE EXCEPTION 'SECURITY FAILURE: account identity change accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET id = gen_random_uuid() WHERE user_id = auth.uid();
    RAISE EXCEPTION 'SECURITY FAILURE: identity change accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  UPDATE public.profiles SET first_name = 'Forbidden'
  WHERE user_id = 'f0000000-0000-4000-8000-000000000003';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: client changed another profile';
  END IF;

  DELETE FROM public.profiles WHERE user_id = auth.uid();
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: client deleted own profile';
  END IF;

  BEGIN
    INSERT INTO public.profiles (user_id, role, first_name, last_name)
    VALUES ('f0000000-0000-4000-8000-000000000004', 'admin', 'Forbidden', 'Admin');
    RAISE EXCEPTION 'SECURITY FAILURE: client created a privileged profile';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- A coach can view profiles, but must not gain admin privileges or change clients.
SELECT set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
DO $$
DECLARE
  affected INTEGER;
BEGIN
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE user_id = auth.uid();
    RAISE EXCEPTION 'SECURITY FAILURE: coach self-promotion accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.profiles SET first_name = 'Forbidden'
  WHERE user_id = 'f0000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: coach changed another profile';
  END IF;
END $$;

SELECT set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
UPDATE public.profiles SET role = 'coach' WHERE user_id = 'f0000000-0000-4000-8000-000000000001';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = 'f0000000-0000-4000-8000-000000000001' AND role = 'coach') THEN
    RAISE EXCEPTION 'Admin role management failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = 'f0000000-0000-4000-8000-000000000001' AND first_name = 'Allowed') THEN
    RAISE EXCEPTION 'SECURITY FAILURE: unauthorized profile mutation persisted';
  END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$
BEGIN
  BEGIN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id IN (
      'f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002'
    )) THEN
      RAISE EXCEPTION 'SECURITY FAILURE: anonymous profile read accepted';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
ROLLBACK;
