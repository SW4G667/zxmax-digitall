/** Columns the client is allowed to read from `public.products`.
 * Deliberately excludes `seller_email` and `delivery_content`. */
export const SAFE_PRODUCT_COLUMNS = "id,seller_id,seller_public_id,seller_name,name,price,category,image,banner,description,approved,delivery_type,variations,questions,sales,rating,created_at,updated_at,stock,min_quantity,delivery_time";

/** Same list without the columns added by the 2026-08 migrations. Used as a
 * degraded retry so an out-of-date database still returns a catalog instead of
 * a PostgREST "column does not exist" error (the real cause of "produtos (0)"). */
export const LEGACY_PRODUCT_COLUMNS = "id,seller_id,seller_public_id,seller_name,name,price,category,image,banner,description,approved,delivery_type,variations,questions,sales,rating,created_at,updated_at";

type Identified = { id: number };

/** Minimum advertised price in BRL, enforced in the UI, in the DB trigger and
 * in the CHECK constraint. Keep this in sync with `validate_product_price()`. */
export const MIN_PRODUCT_PRICE = 2;

/** Largest price we accept, to stop overflow/precision abuse from the client. */
export const MAX_PRODUCT_PRICE = 1_000_000;

export const ROBUX_CATEGORY = "Robux e Gift Cards";

/** Parse a seller-entered price in either pt-BR or dot-decimal notation.
 * Always returns a finite, non-negative number rounded to 2 decimals (the
 * scale of `products.price numeric(12,2)`), so the UI and the DB agree. */
export function parsePriceInput(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return sanitizePrice(raw);
  const text = String(raw).trim();
  // Only a currency-looking string is accepted. Anything carrying letters,
  // markup or scientific notation is rejected outright instead of having its
  // digits scavenged (`"<script>alert(1)</script>"` must not become 1).
  if (!/^R?\$?\s*-?[\d.,\s]+$/.test(text)) return 0;
  const cleaned = text.replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const normalized = lastComma > lastDot
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  return sanitizePrice(Number(normalized));
}

/** Reduce anything that is not a usable BRL amount to 0 and round to cents.
 * Out-of-range values become 0 (invalid) rather than being silently clamped to
 * the ceiling — a wrong-but-plausible price is worse than a rejected one. */
export function sanitizePrice(value: unknown): number {
  const price = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (price > MAX_PRODUCT_PRICE) return 0;
  return Math.round(price * 100) / 100;
}

/** True when a parsed price may be advertised on the marketplace. */
export function isValidProductPrice(value: unknown): boolean {
  const price = sanitizePrice(value);
  return price >= MIN_PRODUCT_PRICE && price <= MAX_PRODUCT_PRICE;
}

/** Single place that renders BRL, so no screen prints `R$ 2.00000` again. */
export function formatBRL(value: unknown): string {
  const price = Number(value);
  const safe = Number.isFinite(price) ? price : 0;
  return `R$ ${safe.toFixed(2).replace(".", ",")}`;
}

/** How many Robux/units a listing sells for its advertised package price.
 * Read from the first variation label (`"1000 Robux"`); falls back to 1 so the
 * package price is never silently divided by an unknown quantity. */
export function robuxPackageUnits(product: {
  category?: string | null;
  variations?: { name?: string; price?: number }[] | null;
}): number {
  if (product.category !== ROBUX_CATEGORY) return 1;
  const label = product.variations?.[0]?.name ?? "";
  const digits = String(label).replace(/\D/g, "");
  const units = Number.parseInt(digits, 10);
  return Number.isFinite(units) && units > 0 ? units : 1;
}

/** Price of one Robux/unit, derived from the advertised package price.
 * Never stored — only used to render "R$ x / unidade" and quantity maths. */
export function unitPriceFromPackage(product: {
  price: number;
  category?: string | null;
  variations?: { name?: string; price?: number }[] | null;
}): number {
  const packagePrice = normalizeProductPrice(product);
  const units = robuxPackageUnits(product);
  if (units <= 1) return packagePrice;
  return packagePrice / units;
}

/** Recover legacy per-unit Robux prices from their package variation for display.
 * Only heals rows that are already below the platform minimum, and only from a
 * value that really exists in the row — it never invents a price. */
export function normalizeProductPrice(product: {
  price: number;
  category?: string | null;
  variations?: { price?: number }[] | null;
}): number {
  const raw = Number(product.price);
  const price = Number.isFinite(raw) && raw > 0 ? raw : 0;
  if (price >= MIN_PRODUCT_PRICE) return price;
  if (product.category === ROBUX_CATEGORY && product.variations?.length) {
    const packagePrice = product.variations
      .map((variation) => Number(variation.price))
      .find((variationPrice) => Number.isFinite(variationPrice) && variationPrice >= MIN_PRODUCT_PRICE);
    if (packagePrice) return packagePrice;
  }
  return price;
}

/** Merge a freshly loaded catalog into the one already on screen.
 *
 * - a failed request never blanks the storefront (transient network/RLS error);
 * - a successful request is authoritative: rows deleted server-side disappear;
 * - optimistic client-side rows are not kept, so nothing "ghosts" after a
 *   refresh. `addProduct` reconciles with the real row instead. */
export function mergeCatalog<T extends Identified>(incoming: T[], previous: T[], options: { failed?: boolean } = {}): T[] {
  if (options.failed) {
    if (incoming.length === 0) return previous;
    const byId = new Map<number, T>(previous.map((p) => [p.id, p]));
    for (const item of incoming) byId.set(item.id, item);
    return [...byId.values()];
  }
  return incoming;
}

/** Customers only see approved listings; sellers retain visibility of their pending work.
 * Admins pass `isAdmin` to keep every row (moderation queue). */
export function storefrontProducts<T extends { approved: boolean; sellerId: string }>(
  products: T[],
  currentUserId?: string | null,
  isAdmin = false,
): T[] {
  if (isAdmin) return products;
  return products.filter((product) => product.approved || (!!currentUserId && product.sellerId === currentUserId));
}
