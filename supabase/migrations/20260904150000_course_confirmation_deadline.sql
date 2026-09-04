-- Conferme corso: risposta esplicita e chiusura automatica 6 ore prima del turno.
ALTER TABLE public.course_sessions
  ADD COLUMN IF NOT EXISTS confirmation_deadline_hours SMALLINT NOT NULL DEFAULT 6
  CHECK (confirmation_deadline_hours BETWEEN 1 AND 72);

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

  local_start := target_session.start_time AT TIME ZONE 'Europe/Rome';
  local_day := extract(isodow FROM local_start)::INTEGER;
  week_start := date_trunc('week', local_start)::DATE;
  day_group := public.course_day_group(local_day);

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

  IF target_session.start_time - make_interval(hours => target_session.confirmation_deadline_hours) <= now() THEN
    RAISE EXCEPTION 'Le conferme chiudono % ore prima del turno', target_session.confirmation_deadline_hours;
  END IF;

  IF p_action = 'cancel' THEN
    INSERT INTO public.course_bookings (course_session_id, user_id, booking_type, status)
    VALUES (p_session_id, current_user_id, resolved_type, 'cancelled')
    ON CONFLICT (course_session_id, user_id) DO UPDATE
    SET booking_type = excluded.booking_type, status = 'cancelled', updated_at = now();
    RETURN jsonb_build_object('ok', true, 'status', 'cancelled', 'booking_type', resolved_type);
  END IF;

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
  IF resolved_type <> 'fixed' AND active_kind >= floating_capacity THEN RAISE EXCEPTION 'Posti occasionali esauriti'; END IF;

  INSERT INTO public.course_bookings (course_session_id, user_id, booking_type, status)
  VALUES (p_session_id, current_user_id, resolved_type, 'confirmed')
  ON CONFLICT (course_session_id, user_id) DO UPDATE
  SET booking_type = excluded.booking_type, status = 'confirmed', updated_at = now();

  RETURN jsonb_build_object('ok', true, 'status', 'confirmed', 'booking_type', resolved_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.manage_course_booking(UUID, TEXT) TO authenticated;
