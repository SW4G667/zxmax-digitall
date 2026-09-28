-- ZXMAX post-deploy hardening for marketplace wallet, notification and verification additions.

-- Trigger-only helpers are not browser RPCs.
REVOKE ALL ON FUNCTION public.enforce_listing_phone_verification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_public_profile_verification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_purchase_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_product_question() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_global_notice() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_message_sender_role() FROM PUBLIC, anon, authenticated;

-- User-facing RPC: authenticated users only; authorization is additionally
-- enforced inside each function.
REVOKE ALL ON FUNCTION public.pay_purchase_with_wallet(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_purchase_with_wallet(bigint) TO authenticated;

-- Refunds are routed through the authenticated order-action Edge Function and
-- its service-role-only wrapper, never directly from the browser.
REVOKE ALL ON FUNCTION public.refund_purchase_to_wallet(bigint,text) FROM PUBLIC, anon, authenticated;

-- Admin tag/settings RPCs must not be anonymously callable. Their internal
-- capability/admin checks remain the second authorization layer.
REVOKE ALL ON FUNCTION public.create_admin_user_tag(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_user_tag(text,text,text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_platform_settings(boolean,text,numeric,numeric,numeric,numeric,numeric,numeric,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_settings(boolean,text,numeric,numeric,numeric,numeric,numeric,numeric,integer) TO authenticated;

-- Keep notification RLS cheap at scale by evaluating auth.uid() once per query.
DROP POLICY IF EXISTS "Own notification preferences" ON public.notification_preferences;
CREATE POLICY "Own notification preferences"
ON public.notification_preferences
FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Own notifications read" ON public.notifications;
CREATE POLICY "Own notifications read"
ON public.notifications
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Own notifications update" ON public.notifications;
CREATE POLICY "Own notifications update"
ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Own wallet ledger" ON public.wallet_ledger;
CREATE POLICY "Own wallet ledger"
ON public.wallet_ledger
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Cover the new hot paths: notification inbox, wallet balance/refunds and the
-- 15-minute fund-release cron.
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wallet_ledger_user_available_idx
  ON public.wallet_ledger(user_id, available_at);

CREATE INDEX IF NOT EXISTS wallet_ledger_purchase_idx
  ON public.wallet_ledger(purchase_id);

CREATE INDEX IF NOT EXISTS purchases_funds_release_due_idx
  ON public.purchases(funds_available_at)
  WHERE status = 'delivered'
    AND seller_released = false
    AND payment_status = 'paid';

CREATE INDEX IF NOT EXISTS purchases_delivery_confirmation_due_idx
  ON public.purchases(delivered_pending_at)
  WHERE status = 'delivered_pending_confirmation';
