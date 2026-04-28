-- Protezione tabella subscriptions contro accesso anonimo
-- Stessa strategia applicata alla tabella appointments

-- Prima eliminiamo la policy SELECT esistente
DROP POLICY IF EXISTS "Subscriptions: visualizza propri o gestiti" ON public.subscriptions;

-- Creiamo una nuova policy SELECT che richiede esplicitamente autenticazione
CREATE POLICY "Subscriptions: solo utenti autenticati possono vedere"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) 
  OR is_admin(auth.uid()) 
  OR coach_manages_client(auth.uid(), user_id)
);

-- Aggiungiamo policy per bloccare esplicitamente l'accesso anonimo
CREATE POLICY "Subscriptions: nega accesso anonimo"
ON public.subscriptions
FOR ALL
TO anon
USING (false)
WITH CHECK (false);