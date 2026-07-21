-- Audio personalizzati per gli eventi del timer.
CREATE TABLE public.timer_audio_cues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'start',
    'halfway',
    'round_end',
    'last_round',
    'finish',
    'motivation'
  )),
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 30),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX timer_audio_cues_active_event_idx
  ON public.timer_audio_cues (event_type, is_active);

ALTER TABLE public.timer_audio_cues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Timer audio: utenti autenticati vedono gli audio attivi"
  ON public.timer_audio_cues
  FOR SELECT TO authenticated
  USING (is_active OR public.is_staff(auth.uid()));

CREATE POLICY "Timer audio: staff può inserire i propri audio"
  ON public.timer_audio_cues
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Timer audio: autore o admin può aggiornare"
  ON public.timer_audio_cues
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Timer audio: autore o admin può eliminare"
  ON public.timer_audio_cues
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER timer_audio_cues_updated_at
  BEFORE UPDATE ON public.timer_audio_cues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'timer-audio',
  'timer-audio',
  false,
  8388608,
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Timer audio storage: lettura autenticata"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'timer-audio');

CREATE POLICY "Timer audio storage: staff carica nella propria cartella"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'timer-audio'
    AND public.is_staff(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Timer audio storage: autore o admin elimina"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'timer-audio'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin(auth.uid())
    )
  );
