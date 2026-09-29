-- ZXMAX: payment, notifications and Robux polish. Credentials stay in Supabase Vault.

CREATE OR REPLACE FUNCTION public.get_gateway_secret_server(_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,vault AS $$
DECLARE value text;
BEGIN
  IF current_user NOT IN ('postgres','service_role','supabase_admin') THEN RAISE EXCEPTION 'server_only'; END IF;
  SELECT decrypted_secret INTO value FROM vault.decrypted_secrets WHERE name=_name LIMIT 1;
  RETURN value;
END $$;
REVOKE ALL ON FUNCTION public.get_gateway_secret_server(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_gateway_secret_server(text) TO service_role;

ALTER TABLE public.notification_preferences ADD COLUMN IF NOT EXISTS browser_enabled boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_order_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.purchases%rowtype; product_name text:='Produto'; recipient uuid; channel_name text:='orders'; message_preview text;
BEGIN
  SELECT * INTO p FROM public.purchases WHERE id=NEW.order_id;
  IF p IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO product_name FROM public.products WHERE id=p.product_id;
  product_name:=COALESCE(NULLIF(product_name,''),'Produto');
  IF NEW.sender_id=p.buyer_id THEN recipient:=p.seller_id; channel_name:='sales';
  ELSIF NEW.sender_id=p.seller_id THEN recipient:=p.buyer_id; channel_name:='orders';
  ELSE RETURN NEW; END IF;
  message_preview:=COALESCE(NULLIF(left(btrim(COALESCE(NEW.body,'')),180),''),'Você recebeu uma imagem no chat do pedido.');
  PERFORM public.push_notification(recipient,'chat','Nova mensagem · '||left(product_name,70),message_preview,'/minhas-compras?order='||NEW.order_id,channel_name,'chat:'||NEW.id::text||':'||recipient::text,jsonb_build_object('orderId',NEW.order_id,'messageId',NEW.id,'productName',product_name));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_order_message_trg ON public.order_messages;
CREATE TRIGGER notify_order_message_trg AFTER INSERT ON public.order_messages FOR EACH ROW EXECUTE FUNCTION public.notify_order_message();

CREATE OR REPLACE FUNCTION public.notify_purchase_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE status_changed boolean:=TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status; product_name text:='Produto'; value_label text:='R$ 0,00';
BEGIN
  IF NOT status_changed THEN RETURN NEW; END IF;
  SELECT name INTO product_name FROM public.products WHERE id=NEW.product_id;
  product_name:=COALESCE(NULLIF(product_name,''),'Produto');
  value_label:='R$ '||replace(to_char(COALESCE(NEW.amount,0),'FM999999990D00'),'.',',');
  IF NEW.status='paid' THEN
    PERFORM public.push_notification(NEW.seller_id,'sale','Venda aprovada · '||left(product_name,70),value_label||' · pedido #'||NEW.id||' confirmado.','/minhas-compras?scope=sales&order='||NEW.id,'sales','sale:'||NEW.id||':paid',jsonb_build_object('orderId',NEW.id,'productName',product_name,'amount',NEW.amount));
    PERFORM public.push_notification(NEW.buyer_id,'order','Pagamento aprovado · '||left(product_name,70),value_label||' · seu pedido #'||NEW.id||' foi confirmado.','/minhas-compras?scope=purchases&order='||NEW.id,'orders','buyer:'||NEW.id||':paid',jsonb_build_object('orderId',NEW.id,'productName',product_name,'amount',NEW.amount));
  ELSIF NEW.status='delivered_pending_confirmation' THEN
    PERFORM public.push_notification(NEW.buyer_id,'order','Pedido entregue · '||left(product_name,70),'Confira o pedido #'||NEW.id||' e confirme o recebimento.','/minhas-compras?scope=purchases&order='||NEW.id,'orders','buyer:'||NEW.id||':delivery',jsonb_build_object('orderId',NEW.id,'productName',product_name,'amount',NEW.amount));
  ELSIF NEW.status='delivered' THEN
    PERFORM public.push_notification(NEW.buyer_id,'order','Pedido concluído · '||left(product_name,70),value_label||' · pedido #'||NEW.id||' concluído.','/minhas-compras?scope=purchases&order='||NEW.id,'orders','buyer:'||NEW.id||':done',jsonb_build_object('orderId',NEW.id,'productName',product_name,'amount',NEW.amount));
    PERFORM public.push_notification(NEW.seller_id,'sale','Venda concluída · '||left(product_name,70),value_label||' · o saldo seguirá o prazo de segurança.','/minhas-compras?scope=sales&order='||NEW.id,'sales','seller:'||NEW.id||':done',jsonb_build_object('orderId',NEW.id,'productName',product_name,'amount',NEW.amount));
  ELSIF NEW.status='dispute' THEN
    PERFORM public.push_notification(NEW.seller_id,'order','Disputa aberta · '||left(product_name,70),'Uma disputa foi aberta no pedido #'||NEW.id||'.','/minhas-compras?scope=sales&order='||NEW.id,'orders','seller:'||NEW.id||':dispute',jsonb_build_object('orderId',NEW.id,'productName',product_name,'amount',NEW.amount));
    PERFORM public.push_notification(NEW.buyer_id,'order','Disputa registrada · '||left(product_name,70),'A disputa do pedido #'||NEW.id||' foi registrada.','/minhas-compras?scope=purchases&order='||NEW.id,'orders','buyer:'||NEW.id||':dispute',jsonb_build_object('orderId',NEW.id,'productName',product_name,'amount',NEW.amount));
  ELSIF NEW.status IN ('refunded','cancelled') THEN
    PERFORM public.push_notification(NEW.buyer_id,'order',(CASE WHEN NEW.status='refunded' THEN 'Pedido reembolsado' ELSE 'Pedido cancelado' END)||' · '||left(product_name,70),value_label||' · atualização no pedido #'||NEW.id||'.','/minhas-compras?scope=purchases&order='||NEW.id,'orders','buyer:'||NEW.id||':'||NEW.status,jsonb_build_object('orderId',NEW.id,'productName',product_name,'amount',NEW.amount));
    PERFORM public.push_notification(NEW.seller_id,'sale',(CASE WHEN NEW.status='refunded' THEN 'Reembolso concluído' ELSE 'Pedido cancelado' END)||' · '||left(product_name,70),value_label||' · atualização no pedido #'||NEW.id||'.','/minhas-compras?scope=sales&order='||NEW.id,'sales','seller:'||NEW.id||':'||NEW.status,jsonb_build_object('orderId',NEW.id,'productName',product_name,'amount',NEW.amount));
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.get_admin_notification_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'total',(SELECT count(*) FROM public.notifications),
    'unread',(SELECT count(*) FROM public.notifications WHERE read_at IS NULL),
    'last24h',(SELECT count(*) FROM public.notifications WHERE created_at>=now()-interval '24 hours'),
    'enabledUsers',(SELECT count(*) FROM public.notification_preferences WHERE enabled=true),
    'browserUsers',(SELECT count(*) FROM public.notification_preferences WHERE enabled=true AND browser_enabled=true)
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_notification_stats() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_notification_stats() TO authenticated,service_role;

UPDATE public.products SET category='Robux' WHERE category='Robux e Gift Cards';
UPDATE public.app_settings
SET value=jsonb_set(COALESCE(value,'{}'::jsonb),'{categories}',COALESCE((
  SELECT jsonb_agg(CASE WHEN item='Robux e Gift Cards' THEN 'Robux' ELSE item END ORDER BY ord)
  FROM jsonb_array_elements_text(COALESCE(value->'categories','[]'::jsonb)) WITH ORDINALITY AS x(item,ord)
),'[]'::jsonb),true),updated_at=now()
WHERE key='platform';

CREATE OR REPLACE FUNCTION public.canonicalize_robux_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE offer jsonb; units_text text; package_units integer;
BEGIN
  IF NEW.category NOT IN ('Robux','Robux e Gift Cards') THEN RETURN NEW; END IF;
  NEW.category:='Robux';
  IF jsonb_typeof(COALESCE(NEW.variations,'[]'::jsonb))<>'array' OR jsonb_array_length(COALESCE(NEW.variations,'[]'::jsonb))<>1 THEN RAISE EXCEPTION 'Uma oferta Robux precisa ter uma única configuração de pacote' USING ERRCODE='22023'; END IF;
  offer:=NEW.variations->0;
  units_text:=NULLIF(regexp_replace(COALESCE(offer->>'name',''),'[^0-9]','','g'),'');
  IF units_text IS NULL OR units_text::numeric>2147483647 THEN RAISE EXCEPTION 'Informe uma quantidade válida de Robux no pacote' USING ERRCODE='22023'; END IF;
  package_units:=units_text::integer;
  IF package_units<=0 THEN RAISE EXCEPTION 'Informe uma quantidade válida de Robux no pacote' USING ERRCODE='22023'; END IF;
  IF NEW.stock IS NULL OR NEW.stock<0 THEN RAISE EXCEPTION 'Informe o estoque disponível de Robux' USING ERRCODE='22023'; END IF;
  IF NEW.min_quantity IS NULL OR NEW.min_quantity<=0 THEN RAISE EXCEPTION 'Informe a quantidade mínima de compra de Robux' USING ERRCODE='22023'; END IF;
  IF NEW.min_quantity>NEW.stock THEN RAISE EXCEPTION 'A quantidade mínima não pode exceder o estoque disponível' USING ERRCODE='22023'; END IF;
  NEW.name:='Robux'; NEW.description:='';
  NEW.variations:=jsonb_build_array(jsonb_build_object('name',package_units::text||' Robux','price',NEW.price,'stock',NEW.stock,'minQuantity',NEW.min_quantity));
  RETURN NEW;
END $$;
