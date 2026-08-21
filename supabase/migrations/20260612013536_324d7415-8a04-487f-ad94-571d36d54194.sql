GRANT INSERT (product_id, buyer_id, buyer_public_id, seller_id, seller_public_id, status, amount, messages, variation_name) ON public.purchases TO authenticated;
GRANT UPDATE (evopay_charge_id, pix_qr_code, pix_expires_at, updated_at) ON public.purchases TO authenticated;

DROP POLICY IF EXISTS "Buyers can save pending pix charge" ON public.purchases;
CREATE POLICY "Buyers can save pending pix charge"
ON public.purchases
FOR UPDATE
TO authenticated
USING (auth.uid() = buyer_id AND status = 'pending')
WITH CHECK (auth.uid() = buyer_id AND status = 'pending');