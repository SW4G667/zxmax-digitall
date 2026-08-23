export const SAFE_PRODUCT_COLUMNS = "id,seller_id,seller_public_id,seller_name,name,price,category,image,banner,description,approved,delivery_type,variations,questions,sales,rating,created_at,updated_at";

type Identified = { id: number };

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
