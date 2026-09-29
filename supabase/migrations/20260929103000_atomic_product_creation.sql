-- Atomic listing creation and approval trigger cleanup.
DROP TRIGGER IF EXISTS protect_product_approval_trigger ON public.products;

CREATE OR REPLACE FUNCTION public.create_product_listing(
  _name text, _price numeric, _category text, _image text DEFAULT '',
  _banner text DEFAULT NULL, _description text DEFAULT '',
  _delivery_type text DEFAULT 'manual', _variations jsonb DEFAULT '[]'::jsonb,
  _stock integer DEFAULT NULL, _min_quantity integer DEFAULT NULL,
  _delivery_time text DEFAULT NULL, _inventory_mode text DEFAULT 'legacy',
  _inventories jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  uid uuid := auth.uid(); new_product public.products%ROWTYPE;
  admin_actor boolean; profile_row record; cfg jsonb; item_text text;
  requested_variation_id text; variation jsonb; valid_target boolean; total_items integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sua sessão expirou. Entre novamente para publicar o anúncio.' USING ERRCODE='42501'; END IF;
  admin_actor := public.has_role(uid,'admin'::public.app_role);
  SELECT public_id,display_name INTO profile_row FROM public.profiles WHERE user_id=uid LIMIT 1;
  IF profile_row.public_id IS NULL THEN RAISE EXCEPTION 'Perfil público do vendedor não está disponível' USING ERRCODE='42501'; END IF;

  INSERT INTO public.products(
    seller_id,seller_public_id,seller_name,seller_email,name,price,category,image,banner,
    description,approved,delivery_type,variations,questions,stock,min_quantity,delivery_time,inventory_mode
  ) VALUES (
    uid,profile_row.public_id::text,COALESCE(NULLIF(btrim(profile_row.display_name),''),'Vendedor'),'',
    btrim(_name),_price,_category,COALESCE(_image,''),_banner,COALESCE(_description,''),admin_actor,
    COALESCE(NULLIF(_delivery_type,''),'manual'),COALESCE(_variations,'[]'::jsonb),'[]'::jsonb,
    _stock,_min_quantity,_delivery_time,COALESCE(NULLIF(_inventory_mode,''),'legacy')
  ) RETURNING * INTO new_product;

  IF jsonb_typeof(COALESCE(_inventories,'[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Configuração de estoque inválida.' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(COALESCE(_inventories,'[]'::jsonb)) > 0 THEN
    DELETE FROM public.product_inventory_items WHERE product_id=new_product.id AND status='available';
    FOR cfg IN SELECT value FROM jsonb_array_elements(_inventories) LOOP
      requested_variation_id := NULLIF(btrim(cfg->>'variationId'),''); valid_target := false; variation := NULL;
      IF requested_variation_id IS NULL THEN
        valid_target := jsonb_array_length(COALESCE(new_product.variations,'[]'::jsonb))=0 AND new_product.delivery_type='auto';
      ELSE
        SELECT value INTO variation FROM jsonb_array_elements(COALESCE(new_product.variations,'[]'::jsonb))
          WHERE value->>'id'=requested_variation_id LIMIT 1;
        valid_target := variation IS NOT NULL AND COALESCE(NULLIF(variation->>'deliveryType',''),new_product.delivery_type)='auto';
      END IF;
      IF NOT valid_target THEN RAISE EXCEPTION 'Variação de entrega automática inválida.' USING ERRCODE='22023'; END IF;
      IF jsonb_typeof(COALESCE(cfg->'items','[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Lista de itens de entrega inválida.' USING ERRCODE='22023'; END IF;
      FOR item_text IN SELECT DISTINCT btrim(value) FROM jsonb_array_elements_text(COALESCE(cfg->'items','[]'::jsonb)) LOOP
        IF item_text='' THEN CONTINUE; END IF;
        IF char_length(item_text)>8000 THEN RAISE EXCEPTION 'Um item de entrega ultrapassa o limite permitido.' USING ERRCODE='22023'; END IF;
        total_items := total_items+1;
        IF total_items>5000 THEN RAISE EXCEPTION 'Limite de 5000 itens automáticos por anúncio.' USING ERRCODE='22023'; END IF;
        INSERT INTO public.product_inventory_items(product_id,variation_id,seller_id,content)
          VALUES(new_product.id,requested_variation_id,uid,item_text);
      END LOOP;
    END LOOP;
    PERFORM public.sync_product_inventory_stock(new_product.id);
    SELECT * INTO new_product FROM public.products WHERE id=new_product.id;
  END IF;
  RETURN jsonb_build_object('success',true,'id',new_product.id,'approved',new_product.approved,'stock',new_product.stock,'inventoryMode',new_product.inventory_mode);
END; $$;
REVOKE ALL ON FUNCTION public.create_product_listing(text,numeric,text,text,text,text,text,jsonb,integer,integer,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_product_listing(text,numeric,text,text,text,text,text,jsonb,integer,integer,text,text,jsonb) TO authenticated,service_role;
