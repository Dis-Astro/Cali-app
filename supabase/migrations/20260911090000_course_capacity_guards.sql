-- Additive guards for existing clients and staff: no API switch or data rewrite.
-- Validate on a restored staging database before production deployment.
CREATE OR REPLACE FUNCTION public.guard_course_booking_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.course_sessions%ROWTYPE;
  course_capacity integer;
  capacity integer;
  floating_capacity integer;
  total_used integer;
  fixed_used integer;
  floating_used integer;
  local_start timestamp;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id <> OLD.user_id OR NEW.course_session_id <> OLD.course_session_id THEN
      RAISE EXCEPTION 'Una prenotazione non può essere trasferita a un altro utente o turno';
    END IF;
    -- A status-only attendance correction does not allocate a new seat.
    IF NEW.status IN ('pending','confirmed','present') AND OLD.status IN ('pending','confirmed','present')
       AND NEW.booking_type = OLD.booking_type THEN
      NEW.updated_at := now();
      RETURN NEW;
    END IF;
  END IF;
  NEW.updated_at := now();
  IF NEW.status NOT IN ('pending','confirmed','present') THEN RETURN NEW; END IF;

  -- Same row lock as manage_course_booking: staff and client writes serialize.
  SELECT * INTO s FROM public.course_sessions WHERE id = NEW.course_session_id FOR UPDATE;
  IF NOT FOUND OR s.is_cancelled THEN RAISE EXCEPTION 'Turno non disponibile'; END IF;
  SELECT max_participants INTO course_capacity FROM public.courses WHERE id = s.course_id FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM public.course_participants WHERE course_id = s.course_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Atleta non iscritto al corso';
  END IF;
  local_start := s.start_time AT TIME ZONE 'Europe/Rome';
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text || date_trunc('week', local_start)::date::text || public.course_day_group(extract(isodow FROM local_start)::integer)::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.course_bookings b JOIN public.course_sessions other ON other.id = b.course_session_id
    WHERE b.user_id = NEW.user_id AND b.course_session_id <> s.id AND b.status IN ('pending','confirmed','present')
      AND date_trunc('week', other.start_time AT TIME ZONE 'Europe/Rome') = date_trunc('week', local_start)
      AND public.course_day_group(extract(isodow FROM other.start_time AT TIME ZONE 'Europe/Rome')::integer) = public.course_day_group(extract(isodow FROM local_start)::integer)
  ) THEN RAISE EXCEPTION 'Hai già una presenza nel gruppo di giorni selezionato'; END IF;
  IF NEW.booking_type = 'fixed' AND s.start_time > now() AND NOT EXISTS (
    SELECT 1 FROM public.course_fixed_assignments a WHERE a.course_id = s.course_id AND a.user_id = NEW.user_id AND a.is_active
      AND a.day_of_week = extract(isodow FROM local_start)::integer AND a.start_time = local_start::time
  ) THEN RAISE EXCEPTION 'Nessun posto fisso assegnato per questo turno'; END IF;
  capacity := coalesce(s.max_participants, course_capacity, 2147483647);
  floating_capacity := coalesce(s.floating_places, greatest(capacity - s.fixed_places, 0));
  SELECT count(*), count(*) FILTER (WHERE booking_type = 'fixed'), count(*) FILTER (WHERE booking_type <> 'fixed')
    INTO total_used, fixed_used, floating_used FROM public.course_bookings
    WHERE course_session_id = s.id AND user_id <> NEW.user_id AND status IN ('pending','confirmed','present');
  IF total_used >= capacity THEN RAISE EXCEPTION 'Turno completo'; END IF;
  IF NEW.booking_type = 'fixed' AND fixed_used >= s.fixed_places THEN RAISE EXCEPTION 'Posti fissi esauriti'; END IF;
  IF NEW.booking_type <> 'fixed' AND floating_used >= floating_capacity THEN RAISE EXCEPTION 'Posti occasionali esauriti'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_course_booking_capacity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_course_booking_capacity BEFORE INSERT OR UPDATE ON public.course_bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_course_booking_capacity();

-- Serialize fixed assignments with changes to their corresponding session capacity.
CREATE OR REPLACE FUNCTION public.validate_course_fixed_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  assigned_count integer;
  allowed_count integer;
  slot_day integer;
  slot_time time;
BEGIN
  IF TG_TABLE_NAME = 'course_fixed_assignments' THEN
    slot_day := NEW.day_of_week; slot_time := NEW.start_time;
  ELSE
    slot_day := extract(isodow FROM NEW.start_time AT TIME ZONE 'Europe/Rome')::integer;
    slot_time := (NEW.start_time AT TIME ZONE 'Europe/Rome')::time;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('fixed:' || NEW.course_id::text || ':' || slot_day::text || ':' || slot_time::text, 0));
  IF TG_TABLE_NAME = 'course_fixed_assignments' THEN
    SELECT count(*) INTO assigned_count FROM public.course_fixed_assignments a
      WHERE a.course_id = NEW.course_id AND a.day_of_week = slot_day AND a.start_time = slot_time AND a.is_active AND a.id <> NEW.id;
    SELECT min(s.fixed_places) INTO allowed_count FROM public.course_sessions s
      WHERE s.course_id = NEW.course_id AND NOT s.is_cancelled AND s.start_time > now()
        AND extract(isodow FROM s.start_time AT TIME ZONE 'Europe/Rome')::integer = slot_day AND (s.start_time AT TIME ZONE 'Europe/Rome')::time = slot_time;
    IF NEW.is_active AND allowed_count IS NOT NULL AND assigned_count + 1 > allowed_count THEN
      RAISE EXCEPTION 'I posti fissi disponibili per questo turno sono esauriti';
    END IF;
  ELSE
    SELECT count(*) INTO assigned_count FROM public.course_fixed_assignments a
      WHERE a.course_id = NEW.course_id AND a.day_of_week = slot_day AND a.start_time = slot_time AND a.is_active;
    IF NOT NEW.is_cancelled AND assigned_count > NEW.fixed_places THEN
      RAISE EXCEPTION 'Il turno ha meno posti fissi delle assegnazioni esistenti';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_course_fixed_capacity() FROM PUBLIC, anon, authenticated;
DROP TRIGGER validate_session_fixed_capacity ON public.course_sessions;
CREATE TRIGGER validate_session_fixed_capacity
BEFORE INSERT OR UPDATE OF course_id, start_time, fixed_places, is_cancelled ON public.course_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_course_fixed_capacity();

CREATE OR REPLACE FUNCTION public.guard_course_capacity_reduction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s record;
  capacity integer;
  total_used integer;
  fixed_used integer;
  floating_used integer;
BEGIN
  IF TG_TABLE_NAME = 'course_sessions' THEN
    SELECT max_participants INTO capacity FROM public.courses WHERE id = NEW.course_id FOR SHARE;
    capacity := coalesce(NEW.max_participants, capacity, 2147483647);
    SELECT count(*), count(*) FILTER (WHERE booking_type = 'fixed'), count(*) FILTER (WHERE booking_type <> 'fixed')
      INTO total_used, fixed_used, floating_used FROM public.course_bookings
      WHERE course_session_id = NEW.id AND status IN ('pending','confirmed','present');
    IF total_used > capacity OR fixed_used > NEW.fixed_places OR floating_used > coalesce(NEW.floating_places, greatest(capacity - NEW.fixed_places, 0))
       OR NEW.fixed_places + coalesce(NEW.floating_places, 0) > capacity THEN
      RAISE EXCEPTION 'La nuova capienza è inferiore ai posti già occupati';
    END IF;
  ELSE
    IF NEW.max_participants IS NULL THEN RETURN NEW; END IF;
    FOR s IN SELECT id, fixed_places, floating_places FROM public.course_sessions WHERE course_id = NEW.id AND max_participants IS NULL LOOP
      SELECT count(*), count(*) FILTER (WHERE booking_type <> 'fixed') INTO total_used, floating_used
        FROM public.course_bookings WHERE course_session_id = s.id AND status IN ('pending','confirmed','present');
      IF total_used > NEW.max_participants OR floating_used > coalesce(s.floating_places, greatest(NEW.max_participants - s.fixed_places, 0))
         OR s.fixed_places + coalesce(s.floating_places, 0) > NEW.max_participants THEN
        RAISE EXCEPTION 'La nuova capienza è inferiore ai posti già occupati';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_course_capacity_reduction() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_session_capacity_reduction BEFORE UPDATE OF max_participants, fixed_places, floating_places, course_id ON public.course_sessions
FOR EACH ROW EXECUTE FUNCTION public.guard_course_capacity_reduction();
CREATE TRIGGER guard_course_capacity_reduction BEFORE UPDATE OF max_participants ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.guard_course_capacity_reduction();
