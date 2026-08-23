export const SAFE_PRODUCT_COLUMNS = "id,seller_id,seller_public_id,seller_name,name,price,category,image,banner,description,approved,delivery_type,variations,questions,sales,rating,created_at,updated_at,stock,min_quantity,delivery_time";

type Identified = { id: number };

/** Minimum advertised price in BRL, enforced in the UI and at the DB boundary. */
export const MIN_PRODUCT_PRICE = 2;

/** Parse a seller-entered price in either pt-BR or dot-decimal notation. */
export function parsePriceInput(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const cleaned = String(raw).trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const normalized = lastComma > lastDot
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

/** Recover legacy per-unit Robux prices from their package variation for display. */
export function normalizeProductPrice(product: {
  price: number;
  category?: string | null;
  variations?: { price?: number }[] | null;
}): number {
  let price = Number(product.price);
  if (!Number.isFinite(price) || price < 0) price = 0;
  if (price >= MIN_PRODUCT_PRICE) return price;
  if (product.category === "Robux e Gift Cards" && product.variations?.length) {
    const packagePrice = product.variations
      .map((variation) => Number(variation.price))
      .find((variationPrice) => Number.isFinite(variationPrice) && variationPrice >= MIN_PRODUCT_PRICE);
    if (packagePrice) return packagePrice;
  }
  return price;
}

/** Preserve the last good catalog when a permission/query failure returns no rows.
 * Optimistic Date.now IDs are also retained until their insert is reconciled. */
export function mergeCatalog<T extends Identified>(incoming: T[], previous: T[], options: { failed?: boolean } = {}): T[] {
  if (options.failed && incoming.length === 0) return previous;
  const byId = new Map<number, T>(previous.filter((p) => p.id > 1e12).map((p) => [p.id, p]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()];
}

/** Customers only see approved listings; sellers retain visibility of their pending work. */
export function storefrontProducts<T extends { approved: boolean; sellerId: string }>(products: T[], currentUserId?: string | null): T[] {
  return products.filter((product) => product.approved || (!!currentUserId && product.sellerId === currentUserId));
}
