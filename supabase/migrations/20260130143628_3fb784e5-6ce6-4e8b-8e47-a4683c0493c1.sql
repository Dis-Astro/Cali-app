-- =============================================
-- POWER GYM - SISTEMA GESTIONALE COMPLETO
-- =============================================

-- 1. ENUM per i ruoli
CREATE TYPE public.user_role AS ENUM ('admin', 'coach', 'cliente_palestra', 'cliente_coaching');

-- 2. ENUM per stato abbonamento
CREATE TYPE public.subscription_status AS ENUM ('attivo', 'scaduto', 'sospeso', 'cancellato');

-- 3. ENUM per stato pagamento
CREATE TYPE public.payment_status AS ENUM ('completato', 'in_attesa', 'fallito', 'rimborsato');

-- 4. ENUM per stato segnalazione errore
CREATE TYPE public.error_report_status AS ENUM ('aperta', 'in_lavorazione', 'risolta', 'chiusa');

-- =============================================
-- TABELLE BASE
-- =============================================

-- Profili utente (collegati a auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'cliente_palestra',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    date_of_birth DATE,
    address TEXT,
    fiscal_code TEXT,
    emergency_contact TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Piani di abbonamento disponibili
CREATE TABLE public.membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration_months INTEGER NOT NULL DEFAULT 1,
    plan_type user_role NOT NULL DEFAULT 'cliente_palestra',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assegnazione coach-cliente
CREATE TABLE public.coach_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_primary BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(coach_id, client_id)
);

-- Abbonamenti utenti
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    plan_id UUID REFERENCES public.membership_plans(id) NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL,
    status subscription_status NOT NULL DEFAULT 'attivo',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pagamenti
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    method TEXT NOT NULL DEFAULT 'contanti',
    status payment_status NOT NULL DEFAULT 'completato',
    receipt_number TEXT,
    notes TEXT,
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- SCHEDE E ESERCIZI
-- =============================================

-- Libreria esercizi
CREATE TABLE public.exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    muscle_group TEXT,
    difficulty TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Video degli esercizi (upload dal coach)
CREATE TABLE public.exercise_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
    coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Schede allenamento
CREATE TABLE public.workout_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    coach_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Esercizi nella scheda
CREATE TABLE public.workout_plan_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_plan_id UUID REFERENCES public.workout_plans(id) ON DELETE CASCADE NOT NULL,
    exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
    video_id UUID REFERENCES public.exercise_videos(id),
    day_of_week INTEGER, -- 1-7 per i giorni
    order_index INTEGER NOT NULL DEFAULT 0,
    sets INTEGER,
    reps TEXT, -- "8-12" o "max" ecc.
    rest_seconds INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tracking esercizi completati dal cliente
CREATE TABLE public.workout_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_plan_exercise_id UUID REFERENCES public.workout_plan_exercises(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actual_sets INTEGER,
    actual_reps TEXT,
    weight_used TEXT,
    client_notes TEXT,
    difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5)
);

-- =============================================
-- CALENDARIO E APPUNTAMENTI
-- =============================================

-- Appuntamenti/eventi calendario
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    recurrence_rule TEXT,
    location TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Corsi di gruppo
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    coach_id UUID REFERENCES auth.users(id),
    max_participants INTEGER,
    schedule TEXT, -- es: "Lun-Mer-Ven 18:00"
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT true,
    color TEXT DEFAULT '#10B981',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partecipanti ai corsi
CREATE TABLE public.course_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(course_id, user_id)
);

-- Sessioni specifiche dei corsi (per il calendario)
CREATE TABLE public.course_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_cancelled BOOLEAN NOT NULL DEFAULT false,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- DOCUMENTI E NOTE
-- =============================================

-- Documenti del cliente
CREATE TABLE public.client_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Note libere del cliente
CREATE TABLE public.client_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Segnalazioni errori dal cliente al coach
CREATE TABLE public.error_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    workout_plan_id UUID REFERENCES public.workout_plans(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES public.exercises(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status error_report_status NOT NULL DEFAULT 'aperta',
    coach_response TEXT,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- =============================================
-- NOTIFICHE IN-APP
-- =============================================

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info', -- info, warning, success, error
    is_read BOOLEAN NOT NULL DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- ORARI PALESTRA
-- =============================================

CREATE TABLE public.gym_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    note TEXT
);

-- =============================================
-- FUNZIONI HELPER PER RLS
-- =============================================

-- Ottieni ruolo utente
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE user_id = user_uuid LIMIT 1;
$$;

-- Verifica se è admin
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = user_uuid AND role = 'admin'
    );
$$;

-- Verifica se è coach
CREATE OR REPLACE FUNCTION public.is_coach(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = user_uuid AND role = 'coach'
    );
$$;

-- Verifica se è admin o coach
CREATE OR REPLACE FUNCTION public.is_staff(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = user_uuid AND role IN ('admin', 'coach')
    );
$$;

-- Verifica se il coach gestisce questo cliente
CREATE OR REPLACE FUNCTION public.coach_manages_client(coach_uuid UUID, client_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.coach_assignments 
        WHERE coach_id = coach_uuid AND client_id = client_uuid
    );
$$;

-- Verifica se l'utente può vedere i dati di un cliente
CREATE OR REPLACE FUNCTION public.can_view_client_data(viewer_uuid UUID, client_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        viewer_uuid = client_uuid -- è il proprio dato
        OR public.is_admin(viewer_uuid) -- è admin
        OR public.coach_manages_client(viewer_uuid, client_uuid); -- è il suo coach
$$;

-- =============================================
-- ABILITA RLS SU TUTTE LE TABELLE
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_plan_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_hours ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- PROFILES
CREATE POLICY "Profiles: chiunque autenticato può vedere" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id 
        OR public.is_admin(auth.uid()) 
        OR public.coach_manages_client(auth.uid(), user_id)
        OR public.is_staff(auth.uid()) -- staff può vedere tutti i profili
    );

CREATE POLICY "Profiles: admin può inserire" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Profiles: admin o proprietario può aggiornare" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Profiles: solo admin può eliminare" ON public.profiles
    FOR DELETE TO authenticated
    USING (public.is_admin(auth.uid()));

-- MEMBERSHIP PLANS
CREATE POLICY "Plans: tutti possono vedere piani attivi" ON public.membership_plans
    FOR SELECT TO authenticated
    USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Plans: solo admin può gestire" ON public.membership_plans
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()));

-- COACH ASSIGNMENTS
CREATE POLICY "Assignments: staff e coinvolti possono vedere" ON public.coach_assignments
    FOR SELECT TO authenticated
    USING (
        public.is_staff(auth.uid()) 
        OR auth.uid() = coach_id 
        OR auth.uid() = client_id
    );

CREATE POLICY "Assignments: solo admin può gestire" ON public.coach_assignments
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()));

-- SUBSCRIPTIONS
CREATE POLICY "Subscriptions: visualizza propri o gestiti" ON public.subscriptions
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id 
        OR public.is_admin(auth.uid())
        OR public.coach_manages_client(auth.uid(), user_id)
    );

CREATE POLICY "Subscriptions: admin può gestire tutti" ON public.subscriptions
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()));

-- PAYMENTS
CREATE POLICY "Payments: visualizza propri o gestiti" ON public.payments
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id 
        OR public.is_admin(auth.uid())
    );

CREATE POLICY "Payments: admin può gestire" ON public.payments
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()));

-- EXERCISES
CREATE POLICY "Exercises: tutti possono vedere" ON public.exercises
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Exercises: staff può gestire" ON public.exercises
    FOR ALL TO authenticated
    USING (public.is_staff(auth.uid()));

-- EXERCISE VIDEOS
CREATE POLICY "Videos: tutti possono vedere" ON public.exercise_videos
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Videos: coach può gestire propri" ON public.exercise_videos
    FOR INSERT TO authenticated
    WITH CHECK (public.is_coach(auth.uid()) AND coach_id = auth.uid());

CREATE POLICY "Videos: coach può aggiornare propri" ON public.exercise_videos
    FOR UPDATE TO authenticated
    USING (coach_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Videos: coach può eliminare propri" ON public.exercise_videos
    FOR DELETE TO authenticated
    USING (coach_id = auth.uid() OR public.is_admin(auth.uid()));

-- WORKOUT PLANS
CREATE POLICY "Workouts: visualizza propri o gestiti" ON public.workout_plans
    FOR SELECT TO authenticated
    USING (
        auth.uid() = client_id 
        OR auth.uid() = coach_id
        OR public.is_admin(auth.uid())
    );

CREATE POLICY "Workouts: coach/admin può creare" ON public.workout_plans
    FOR INSERT TO authenticated
    WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Workouts: coach proprietario o admin può modificare" ON public.workout_plans
    FOR UPDATE TO authenticated
    USING (auth.uid() = coach_id OR public.is_admin(auth.uid()));

CREATE POLICY "Workouts: coach proprietario o admin può eliminare" ON public.workout_plans
    FOR DELETE TO authenticated
    USING (auth.uid() = coach_id OR public.is_admin(auth.uid()));

-- WORKOUT PLAN EXERCISES
CREATE POLICY "Plan exercises: visibili se scheda visibile" ON public.workout_plan_exercises
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workout_plans wp 
            WHERE wp.id = workout_plan_id 
            AND (wp.client_id = auth.uid() OR wp.coach_id = auth.uid() OR public.is_admin(auth.uid()))
        )
    );

CREATE POLICY "Plan exercises: staff può gestire" ON public.workout_plan_exercises
    FOR ALL TO authenticated
    USING (public.is_staff(auth.uid()));

-- WORKOUT COMPLETIONS
CREATE POLICY "Completions: cliente può vedere propri" ON public.workout_completions
    FOR SELECT TO authenticated
    USING (
        auth.uid() = client_id 
        OR public.is_staff(auth.uid())
    );

CREATE POLICY "Completions: cliente può inserire propri" ON public.workout_completions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Completions: cliente può aggiornare propri" ON public.workout_completions
    FOR UPDATE TO authenticated
    USING (auth.uid() = client_id);

-- APPOINTMENTS
CREATE POLICY "Appointments: visualizza propri" ON public.appointments
    FOR SELECT TO authenticated
    USING (
        auth.uid() = coach_id 
        OR auth.uid() = client_id
        OR public.is_admin(auth.uid())
    );

CREATE POLICY "Appointments: coach/admin può creare" ON public.appointments
    FOR INSERT TO authenticated
    WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Appointments: coach proprietario può modificare" ON public.appointments
    FOR UPDATE TO authenticated
    USING (auth.uid() = coach_id OR public.is_admin(auth.uid()));

CREATE POLICY "Appointments: coach proprietario può eliminare" ON public.appointments
    FOR DELETE TO authenticated
    USING (auth.uid() = coach_id OR public.is_admin(auth.uid()));

-- COURSES
CREATE POLICY "Courses: tutti possono vedere attivi" ON public.courses
    FOR SELECT TO authenticated
    USING (is_active = true OR public.is_staff(auth.uid()));

CREATE POLICY "Courses: staff può gestire" ON public.courses
    FOR ALL TO authenticated
    USING (public.is_staff(auth.uid()));

-- COURSE PARTICIPANTS
CREATE POLICY "Participants: visualizza propri o se staff" ON public.course_participants
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id 
        OR public.is_staff(auth.uid())
    );

CREATE POLICY "Participants: staff può gestire" ON public.course_participants
    FOR ALL TO authenticated
    USING (public.is_staff(auth.uid()));

-- COURSE SESSIONS
CREATE POLICY "Sessions: tutti possono vedere" ON public.course_sessions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sessions: staff può gestire" ON public.course_sessions
    FOR ALL TO authenticated
    USING (public.is_staff(auth.uid()));

-- CLIENT DOCUMENTS
CREATE POLICY "Documents: visualizza propri o gestiti" ON public.client_documents
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id 
        OR public.is_admin(auth.uid())
        OR public.coach_manages_client(auth.uid(), user_id)
    );

CREATE POLICY "Documents: staff può inserire" ON public.client_documents
    FOR INSERT TO authenticated
    WITH CHECK (public.is_staff(auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "Documents: proprietario o admin può eliminare" ON public.client_documents
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- CLIENT NOTES
CREATE POLICY "Notes: solo proprietario può vedere" ON public.client_notes
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Notes: proprietario può gestire" ON public.client_notes
    FOR ALL TO authenticated
    USING (auth.uid() = user_id);

-- ERROR REPORTS
CREATE POLICY "Errors: cliente e coach coinvolto possono vedere" ON public.error_reports
    FOR SELECT TO authenticated
    USING (
        auth.uid() = client_id 
        OR auth.uid() = coach_id
        OR public.is_admin(auth.uid())
    );

CREATE POLICY "Errors: cliente può creare" ON public.error_reports
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Errors: coach/admin può aggiornare" ON public.error_reports
    FOR UPDATE TO authenticated
    USING (auth.uid() = coach_id OR public.is_admin(auth.uid()) OR auth.uid() = client_id);

-- NOTIFICATIONS
CREATE POLICY "Notifications: solo proprietario" ON public.notifications
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Notifications: sistema può inserire" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (true); -- Le notifiche vengono create da funzioni server

CREATE POLICY "Notifications: proprietario può aggiornare (read)" ON public.notifications
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

-- GYM HOURS
CREATE POLICY "Hours: tutti possono vedere" ON public.gym_hours
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Hours: solo admin può gestire" ON public.gym_hours
    FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()));

-- =============================================
-- TRIGGER PER UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workout_plans_updated_at
    BEFORE UPDATE ON public.workout_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_notes_updated_at
    BEFORE UPDATE ON public.client_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- INDICI PER PERFORMANCE
-- =============================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_end_date ON public.subscriptions(end_date);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_workout_plans_client_id ON public.workout_plans(client_id);
CREATE INDEX idx_workout_plans_coach_id ON public.workout_plans(coach_id);
CREATE INDEX idx_appointments_coach_id ON public.appointments(coach_id);
CREATE INDEX idx_appointments_client_id ON public.appointments(client_id);
CREATE INDEX idx_appointments_start_time ON public.appointments(start_time);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_coach_assignments_coach_id ON public.coach_assignments(coach_id);
CREATE INDEX idx_coach_assignments_client_id ON public.coach_assignments(client_id);

-- =============================================
-- DATI INIZIALI
-- =============================================

-- Orari palestra default
INSERT INTO public.gym_hours (day_of_week, open_time, close_time, is_closed) VALUES
(0, '09:00', '13:00', false), -- Domenica
(1, '06:00', '22:00', false), -- Lunedì
(2, '06:00', '22:00', false), -- Martedì
(3, '06:00', '22:00', false), -- Mercoledì
(4, '06:00', '22:00', false), -- Giovedì
(5, '06:00', '22:00', false), -- Venerdì
(6, '08:00', '18:00', false); -- Sabato

-- Piani abbonamento esempio
INSERT INTO public.membership_plans (name, description, price, duration_months, plan_type) VALUES
('Mensile Palestra', 'Accesso illimitato alla sala pesi e corsi base', 50.00, 1, 'cliente_palestra'),
('Trimestrale Palestra', 'Accesso illimitato 3 mesi - risparmia il 10%', 135.00, 3, 'cliente_palestra'),
('Annuale Palestra', 'Accesso illimitato 12 mesi - miglior prezzo', 480.00, 12, 'cliente_palestra'),
('Mensile Coaching', 'Personal training con scheda personalizzata', 120.00, 1, 'cliente_coaching'),
('Trimestrale Coaching', 'Personal training 3 mesi - risparmia il 15%', 306.00, 3, 'cliente_coaching'),
('Annuale Coaching', 'Personal training 12 mesi - pacchetto premium', 1080.00, 12, 'cliente_coaching');

-- =============================================
-- STORAGE BUCKET PER VIDEO E DOCUMENTI
-- =============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('exercise-videos', 'exercise-videos', true, 104857600, ARRAY['video/mp4', 'video/webm', 'video/quicktime']),
    ('client-documents', 'client-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

-- Storage policies per exercise-videos (pubblici per visione)
CREATE POLICY "Videos pubblici per lettura" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'exercise-videos');

CREATE POLICY "Coach può uploadare video" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'exercise-videos' 
        AND public.is_staff(auth.uid())
    );

CREATE POLICY "Coach può eliminare propri video" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'exercise-videos' 
        AND public.is_staff(auth.uid())
    );

-- Storage policies per client-documents (privati)
CREATE POLICY "Documenti visibili a proprietario e staff" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'client-documents' 
        AND (
            public.is_staff(auth.uid())
            OR (storage.foldername(name))[1] = auth.uid()::text
        )
    );

CREATE POLICY "Staff può uploadare documenti" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'client-documents' 
        AND public.is_staff(auth.uid())
    );

CREATE POLICY "Admin può eliminare documenti" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'client-documents' 
        AND public.is_admin(auth.uid())
    );