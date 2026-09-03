-- Motore prenotazioni Corso Base: capienza per turno, posti fissi/vaganti,
-- conferme e vincolo massimo di una presenza per ciascun gruppo Lun-Mar / Mer-Gio.

ALTER TABLE public.course_sessions
  ADD COLUMN IF NOT EXISTS max_participants INTEGER,
  ADD COLUMN IF NOT EXISTS fixed_places INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS floating_places INTEGER;

UPDATE public.course_sessions session
SET max_participants = course.max_participants,
    floating_places = course.max_participants
FROM public.courses course
WHERE session.course_id = course.id
  AND session.max_participants IS NULL;

ALTER TABLE public.course_sessions
  ADD CONSTRAINT course_sessions_capacity_positive
    CHECK (max_participants IS NULL OR max_participants > 0),
  ADD CONSTRAINT course_sessions_places_non_negative
    CHECK (fixed_places >= 0 AND (floating_places IS NULL OR floating_places >= 0)),
  ADD CONSTRAINT course_sessions_places_within_capacity
    CHECK (max_participants IS NULL OR fixed_places + COALESCE(floating_places, 0) <= max_participants);

CREATE TABLE IF NOT EXISTS public.course_fixed_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id, day_of_week, start_time)
);

CREATE TABLE IF NOT EXISTS public.course_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_session_id UUID NOT NULL REFERENCES public.course_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_type TEXT NOT NULL CHECK (booking_type IN ('fixed', 'floating', 'switch')),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'present', 'absent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_sessions_course_start ON public.course_sessions(course_id, start_time);
CREATE INDEX IF NOT EXISTS idx_course_fixed_assignments_user ON public.course_fixed_assignments(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_course_bookings_session_status ON public.course_bookings(course_session_id, status);
CREATE INDEX IF NOT EXISTS idx_course_bookings_user ON public.course_bookings(user_id);

CREATE OR REPLACE FUNCTION public.validate_course_fixed_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  assigned_count INTEGER;
  allowed_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'course_fixed_assignments' THEN
    SELECT count(*) INTO assigned_count
    FROM public.course_fixed_assignments assignment
    WHERE assignment.course_id = NEW.course_id
      AND assignment.day_of_week = NEW.day_of_week
      AND assignment.start_time = NEW.start_time
      AND assignment.is_active
      AND assignment.id <> NEW.id;

    SELECT min(session.fixed_places) INTO allowed_count
    FROM public.course_sessions session
    WHERE session.course_id = NEW.course_id
      AND NOT session.is_cancelled
      AND session.start_time > now()
      AND extract(isodow FROM session.start_time AT TIME ZONE 'Europe/Rome')::INTEGER = NEW.day_of_week
      AND (session.start_time AT TIME ZONE 'Europe/Rome')::TIME = NEW.start_time;

    IF NEW.is_active AND allowed_count IS NOT NULL AND assigned_count + 1 > allowed_count THEN
      RAISE EXCEPTION 'I posti fissi disponibili per questo turno sono esauriti';
    END IF;
  ELSE
    SELECT count(*) INTO assigned_count
    FROM public.course_fixed_assignments assignment
    WHERE assignment.course_id = NEW.course_id
      AND assignment.is_active
      AND assignment.day_of_week = extract(isodow FROM NEW.start_time AT TIME ZONE 'Europe/Rome')::INTEGER
      AND assignment.start_time = (NEW.start_time AT TIME ZONE 'Europe/Rome')::TIME;
    IF assigned_count > NEW.fixed_places THEN
      RAISE EXCEPTION 'Il turno ha meno posti fissi delle assegnazioni esistenti';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_fixed_assignment_capacity
BEFORE INSERT OR UPDATE ON public.course_fixed_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_course_fixed_capacity();

CREATE TRIGGER validate_session_fixed_capacity
BEFORE INSERT OR UPDATE OF course_id, start_time, fixed_places ON public.course_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_course_fixed_capacity();

ALTER TABLE public.course_fixed_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fixed assignments: own or staff"
ON public.course_fixed_assignments FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "Fixed assignments: staff manages"
ON public.course_fixed_assignments FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Course bookings: own or staff"
ON public.course_bookings FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "Course bookings: staff manages"
ON public.course_bookings FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.course_day_group(local_day INTEGER)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN local_day IN (1, 2) THEN 1
    WHEN local_day IN (3, 4) THEN 2
    ELSE local_day + 10
  END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS unique_fixed_assignment_per_group
ON public.course_fixed_assignments(course_id, user_id, public.course_day_group(day_of_week))
WHERE is_active;

CREATE OR REPLACE FUNCTION public.manage_course_booking(p_session_id UUID, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  target_session public.course_sessions%ROWTYPE;
  target_course public.courses%ROWTYPE;
  local_start TIMESTAMP;
  local_day INTEGER;
  week_start DATE;
  day_group INTEGER;
  total_capacity INTEGER;
  fixed_capacity INTEGER;
  floating_capacity INTEGER;
  active_total INTEGER;
  active_kind INTEGER;
  is_fixed_slot BOOLEAN;
  has_fixed_group BOOLEAN;
  resolved_type TEXT;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'Autenticazione richiesta'; END IF;
  IF p_action NOT IN ('confirm', 'cancel') THEN RAISE EXCEPTION 'Azione non valida'; END IF;

  SELECT * INTO target_session FROM public.course_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR target_session.is_cancelled THEN RAISE EXCEPTION 'Turno non disponibile'; END IF;

  SELECT * INTO target_course FROM public.courses WHERE id = target_session.course_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Corso non disponibile'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.course_participants
    WHERE course_id = target_session.course_id AND user_id = current_user_id
  ) THEN RAISE EXCEPTION 'Non sei iscritto a questo corso'; END IF;

  IF p_action = 'cancel' THEN
    UPDATE public.course_bookings
    SET status = 'cancelled', updated_at = now()
    WHERE course_session_id = p_session_id AND user_id = current_user_id;
    RETURN jsonb_build_object('ok', true, 'status', 'cancelled');
  END IF;

  IF target_session.start_time <= now() THEN RAISE EXCEPTION 'Il turno è già iniziato'; END IF;

  local_start := target_session.start_time AT TIME ZONE 'Europe/Rome';
  local_day := extract(isodow FROM local_start)::INTEGER;
  week_start := date_trunc('week', local_start)::DATE;
  day_group := public.course_day_group(local_day);

  -- Serializza le prenotazioni dello stesso atleta/gruppo/settimana, anche su turni diversi.
  PERFORM pg_advisory_xact_lock(hashtextextended(current_user_id::TEXT || week_start::TEXT || day_group::TEXT, 0));

  IF EXISTS (
    SELECT 1
    FROM public.course_bookings booking
    JOIN public.course_sessions session ON session.id = booking.course_session_id
    WHERE booking.user_id = current_user_id
      AND booking.status IN ('pending', 'confirmed', 'present')
      AND booking.course_session_id <> p_session_id
      AND date_trunc('week', session.start_time AT TIME ZONE 'Europe/Rome')::DATE = week_start
      AND public.course_day_group(extract(isodow FROM session.start_time AT TIME ZONE 'Europe/Rome')::INTEGER) = day_group
  ) THEN RAISE EXCEPTION 'Hai già una presenza nel gruppo di giorni selezionato'; END IF;

  is_fixed_slot := EXISTS (
    SELECT 1 FROM public.course_fixed_assignments assignment
    WHERE assignment.course_id = target_session.course_id
      AND assignment.user_id = current_user_id
      AND assignment.is_active
      AND assignment.day_of_week = local_day
      AND assignment.start_time = local_start::TIME
  );

  has_fixed_group := EXISTS (
    SELECT 1 FROM public.course_fixed_assignments assignment
    WHERE assignment.course_id = target_session.course_id
      AND assignment.user_id = current_user_id
      AND assignment.is_active
      AND public.course_day_group(assignment.day_of_week) = day_group
  );

  resolved_type := CASE WHEN is_fixed_slot THEN 'fixed' WHEN has_fixed_group THEN 'switch' ELSE 'floating' END;
  total_capacity := COALESCE(target_session.max_participants, target_course.max_participants, 2147483647);
  fixed_capacity := target_session.fixed_places;
  floating_capacity := COALESCE(target_session.floating_places, GREATEST(total_capacity - fixed_capacity, 0));

  SELECT count(*) INTO active_total FROM public.course_bookings
  WHERE course_session_id = p_session_id AND status IN ('pending', 'confirmed', 'present') AND user_id <> current_user_id;
  IF active_total >= total_capacity THEN RAISE EXCEPTION 'Turno completo'; END IF;

  SELECT count(*) INTO active_kind FROM public.course_bookings
  WHERE course_session_id = p_session_id
    AND status IN ('pending', 'confirmed', 'present')
    AND user_id <> current_user_id
    AND CASE WHEN resolved_type = 'fixed' THEN booking_type = 'fixed' ELSE booking_type IN ('floating', 'switch') END;

  IF resolved_type = 'fixed' AND active_kind >= fixed_capacity THEN RAISE EXCEPTION 'Posti fissi esauriti'; END IF;
  IF resolved_type <> 'fixed' AND active_kind >= floating_capacity THEN RAISE EXCEPTION 'Posti vaganti esauriti'; END IF;

  INSERT INTO public.course_bookings (course_session_id, user_id, booking_type, status)
  VALUES (p_session_id, current_user_id, resolved_type, 'confirmed')
  ON CONFLICT (course_session_id, user_id) DO UPDATE
  SET booking_type = excluded.booking_type, status = 'confirmed', updated_at = now();

  RETURN jsonb_build_object('ok', true, 'status', 'confirmed', 'booking_type', resolved_type);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_course_session_availability(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE (session_id UUID, booked BIGINT, fixed_booked BIGINT, floating_booked BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT session.id,
    count(booking.id) FILTER (WHERE booking.status IN ('pending', 'confirmed', 'present')),
    count(booking.id) FILTER (WHERE booking.status IN ('pending', 'confirmed', 'present') AND booking.booking_type = 'fixed'),
    count(booking.id) FILTER (WHERE booking.status IN ('pending', 'confirmed', 'present') AND booking.booking_type IN ('floating', 'switch'))
  FROM public.course_sessions session
  LEFT JOIN public.course_bookings booking ON booking.course_session_id = session.id
  WHERE session.start_time >= p_from AND session.start_time <= p_to
  GROUP BY session.id;
$$;

GRANT EXECUTE ON FUNCTION public.manage_course_booking(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_course_session_availability(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.course_bookings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.course_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
