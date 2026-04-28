-- Aggiungi policy che blocca esplicitamente l'accesso anonimo agli appuntamenti
-- La policy esistente già verifica auth.uid() ma aggiungiamo una policy permissiva 
-- che richiede esplicitamente l'autenticazione come primo controllo

-- Prima eliminiamo la policy esistente per SELECT
DROP POLICY IF EXISTS "Appointments: visualizza propri" ON public.appointments;

-- Creiamo una nuova policy SELECT che richiede esplicitamente autenticazione
CREATE POLICY "Appointments: solo utenti autenticati possono vedere propri"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  (auth.uid() = coach_id) 
  OR (auth.uid() = client_id) 
  OR is_admin(auth.uid())
);

-- Aggiungiamo anche policy per bloccare esplicitamente l'accesso anonimo (ruolo anon)
-- Questa è una policy restrittiva che nega tutto agli utenti anonimi
CREATE POLICY "Appointments: nega accesso anonimo"
ON public.appointments
FOR ALL
TO anon
USING (false)
WITH CHECK (false);