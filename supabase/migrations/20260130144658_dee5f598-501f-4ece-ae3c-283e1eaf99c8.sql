-- =============================================
-- FIX SECURITY WARNINGS
-- =============================================

-- 1. Fix function search_path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 2. Fix permissive RLS policy for notifications INSERT
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Notifications: sistema può inserire" ON public.notifications;

-- Create a proper INSERT policy - only staff can create notifications for others
-- or users can potentially receive notifications from the system
CREATE POLICY "Notifications: staff può creare per utenti" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_staff(auth.uid()) -- staff può creare notifiche
        OR auth.uid() = user_id -- o il sistema crea per l'utente stesso
    );