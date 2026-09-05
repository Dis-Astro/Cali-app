-- Run ONLY in disposable local/staging database after migrations. Always rollback.
BEGIN;
INSERT INTO auth.users (id) VALUES
  ('f0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002');
INSERT INTO public.profiles (user_id, role, first_name, last_name) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'cliente_palestra', 'Test', 'Client'),
  ('f0000000-0000-4000-8000-000000000002', 'admin', 'Test', 'Admin');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
UPDATE public.profiles SET first_name = 'Allowed' WHERE user_id = auth.uid();
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND first_name = 'Allowed') THEN
    RAISE EXCEPTION 'Self-service profile edit failed';
  END IF;
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE user_id = auth.uid();
    RAISE EXCEPTION 'SECURITY FAILURE: self-promotion accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET id = gen_random_uuid() WHERE user_id = auth.uid();
    RAISE EXCEPTION 'SECURITY FAILURE: identity change accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
UPDATE public.profiles SET role = 'coach' WHERE user_id = 'f0000000-0000-4000-8000-000000000001';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = 'f0000000-0000-4000-8000-000000000001' AND role = 'coach') THEN
    RAISE EXCEPTION 'Admin role management failed';
  END IF;
END $$;
ROLLBACK;
