CREATE POLICY "Service role manages payment events"
ON public.payment_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);