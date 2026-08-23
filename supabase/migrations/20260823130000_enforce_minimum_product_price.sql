-- Enforce the advertised minimum at the database boundary as well as in the UI.
-- NOT VALID keeps historic underpriced rows readable, while protecting every
-- new listing and any changed listing from direct API requests.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_minimum_price;
ALTER TABLE public.products
  ADD CONSTRAINT products_minimum_price CHECK (price >= 2) NOT VALID;
