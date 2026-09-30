import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  LEGACY_PRODUCT_COLUMNS,
  MIN_PRODUCT_PRICE,
  mergeCatalog,
  normalizeProductPrice,
  parsePriceInput,
  productMinQuantity,
  productStock,
  sanitizePrice,
  SAFE_PRODUCT_COLUMNS,
} from "@/lib/catalog";
import { BUYER_FEE, WITHDRAW_FEE, WITHDRAW_MIN, withdrawTotals } from "@/lib/fees";
import { logProductError, productErrorMessage } from "@/lib/productErrors";
import { unwrapEdgeCall } from "@/lib/edgeErrors";

export interface User {
  id: string;
  publicId: string;
  email: string;
  name: string;
  balance: number;
  earnings: number;
  avatar: string;
  isAdmin: boolean;
  pixKey?: string;
  isVerified?: boolean;
  emailConfirmed?: boolean;
  discordMemberVerified?: boolean;
  documentVerified?: boolean;
}

export interface GlobalNotice {
  id: string;
  text: string;
  date: string;
}

export interface AdminChatMessage {
  from: string;
  text: string;
  date: string;
}

export interface ProductVariation {
  id?: string;
  name: string;
  price: number;
  stock?: number;
  minQuantity?: number;
  deliveryType?: "auto" | "manual";
  deliveryTime?: string;
}

export interface ProductQuestion {
  id: number;
  userEmail?: string;
  userName: string;
  text: string;
  date: string;
  answer?: string;
  answerDate?: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  seller: string;
  sellerEmail?: string;
  sellerId: string;
  sellerPublicId?: string;
  sales: number;
  rating: number;
  image: string;
  banner?: string;
  description: string;
  approved: boolean;
  listingStatus?: "pending" | "approved" | "rejected" | "paused";
  deliveryType: "auto" | "manual";
  deliveryContent?: string;
  inventoryMode?: "legacy" | "items";
  variations?: ProductVariation[];
  questions?: ProductQuestion[];
  stock?: number;
  minQuantity?: number;
  deliveryTime?: string;
  reviewCount?: number;
  reviewAvg?: number;
  reviewPositive?: number;
  sellerRating?: number;
  sellerReviews?: number;
  createdAt?: string;
}

export interface PurchaseMessage {
  from: string;
  text: string;
  date: string;
}

export interface Purchase {
  id: number;
  productId: number;
  buyerEmail: string;
  buyerId: string;
  buyerPublicId?: string;
  sellerEmail: string;
  sellerId: string;
  sellerPublicId?: string;
  status: "pending" | "paid" | "delivered_pending_confirmation" | "delivered" | "dispute" | "cancelled" | "refunded";
  createdAt: string;
  updatedAt?: string;
  amount: number;
  quantity?: number;
  productAmount?: number;
  buyerFee?: number;
  paymentProvider?: "magnuspay_pix" | "zennith_pix" | "vexopay_pix" | "crypto" | "card" | "boleto" | "wallet";
  providerPaymentId?: string;
  paymentStatus?: string;
  providerAmount?: number;
  providerFee?: number;
  providerNetAmount?: number;
  providerCheckedAt?: string;
  messages: PurchaseMessage[];
  reviewed?: boolean;
  reviewStars?: number;
  reviewComment?: string;
  variationName?: string;
  variationId?: string;
  evopayChargeId?: string;
  pixQrCode?: string;
  pixExpiresAt?: string;
  deliveredPendingAt?: string;
  refundReason?: string;
  refundedAt?: string;
  sellerReleased?: boolean;
  releasedAt?: string;
}

export interface Withdrawal {
  id: number;
  userEmail: string;
  userId: string;
  amount: number;
  method: "normal" | "flex" | "gateway" | "admin_fee";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  pixKey?: string;
  rejectionReason?: string;
  providerTxId?: string;
  retryOf?: number | null;
  fee?: number;
  netAmount?: number;
}

export interface SupportTicket {
  id: number;
  userEmail: string;
  userId: string;
  subject: string;
  messages: { from: string; text: string; date: string }[];
  status: "open" | "closed";
}

export interface UserTag {
  id: string;
  name: string;
  color: string; // hex or hsl
  iconUrl?: string;
}

export interface SellerDocument {
  id: string;
  userId: string;
  userPublicId: string;
  userEmail: string;
  filePath: string;
  fileName: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface UserDirectoryEntry {
  userId: string;
  publicId: string;
  email: string;
  name: string;
  avatar?: string;
  isVerified?: boolean;
  documentVerified?: boolean;
}

export interface AppConfig {
  commission: number;
  instantFee: number;
  buyerFee: number;
  withdrawMin: number;
  withdrawFee: number;
  smallWithdrawMin: number;
  smallWithdrawExtraFee: number;
  sellerReleaseDays: number;
  discordLink: string;
  categories: string[];
  globalNotice: string;
  rules: string;
}

interface AppState {
  currentUser: User | null;
  products: Product[];
  purchases: Purchase[];
  withdrawals: Withdrawal[];
  tickets: SupportTicket[];
  config: AppConfig;
  bannedUsers: string[];
  globalNotices: GlobalNotice[];
  adminChat: AdminChatMessage[];
  userTags: UserTag[];
  userTagAssignments: Record<string, string[]>; // public ID -> tag UUIDs
  userBalances: Record<string, number>;
  userEarnings: Record<string, number>;
  sellerDocuments: SellerDocument[];
  userDirectory: Record<string, UserDirectoryEntry>;
}

interface StoreContextType {
  state: AppState;
  login: (email: string, name: string) => void;
  logout: () => void;
  addProduct: (p: Omit<Product, "id" | "sales" | "rating" | "approved" | "sellerId">) => Promise<number | false>;
  updateProduct: (id: number, p: Partial<Omit<Product, "id" | "sellerId">>) => Promise<boolean>;
  approveProduct: (id: number) => Promise<boolean>;
  rejectProduct: (id: number, reason?: string) => Promise<boolean>;
  refreshProducts: () => Promise<void>;
  /** Real network state of the catalog, so the store can show a skeleton, an
   * error with retry, or a truthful empty state instead of a silent zero. */
  catalogStatus: CatalogStatus;
  deleteProduct: (id: number) => Promise<{ ok: boolean; paused: boolean }>;
  buyProduct: (id: number, variation?: ProductVariation, quantity?: number, paymentMethod?: string) => Promise<number | null>;
  savePixCharge: (purchaseId: number, charge: { evopayId: string; qrCodeText: string; expiresAt: string }) => void;
  /** Atualiza pedidos sem descartar a última lista válida quando a rede falha. */
  refreshPurchases: () => Promise<{ ok: boolean; message?: string }>;
  markPurchasePaid: (purchaseId: number) => void;
  approvePurchase: (id: number) => void;
  revertPurchase: (id: number) => void;
  requestWithdraw: (method: "normal" | "flex", options?: { retryOf?: number; amount?: number }) => Promise<void>;
  approveWithdraw: (id: number) => Promise<void>;
  rejectWithdraw: (id: number, reason?: string) => Promise<void>;
  updateConfig: (c: Partial<AppConfig>) => void;
  updateProfile: (name: string) => void;
  banUser: (identifier: string, reason?: string) => Promise<boolean>;
  unbanUser: (identifier: string) => Promise<boolean>;
  addTicket: (subject: string, message: string) => Promise<boolean>;
  replyTicket: (id: number, text: string) => Promise<boolean>;
  closeTicket: (id: number) => Promise<boolean>;
  resolveTicket: (id: number) => Promise<boolean>;
  setGlobalNotice: (notice: string) => void;
  publishNotice: (text: string) => Promise<boolean>;
  updatePixKey: (key: string) => void;
  sendAdminChat: (from: string, text: string) => void;
  sendPurchaseMessage: (purchaseId: number, from: string, text: string) => Promise<boolean>;
  confirmDelivery: (purchaseId: number) => Promise<boolean>;
  confirmOrderReceipt: (purchaseId: number) => Promise<boolean>;
  sellerRefundOrder: (purchaseId: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  openDispute: (purchaseId: number, reason: string) => Promise<boolean>;
  reviewPurchase: (purchaseId: number, stars: number, comment: string) => Promise<boolean>;
  loadProductReviews: (productId: number) => Promise<Array<{ id: number; stars: number; comment: string; createdAt: string; buyerName: string }>>;
  addProductQuestion: (productId: number, text: string) => void;
  answerProductQuestion: (productId: number, questionId: number, answer: string) => void;
  deleteNotice: (id: string) => Promise<boolean>;
  refreshUserTags: () => Promise<void>;
  createUserTag: (name: string, color: string, iconUrl?: string) => Promise<boolean>;
  deleteUserTag: (id: string) => Promise<boolean>;
  assignUserTag: (publicId: string, tagId: string) => Promise<boolean>;
  unassignUserTag: (publicId: string, tagId: string) => Promise<boolean>;
  verifyUser: (userId: string) => Promise<boolean>;
  submitSellerDocument: (filePath: string, fileName: string) => void;
  isDark: boolean;
  toggleDark: () => void;
}

const defaultConfig: AppConfig = {
  commission: 10,
  instantFee: 7,
  buyerFee: BUYER_FEE,
  withdrawMin: 20,
  withdrawFee: WITHDRAW_FEE,
  smallWithdrawMin: 5,
  smallWithdrawExtraFee: 1,
  sellerReleaseDays: 10,
  discordLink: "",
  categories: ["Robux e Gift Cards", "Bots Discord", "Contas", "Scripts", "Assinaturas", "Designs Digitais", "Serviços Online", "Consultoria Virtual", "Keys de Software", "Arquivos", "Jogos e Itens"],
  globalNotice: "",
  rules: "1- Proibido estelionato(golpe).\n2-Proibido lavagem de dinheiro no sistema de saque do site.\n3-Proibido venda de conteúdo adulto, cp, gore ou qualquer conteúdo doloso\n\n**(Toda regra quebrada resultará a suspensão do usuário de 1 semana a permanente sem receber dinheiro de vendas durante a suspensão.)**",
};

export type CatalogStatus = "loading" | "ready" | "error";

const StoreContext = createContext<StoreContextType | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be inside StoreProvider");
  return ctx;
}

function loadState(): AppState {
  return {
    currentUser: null,
    products: [],
    purchases: [],
    withdrawals: [],
    tickets: [],
    config: defaultConfig,
    bannedUsers: [],
    globalNotices: [],
    adminChat: [],
    userTags: [],
    userTagAssignments: {},
    userBalances: {},
    userEarnings: {},
    sellerDocuments: [],
    userDirectory: {},
  };
}

const publicIdFromProfile = (profile: any, fallback: string) => String(profile?.public_id || fallback.replace(/\D/g, "").slice(0, 8) || "100000");

const mapPurchaseRow = (p: any): Purchase => ({
  id: Number(p.id),
  productId: Number(p.product_id),
  buyerEmail: p.buyer_email || "",
  buyerId: p.buyer_id,
  buyerPublicId: p.buyer_public_id,
  sellerEmail: p.seller_email || "",
  sellerId: p.seller_id,
  sellerPublicId: p.seller_public_id,
  status: p.status,
  createdAt: p.created_at,
  updatedAt: p.updated_at || undefined,
  amount: Number(p.amount),
  quantity: p.quantity == null ? undefined : Number(p.quantity),
  productAmount: p.product_amount == null ? undefined : Number(p.product_amount),
  buyerFee: p.buyer_fee == null ? undefined : Number(p.buyer_fee),
  paymentProvider: p.payment_provider || undefined,
  providerPaymentId: p.provider_payment_id || undefined,
  paymentStatus: p.payment_status || undefined,
  providerAmount: p.provider_amount == null ? undefined : Number(p.provider_amount),
  providerFee: p.provider_fee == null ? undefined : Number(p.provider_fee),
  providerNetAmount: p.provider_net_amount == null ? undefined : Number(p.provider_net_amount),
  providerCheckedAt: p.provider_checked_at || undefined,
  messages: p.messages || [],
  reviewed: p.reviewed,
  reviewStars: p.review_stars || undefined,
  reviewComment: p.review_comment || undefined,
  variationName: p.variation_name || undefined,
  variationId: p.variation_id || undefined,
  evopayChargeId: p.evopay_charge_id || undefined,
  pixQrCode: p.pix_qr_code || undefined,
  pixExpiresAt: p.pix_expires_at || undefined,
  deliveredPendingAt: p.delivered_pending_at || undefined,
  refundReason: p.refund_reason || undefined,
  refundedAt: p.refunded_at || undefined,
  sellerReleased: !!p.seller_released,
  releasedAt: p.released_at || undefined,
});

/** Persist only public variation metadata. Automatic-delivery secrets live in
 * product_inventory_items and are never serialized into products.variations. */
const mapVariation = (v: ProductVariation) => {
  const out: Record<string, unknown> = { name: v.name.trim(), price: sanitizePrice(v.price) };
  if (v.id?.trim()) out.id = v.id.trim();
  const stock = Number(v.stock);
  if (Number.isFinite(stock) && stock >= 0) out.stock = Math.trunc(stock);
  const minQ = Number(v.minQuantity);
  if (Number.isFinite(minQ) && minQ > 0) out.minQuantity = Math.trunc(minQ);
  if (v.deliveryType === "auto" || v.deliveryType === "manual") out.deliveryType = v.deliveryType;
  if (v.deliveryTime?.trim()) out.deliveryTime = v.deliveryTime.trim();
  return out;
};

const variationListingFingerprint = (variations: ProductVariation[] | undefined) =>
  JSON.stringify((variations || []).map((variation) => ({
    id: variation.id || "",
    name: variation.name.trim(),
    price: sanitizePrice(variation.price),
    minQuantity: Number(variation.minQuantity) > 0 ? Math.trunc(Number(variation.minQuantity)) : null,
    deliveryType: variation.deliveryType || "manual",
    deliveryTime: variation.deliveryTime?.trim() || "",
  })));

const mapWithdrawalRow = (w: any): Withdrawal => ({
  id: Number(w.id),
  userEmail: w.user_email || "",
  userId: w.user_id,
  amount: Number(w.amount),
  method: w.method === "flex" ? "flex" : w.method === "gateway" ? "gateway" : w.method === "admin_fee" ? "admin_fee" : "normal",
  status: w.status,
  createdAt: w.created_at,
  pixKey: w.pix_key || undefined,
  rejectionReason: w.rejection_reason || undefined,
  providerTxId: w.provider_tx || w.provider_tx_id || undefined,
  retryOf: w.retry_of ?? null,
  fee: Number.isFinite(Number(w.fee)) ? Number(w.fee) : undefined,
  netAmount: Number.isFinite(Number(w.net_amount)) ? Number(w.net_amount) : undefined,
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user: authUser, profile, isAdmin, isSupport, sessionReady, signOut } = useAuth();
  const [state, setState] = useState<AppState>(loadState);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading");
  const [isDark, setIsDark] = useState<boolean>(() => {
    // Dark marketplace is the default. Only opt OUT via theme toggle.
    const stored = localStorage.getItem("zxmax_dark");
    return stored === null ? true : stored === "true";
  });

  // Effects key on the user ID (a stable primitive), not on the user object:
  // a token refresh creates a NEW user object for the SAME person, and that
  // used to make every effect re-run — the "site fica atualizando quando saio
  // do navegador e volto" bug.
  const authUserId = authUser?.id ?? null;
  const authUserRef = React.useRef(authUser);
  authUserRef.current = authUser;

  // Sync auth user to store state - fixed to avoid admin account switch bug
  useEffect(() => {
    const authUser = authUserRef.current;
    if (authUser) {
      // If profile exists, use it, otherwise create minimal user from authUser to avoid stuck
      const userPublicId = profile ? publicIdFromProfile(profile, authUser.id) : publicIdFromProfile({ public_id: authUser.id.slice(0, 8) }, authUser.id);
      const user: User = {
        id: authUser.id,
        publicId: userPublicId,
        email: profile?.email || authUser.email || "",
        name: profile?.display_name || authUser.email?.split("@")[0] || "Usuário",
        balance: state.userBalances[authUser.id] || 0,
        earnings: state.userEarnings[authUser.id] || 0,
        avatar:
          profile?.avatar_url ||
          (authUser.user_metadata as { avatar_url?: string; picture?: string } | undefined)?.avatar_url ||
          (authUser.user_metadata as { avatar_url?: string; picture?: string } | undefined)?.picture ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(`zxmax-${userPublicId}`)}`,
        isAdmin,
        pixKey: profile?.pix_key || "",
        isVerified: profile?.is_verified_seller || false,
        emailConfirmed: Boolean((authUser as any)?.email_confirmed_at || (authUser as any)?.confirmed_at),
        discordMemberVerified: Boolean((profile as any)?.discord_member_verified_at),
        documentVerified: (profile as any)?.verification_status === "approved" || profile?.is_verified_seller || false,
      };
      setState((s) => {
        // Avoid switching to admin account randomly - only update if user id matches or currentUser is null
        if (s.currentUser && s.currentUser.id !== authUser.id) {
          console.log("Preventing account switch from", s.currentUser.id, "to", authUser.id);
          // If current user is different, only switch if authUser is actually the logged user
          // This prevents the bug where profile photo bugs and returns to admin account
          if (!profile) return s; // Don't switch if profile not loaded yet
        }
        return {
          ...s,
          currentUser: user,
          userDirectory: {
            ...(s.userDirectory || {}),
            [authUser.id]: { userId: authUser.id, publicId: userPublicId, email: user.email || "", name: user.name, avatar: user.avatar, isVerified: user.isVerified, documentVerified: user.documentVerified },
          },
        };
      });
    } else {
      // No auth user, clear currentUser
      setState((s) => ({ ...s, currentUser: null }));
    }
  }, [authUserId, profile, isAdmin, state.userBalances, state.userEarnings]);

  const refreshPublicProfiles = React.useCallback(async () => {
    const { data: profiles } = await (supabase as any)
      .from("profiles_public")
      .select("user_id, public_id, display_name, avatar_url, is_verified_seller, document_verified");
    const directory = ((profiles || []) as any[]).reduce((acc, p) => {
      acc[p.user_id] = {
        userId: p.user_id,
        publicId: String(p.public_id || ""),
        email: "",
        name: p.display_name || "Usuário",
        avatar: p.avatar_url || undefined,
        isVerified: !!p.is_verified_seller,
        documentVerified: !!p.document_verified,
      };
      return acc;
    }, {} as Record<string, UserDirectoryEntry>);
    setState((s) => ({ ...s, userDirectory: { ...(s.userDirectory || {}), ...directory } }));
  }, []);

  useEffect(() => { void refreshPublicProfiles(); }, [authUserId, refreshPublicProfiles]);
  useEffect(() => {
    const handler = () => { void refreshPublicProfiles(); };
    window.addEventListener("zxmax:profile-updated", handler);
    return () => window.removeEventListener("zxmax:profile-updated", handler);
  }, [refreshPublicProfiles]);

  const refreshUserTags = React.useCallback(async () => {
    if (!isAdmin && !isSupport) {
      setState((s) => ({ ...s, userTags: [], userTagAssignments: {} }));
      return;
    }
    const { data, error } = await (supabase as any).rpc("get_admin_user_tags");
    if (error) {
      console.warn("[zxmax:tags:load]", error);
      return;
    }
    const tags = Array.isArray(data?.tags)
      ? data.tags.map((tag: any) => ({ id: String(tag.id), name: String(tag.name || ""), color: String(tag.color || "#8b5cf6"), iconUrl: tag.iconUrl ? String(tag.iconUrl) : undefined }))
      : [];
    const assignments = data?.assignments && typeof data.assignments === "object"
      ? Object.fromEntries(Object.entries(data.assignments).map(([publicId, tagIds]) => [publicId, Array.isArray(tagIds) ? tagIds.map(String) : []]))
      : {};
    setState((s) => ({ ...s, userTags: tags, userTagAssignments: assignments }));
  }, [isAdmin, isSupport]);

  useEffect(() => { void refreshUserTags(); }, [refreshUserTags]);

  useEffect(() => {
    void (async () => {
      const { data, error } = await (supabase as any).rpc("get_public_platform_fees");
      if (error || !data) return;
      const buyerFee = Number(data.buyerFee);
      const withdrawMin = Number(data.minWithdraw);
      const withdrawFee = Number(data.withdrawFee);
      const smallWithdrawMin = Number(data.smallWithdrawMin);
      const smallWithdrawExtraFee = Number(data.smallWithdrawExtraFee);
      const sellerReleaseDays = Number(data.sellerReleaseDays);
      setState((s) => ({
        ...s,
        config: {
          ...s.config,
          buyerFee: Number.isFinite(buyerFee) && buyerFee >= 0 ? buyerFee : s.config.buyerFee,
          withdrawMin: Number.isFinite(withdrawMin) && withdrawMin >= 0 ? withdrawMin : s.config.withdrawMin,
          withdrawFee: Number.isFinite(withdrawFee) && withdrawFee >= 0 ? withdrawFee : s.config.withdrawFee,
          smallWithdrawMin: Number.isFinite(smallWithdrawMin) && smallWithdrawMin >= 1 ? smallWithdrawMin : s.config.smallWithdrawMin,
          smallWithdrawExtraFee: Number.isFinite(smallWithdrawExtraFee) && smallWithdrawExtraFee >= 0 ? smallWithdrawExtraFee : s.config.smallWithdrawExtraFee,
          sellerReleaseDays: Number.isFinite(sellerReleaseDays) && sellerReleaseDays >= 1 && sellerReleaseDays <= 30 ? sellerReleaseDays : s.config.sellerReleaseDays,
        },
      }));
    })();
  }, []);

  /** Runs a products query and, if the database has not received the latest
   * migrations yet, retries without the newer optional columns. Without this a
   * single missing column (`stock`, `min_quantity`, `delivery_time`) makes
   * PostgREST reject the whole select — which is exactly how the storefront
   * ended up showing "Todos os produtos (0)". */
  const selectProducts = React.useCallback(
    async (
      table: "products" | "products_public",
      apply: (query: any) => any = (query) => query,
    ): Promise<{ rows: any[]; failed: boolean }> => {
      const columnSets = table === "products_public"
        // The view is already restricted to safe, approved rows, so `*` is safe
        // and works no matter which migration generation created it.
        ? ["*"]
        : [SAFE_PRODUCT_COLUMNS, LEGACY_PRODUCT_COLUMNS];
      let lastError: unknown = null;
      for (const columns of columnSets) {
        const { data, error } = await apply(
          (supabase as any).from(table).select(columns).order("created_at", { ascending: false }),
        );
        if (!error) return { rows: data || [], failed: false };
        lastError = error;
      }
      logProductError(`loadCatalog:${table}`, lastError);
      return { rows: [], failed: true };
    },
    [],
  );

  const loadCatalog = React.useCallback(async () => {
    const authUser = authUserRef.current;
    setCatalogStatus((current) => (current === "ready" ? current : "loading"));
    let rows: any[] = [];
    let failed = false;
    try {
      const publicResult = await selectProducts("products_public");
      failed = publicResult.failed;
      rows = publicResult.rows;
      if (!rows.length) {
        // Service-role read model: only used when the direct read produced
        // nothing, and it still returns approved rows only.
        const edge = await supabase.functions.invoke("public-products", {});
        if (!edge.error && Array.isArray(edge.data?.products)) {
          rows = edge.data.products;
          failed = false;
        } else if (edge.error) {
          logProductError("loadCatalog:public-products", edge.error);
        }
      }
      if (!rows.length) {
        const fallback = await selectProducts("products", (query) => query.eq("approved", true));
        failed = failed || fallback.failed;
        rows = fallback.rows;
      }
      if (authUser) {
        // Sellers always keep sight of their own pending listings.
        const own = await selectProducts("products", (query) => query.eq("seller_id", authUser.id));
        failed = failed || own.failed;
        rows = [...rows, ...own.rows];
        if (isAdmin) {
          const all = await selectProducts("products");
          failed = failed || all.failed;
          rows = [...rows, ...all.rows];
        }
      }
      const unique = [...new Map(rows.map((row) => [Number(row.id), row])).values()];
      const products = unique.map((p: any) => {
        const price = normalizeProductPrice({ price: Number(p.price), category: p.category, variations: p.variations });
        return {
          id: Number(p.id), name: p.name, price, category: p.category,
          seller: p.seller_name, sellerId: p.seller_id,
          sellerPublicId: p.seller_public_id, sales: p.sales || 0, rating: Number(p.rating || 0),
          image: p.image, banner: p.banner || undefined, description: p.description, approved: !!p.approved,
          listingStatus: (p.listing_status || (p.approved ? "approved" : "pending")) as Product["listingStatus"],
          deliveryType: p.delivery_type, variations: p.variations || [], questions: p.questions || [],
          stock: productStock({ stock: p.stock, variations: p.variations }) ?? undefined,
          minQuantity: productMinQuantity({ minQuantity: p.min_quantity, variations: p.variations, category: p.category }) ?? undefined,
          deliveryTime: p.delivery_time || undefined,
          reviewCount: Number.isFinite(Number(p.review_count)) ? Number(p.review_count) : undefined,
          reviewAvg: Number.isFinite(Number(p.review_avg)) ? Number(p.review_avg) : undefined,
          reviewPositive: Number.isFinite(Number(p.review_positive)) ? Number(p.review_positive) : undefined,
          sellerRating: undefined, sellerReviews: undefined, createdAt: p.created_at || undefined,
        };
      }) as Product[];
      setState((old) => ({ ...old, products: mergeCatalog(products, old.products, { failed }) }));
      setCatalogStatus(failed ? "error" : "ready");
    } catch (error) {
      logProductError("loadCatalog", error);
      setState((old) => ({ ...old, products: mergeCatalog([], old.products, { failed: true }) }));
      setCatalogStatus("error");
    }
  }, [authUserId, isAdmin, selectProducts]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!authUserId) return;
    const channel = supabase.channel(`purchases_${authUserId}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "purchases" },
      () => { void refreshPurchases(); },
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [authUserId]);


  useEffect(() => {
    localStorage.setItem("zxmax_dark", String(isDark));
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const login = (_email: string, _name: string) => {
    // No-op: auth is handled by AuthProvider now
  };

  const logout = () => {
    signOut();
    setState((s) => ({ ...s, currentUser: null }));
  };

  const addProduct = async (p: Omit<Product, "id" | "sales" | "rating" | "approved" | "sellerId">): Promise<number | false> => {
    const authUser = authUserRef.current;
    if (!state.currentUser || !authUser) {
      toast.error("Sua sessão expirou. Entre novamente para publicar o anúncio.");
      return false;
    }

    const price = parsePriceInput(p.price);
    if (!p.name?.trim()) { toast.error("Informe o nome do anúncio."); return false; }
    if (!p.image?.trim()) { toast.error("Envie uma imagem principal antes de publicar."); return false; }
    if (price < MIN_PRODUCT_PRICE) {
      toast.error(`O preço mínimo é R$ ${MIN_PRODUCT_PRICE.toFixed(2).replace(".", ",")}.`);
      return false;
    }
    if (!isAdmin && !state.currentUser.emailConfirmed) {
      toast.error("Confirme seu e-mail antes de anunciar.");
      return false;
    }
    if (!isAdmin && !state.currentUser.discordMemberVerified) {
      toast.error("Entre no servidor do Discord e verifique sua conta antes de anunciar.");
      return false;
    }

    // Product + automatic inventory are created in ONE database transaction.
    // Never retry with stock columns removed: partial listings are worse than a
    // visible failure because they can be sold with the wrong inventory.
    const { data, error } = await (supabase as any).rpc("create_product_listing", {
      _name: p.name.trim(),
      _price: price,
      _category: p.category,
      _image: p.image || "",
      _banner: p.banner || null,
      _description: p.description || "",
      _delivery_type: p.deliveryType || "manual",
      _variations: (p.variations || []).map(mapVariation),
      _stock: p.stock ?? null,
      _min_quantity: p.minQuantity ?? null,
      _delivery_time: p.deliveryTime || null,
      _inventory_mode: p.inventoryMode || "legacy",
      _inventories: (p as any).inventoryPayload || [],
    });

    if (error || !data?.success || !data?.id) {
      logProductError("addProduct:create_product_listing", error || data);
      toast.error(productErrorMessage(error || data));
      return false;
    }

    await loadCatalog();
    toast.success(data.approved ? "Anúncio publicado!" : "Anúncio criado! Aguardando aprovação da moderação.");
    return Number(data.id);
  };

  const updateProduct = async (id: number, p: Partial<Omit<Product, "id" | "sellerId">>) => {
    const existing = state.products.find((pr) => pr.id === id);
    if (!existing) return false;
    const actorId = authUserRef.current?.id;
    if (!actorId) {
      toast.error("Sua sessão expirou. Entre novamente para editar o anúncio.");
      return false;
    }
    if (!isAdmin && existing.sellerId !== actorId) {
      toast.error("Você não tem permissão para editar este anúncio.");
      return false;
    }
    const resultingImage = p.image === undefined ? existing.image : p.image;
    if (!String(resultingImage || "").trim()) {
      toast.error("Todo anúncio precisa de uma imagem principal.");
      return false;
    }
    // If price or delivery content changed, send back to review - but admin edits stay approved
    const essentialChanged =
      (p.price !== undefined && p.price !== existing.price) ||
      (p.deliveryContent !== undefined && p.deliveryContent !== existing.deliveryContent) ||
      (p.deliveryType !== undefined && p.deliveryType !== existing.deliveryType) ||
      (p.inventoryMode !== undefined && p.inventoryMode !== existing.inventoryMode) ||
      (p.variations !== undefined && variationListingFingerprint(p.variations) !== variationListingFingerprint(existing.variations));
    const dbPayload: any = {};
    if (p.name !== undefined) dbPayload.name = p.name;
    if (p.category !== undefined) dbPayload.category = p.category;
    if (p.description !== undefined) dbPayload.description = p.description;
    if (p.price !== undefined) {
      const price = parsePriceInput(p.price);
      if (price < MIN_PRODUCT_PRICE) {
        toast.error(`O preço mínimo é R$ ${MIN_PRODUCT_PRICE.toFixed(2).replace(".", ",")}.`);
        return false;
      }
      dbPayload.price = price;
    }
    if (p.image !== undefined && p.image) dbPayload.image = p.image;
    if (p.banner !== undefined) dbPayload.banner = p.banner || null;
    if (p.deliveryType !== undefined) dbPayload.delivery_type = p.deliveryType;
    if (p.inventoryMode !== undefined) dbPayload.inventory_mode = p.inventoryMode;
    if (p.variations !== undefined) dbPayload.variations = (p.variations || []).map(mapVariation);
    if (p.stock !== undefined) dbPayload.stock = p.stock;
    if (p.minQuantity !== undefined) dbPayload.min_quantity = p.minQuantity;
    if (p.deliveryTime !== undefined) dbPayload.delivery_time = p.deliveryTime;
    // Only unapprove if not admin and essential changed
    if (essentialChanged && !isAdmin) dbPayload.approved = false;
    else if (isAdmin) dbPayload.approved = true;
    
    try {
      // Older deployments have column-level grants without the optional stock
      // fields. Retry the core product update instead of rejecting the edit.
      let { error } = await (supabase as any).from("products").update(dbPayload).eq("id", id);
      const code = String(error?.code ?? "");
      if ((code === "42703" || code === "PGRST204") && ("stock" in dbPayload || "min_quantity" in dbPayload || "delivery_time" in dbPayload || "inventory_mode" in dbPayload)) {
        const { stock, min_quantity, delivery_time, inventory_mode, ...safePayload } = dbPayload;
        ({ error } = await (supabase as any).from("products").update(safePayload).eq("id", id));
      }
      if (error) {
        logProductError("updateProduct", error);
        toast.error(productErrorMessage(error));
        return false;
      }
      if (p.deliveryContent !== undefined || p.deliveryType !== undefined) {
        await (supabase as any).from("product_delivery").upsert({ product_id: id, delivery_type: p.deliveryType || existing.deliveryType, delivery_content: p.deliveryContent ?? existing.deliveryContent ?? null });
      }
      setState((s) => ({
        ...s,
        products: s.products.map((pr) => (pr.id === id ? { ...pr, ...p, approved: isAdmin ? true : (essentialChanged ? false : pr.approved) } : pr)),
      }));
      // Re-read so the seller sees exactly what the database accepted.
      await loadCatalog();
      return true;
    } catch (e: any) {
      logProductError("updateProduct:exception", e);
      toast.error(productErrorMessage(e));
      return false;
    }
  };

  const approveProduct = async (id: number) => {
    const result = await unwrapEdgeCall<{ product?: { id: number }; notification?: string }>(
      await supabase.functions.invoke("moderate-product", { body: { productId: id, approved: true } }),
      "Não foi possível aprovar o anúncio.",
    );
    if (result.errorMessage || !result.data?.product) {
      if (result.errorMessage) toast.error(result.errorMessage);
      await loadCatalog();
      return false;
    }
    await loadCatalog();
    return true;
  };

  const rejectProduct = async (id: number, reason?: string) => {
    const result = await unwrapEdgeCall<{ product?: { id: number }; notification?: string }>(
      await supabase.functions.invoke("moderate-product", { body: { productId: id, approved: false, reason: reason?.trim() || "" } }),
      "Não foi possível reprovar o anúncio.",
    );
    if (result.errorMessage || !result.data?.product) {
      if (result.errorMessage) toast.error(result.errorMessage);
      await loadCatalog();
      return false;
    }
    await loadCatalog();
    return true;
  };


  const deleteProduct = async (id: number): Promise<{ ok: boolean; paused: boolean }> => {
    const product = state.products.find((item) => item.id === id);
    const actorId = authUserRef.current?.id;
    if (!product || !actorId || (!isAdmin && product.sellerId !== actorId)) {
      toast.error("Você não tem permissão para remover este anúncio.");
      return { ok: false, paused: false };
    }
    const { data, error } = await (supabase as any).rpc("remove_product", { _product_id: id });
    const status = data && typeof data === "object" ? data.status : null;
    if (error || (status !== "deleted" && status !== "paused")) {
      if (error) logProductError("deleteProduct", error);
      toast.error(error ? productErrorMessage(error) : "Não foi possível confirmar a remoção do anúncio. Atualize a página e tente novamente.");
      await loadCatalog();
      return { ok: false, paused: false };
    }
    // Só informar sucesso depois de reidratar o catálogo persistido no servidor.
    await loadCatalog();
    return { ok: true, paused: status === "paused" };
  };

  const buyProduct = async (id: number, variation?: ProductVariation, quantity?: number, paymentMethod?: string) => {
    const product = state.products.find((p) => p.id === id);
    if (!product || !state.currentUser) return null;
    // unwrapEdgeCall lê o corpo real da resposta: sem isso toda falha virava
    // "Edge Function returned a non-2xx status code" na tela do comprador.
    const res = await unwrapEdgeCall<{ purchase: any }>(
      await supabase.functions.invoke("create-purchase", {
        body: { productId: id, variationId: variation?.id || null, variationName: variation?.name || null, quantity: quantity ?? 1, paymentMethod },
      }),
      "Não foi possível registrar a compra. Tente novamente.",
    );
    if (res.errorMessage || !res.data?.purchase) {
      toast.error(res.errorMessage ?? "Não foi possível registrar a compra. Tente novamente.");
      return null;
    }
    const finalPurchase = mapPurchaseRow(res.data.purchase);
    setState((s) => ({ ...s, purchases: [...s.purchases, finalPurchase] }));
    return finalPurchase.id;
  };

  const savePixCharge = (purchaseId: number, charge: { evopayId: string; qrCodeText: string; expiresAt: string }) => {
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) =>
        p.id === purchaseId ? { ...p, evopayChargeId: charge.evopayId, pixQrCode: charge.qrCodeText, pixExpiresAt: charge.expiresAt } : p
      ),
    }));
  };

  const refreshPurchases = async () => {
    if (!authUserRef.current || !sessionReady) {
      return { ok: false, message: "A sessão ainda está sendo verificada." };
    }
    const result = await unwrapEdgeCall<{ purchases?: any[] }>(
      await supabase.functions.invoke("get-my-purchases", { body: {} }),
      "Não foi possível carregar seus pedidos.",
    );
    if (result.errorMessage) {
      console.warn("[zxmax:purchases:load]", result.errorMessage);
      return { ok: false, message: result.errorMessage };
    }
    const purchases = (result.data?.purchases || []).map(mapPurchaseRow) as Purchase[];
    setState((s) => ({ ...s, purchases }));
    return { ok: true };
  };

  // Orders must be rehydrated from the RLS-protected source after every
  // session restoration. Previously the normal /minhas-compras entry only
  // retained the optimistic state created in this browser tab, so a reload
  // appeared to erase a legitimate pending purchase.
  useEffect(() => {
    if (!authUserId && sessionReady) {
      setState((s) => (s.purchases.length ? { ...s, purchases: [] } : s));
      return;
    }
    if (!authUserId || !sessionReady) return;
    void refreshPurchases();
  }, [authUserId, sessionReady]);

  const markPurchasePaid = (id: number) => {
    void refreshPurchases();
  };

  const approvePurchase = (id: number) => {
    void (async () => {
      try {
        const res = await unwrapEdgeCall<{ success?: boolean; status?: string }>(
          await supabase.functions.invoke("order-action", { body: { orderId: id, action: "approve" } }),
          "Não foi possível aprovar o pedido.",
        );
        if (res.errorMessage) {
          toast.error(res.errorMessage);
          return;
        }
        toast.success(`Pedido #${id} aprovado.`);
        void refreshPurchases();
      } catch (e: any) {
        toast.error(e?.message || "Erro ao aprovar pedido.");
      }
    })();
  };

  const revertPurchase = (id: number) => {
    void (async () => {
      try {
        const res = await unwrapEdgeCall<{ success?: boolean; status?: string }>(
          await supabase.functions.invoke("order-action", { body: { orderId: id, action: "revert" } }),
          "Não foi possível reverter o pedido.",
        );
        if (res.errorMessage) {
          toast.error(res.errorMessage);
          return;
        }
        toast.success(`Pedido #${id} revertido.`);
        void refreshPurchases();
      } catch (e: any) {
        toast.error(e?.message || "Erro ao reverter pedido.");
      }
    })();
  };

  const refreshWithdrawals = React.useCallback(async () => {
    const authUser = authUserRef.current;
    if (!authUser) {
      setState((s) => ({ ...s, withdrawals: [] }));
      return;
    }
    const { data, error } = await (supabase as any)
      .from("withdrawals")
      .select("id,user_id,user_email,amount,method,status,created_at,pix_key,rejection_reason,provider_tx_id,retry_of,fee,net_amount")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[zxmax:withdrawals]", error);
      return;
    }
    setState((s) => ({ ...s, withdrawals: ((data || []) as any[]).map(mapWithdrawalRow) }));
  }, []);

  const refreshBalance = React.useCallback(async () => {
    const authUser = authUserRef.current;
    if (!authUser) return;
    const { data, error } = await (supabase as any).rpc("withdrawable_balance", { _user_id: authUser.id });
    if (error) {
      console.error("[zxmax:balance]", error);
      return;
    }
    const balance = Number(data);
    if (!Number.isFinite(balance)) return;
    setState((s) => ({
      ...s,
      userBalances: { ...s.userBalances, [authUser.id]: balance },
      userEarnings: { ...s.userEarnings, [authUser.id]: balance },
    }));
  }, []);

  useEffect(() => {
    if (!authUserId) {
      setState((s) => ({ ...s, withdrawals: [] }));
      return;
    }
    void refreshWithdrawals();
    void refreshBalance();
  }, [authUserId, refreshWithdrawals, refreshBalance]);

  const requestWithdraw = async (method: "normal" | "flex", options?: { retryOf?: number; amount?: number }) => {
    if (!state.currentUser || state.currentUser.balance <= 0) return;
    const configured = method === "flex"
      ? { min: state.config.smallWithdrawMin, fee: state.config.withdrawFee + state.config.smallWithdrawExtraFee }
      : { min: state.config.withdrawMin, fee: state.config.withdrawFee };
    const availableTotals = withdrawTotals(state.currentUser.balance, configured);
    const amount = options?.amount == null ? availableTotals.balance : Math.round(Number(options.amount) * 100) / 100;
    const requestedTotals = withdrawTotals(amount, configured);
    if (!requestedTotals.canWithdraw) throw new Error(requestedTotals.reason || "O valor solicitado não atende às regras de saque.");
    if (amount > availableTotals.balance) throw new Error("Saldo disponível insuficiente para este saque.");

    const minuteBucket = new Date().toISOString().slice(0, 16);
    const idempotencyKey = `${state.currentUser.id}:${amount}:${method}:${options?.retryOf ?? "new"}:${minuteBucket}`;
    const { error } = await (supabase as any).rpc("request_withdrawal", {
      _amount: amount,
      _method: method,
      _idempotency_key: idempotencyKey,
      _retry_of: options?.retryOf ?? null,
      _pix_key: state.currentUser.pixKey || null,
    });
    if (error) throw new Error(error.message || "Não foi possível solicitar o saque");
    await Promise.all([refreshWithdrawals(), refreshBalance()]);
  };

  const approveWithdraw = async (id: number) => {
    const withdrawal = state.withdrawals.find((w) => w.id === id);
    if (!withdrawal) throw new Error("Saque não encontrado.");
    if (withdrawal.status === "approved") {
      await Promise.all([refreshWithdrawals(), refreshBalance()]);
      return;
    }
    if (withdrawal.status !== "pending") throw new Error("Este saque não está pendente.");
    if (!withdrawal.pixKey) throw new Error("Este saque não tem chave Pix cadastrada.");

    const res = await unwrapEdgeCall<{ success?: boolean; id?: string; status?: string; alreadyProcessed?: boolean }>(
      await supabase.functions.invoke("process-withdrawal", { body: { withdrawalId: id } }),
      "Não foi possível processar o saque.",
    );
    if (res.errorMessage || !res.data?.success) {
      throw new Error(res.errorMessage || "Não foi possível processar o saque.");
    }
    await Promise.all([refreshWithdrawals(), refreshBalance()]);
  };

  const rejectWithdraw = async (id: number, reason?: string) => {
    const { error } = await (supabase as any).rpc("reject_withdrawal", {
      _id: id,
      _reason: reason || "",
    });
    if (error) throw new Error(error.message || "Erro ao recusar o saque");
    await refreshWithdrawals();
  };

  const updateConfig = (c: Partial<AppConfig>) =>
    setState((s) => ({ ...s, config: { ...s.config, ...c } }));

  const updateProfile = (name: string) =>
    setState((s) => ({
      ...s,
      currentUser: s.currentUser
        ? { ...s.currentUser, name, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}` }
        : null,
    }));

  const banUser = async (identifier: string, reason = "Violação das regras da plataforma") => {
    const normalized = identifier.trim();
    if (!normalized) return false;
    const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "ban_user", identifier: normalized, reason } });
    if (error || data?.error) {
      toast.error("Não foi possível concluir o banimento. Tente novamente.");
      return false;
    }

    setState((s) => ({
      ...s,
      bannedUsers: s.bannedUsers.includes(normalized) ? s.bannedUsers : [...s.bannedUsers, normalized],
    }));
    return true;
  };

  const unbanUser = async (identifier: string) => {
    const normalized = identifier.trim();
    if (!normalized) return false;
    const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "unban_user", identifier: normalized } });
    if (error || data?.error) return false;

    setState((s) => ({ ...s, bannedUsers: s.bannedUsers.filter((e) => e !== normalized) }));
    return true;
  };

  const refreshTickets = React.useCallback(async () => {
    if (!authUserRef.current) {
      setState((s) => ({ ...s, tickets: [] }));
      return;
    }

    const { data, error } = await (supabase as any)
      .from("support_tickets")
      .select("id,user_id,user_email,subject,status,messages,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("[zxmax:support:load]", error);
      return;
    }

    const tickets: SupportTicket[] = (data || []).map((row: any) => ({
      id: Number(row.id),
      userEmail: String(row.user_email || ""),
      userId: String(row.user_id || ""),
      subject: String(row.subject || "Atendimento"),
      status: row.status === "closed" ? "closed" : "open",
      messages: Array.isArray(row.messages)
        ? row.messages.map((message: any) => ({
            from: String(message?.from || "Equipe ZXMAX"),
            text: String(message?.text || ""),
            date: String(message?.date || row.updated_at || row.created_at || new Date().toISOString()),
          }))
        : [],
    }));
    setState((s) => ({ ...s, tickets }));
  }, [authUserId, isAdmin, isSupport]);

  useEffect(() => {
    void refreshTickets();
  }, [refreshTickets]);

  const addTicket = async (subject: string, message: string) => {
    const cleanSubject = subject.trim().slice(0, 140);
    const cleanMessage = message.trim().slice(0, 2000);
    if (!state.currentUser || !cleanSubject || !cleanMessage) return false;

    const { error } = await (supabase as any).rpc("open_support_ticket", {
      _subject: cleanSubject,
      _text: cleanMessage,
    });
    if (error) {
      console.warn("[zxmax:support:create]", error);
      return false;
    }
    await refreshTickets();
    return true;
  };

  const replyTicket = async (id: number, text: string) => {
    const clean = text.trim();
    if (!state.currentUser || !clean) return false;
    const { error } = await (supabase as any).rpc("reply_support_ticket", {
      _ticket_id: id,
      _text: clean.slice(0, 2000),
    });
    if (error) {
      console.warn("[zxmax:support:reply]", error);
      return false;
    }
    await refreshTickets();
    return true;
  };

  const closeTicket = async (id: number) => {
    const { error } = await (supabase as any).rpc("close_support_ticket", { _ticket_id: id });
    if (error) {
      console.warn("[zxmax:support:close]", error);
      return false;
    }
    await refreshTickets();
    return true;
  };

  const resolveTicket = closeTicket;

  const sendPurchaseMessage = async (purchaseId: number, _from: string, text: string) => {
    const { data, error } = await supabase.functions.invoke("order-action", {
      body: { orderId: purchaseId, action: "send_message", message: text },
    });
    if (error || data?.error) return false;
    await refreshPurchases();
    return true;
  };

  const confirmDelivery = async (purchaseId: number) => {
    const { data, error } = await supabase.functions.invoke("order-action", { body: { orderId: purchaseId, action: "confirm_delivery" } });
    if (error || data?.error) return false;
    await refreshPurchases();
    return true;
  };

  const confirmOrderReceipt = async (purchaseId: number) => {
    const { data, error } = await supabase.functions.invoke("order-action", { body: { orderId: purchaseId, action: "confirm_receipt" } });
    if (error || data?.error) return false;
    await refreshPurchases();
    return true;
  };

  const sellerRefundOrder = async (purchaseId: number, reason: string): Promise<{ success: boolean; error?: string }> => {
    const res = await unwrapEdgeCall<{ success: boolean; error?: string; status?: string }>(
      await supabase.functions.invoke("order-action", {
        body: { orderId: purchaseId, action: "seller_refund", reason },
      }),
      "Não foi possível processar o reembolso. Tente novamente.",
    );
    if (res.errorMessage) {
      return { success: false, error: res.errorMessage };
    }
    await refreshPurchases();
    return { success: true };
  };

  const openDispute = async (purchaseId: number, reason: string) => {
    const { data, error } = await supabase.functions.invoke("order-action", { body: { orderId: purchaseId, action: "open_dispute", reason } });
    if (error || data?.error) return false;
    await refreshPurchases();
    return true;
  };

  const reviewPurchase = async (purchaseId: number, stars: number, comment: string): Promise<boolean> => {
    const cleanComment = (comment || "").trim();
    if (cleanComment.length < 3) {
      toast.error("Escreva um comentário com pelo menos 3 caracteres.");
      return false;
    }
    const { data: createdReview, error } = await (supabase as any).rpc("create_product_review", {
      _purchase_id: purchaseId,
      _stars: stars,
      _comment: cleanComment,
    });
    if (error) {
      // Detalhe técnico só no console; o usuário recebe texto seguro e fixo.
      console.error("[zxmax:review]", error);
      const code = String(error?.code ?? "");
      const msg = code === "42501" ? "Faça login para avaliar."
        : code === "P0001" ? "Só é possível avaliar após a confirmação do recebimento."
        : code === "23505" ? "Você já avaliou este pedido."
        : code === "22023" ? "Avaliação inválida. Confira as estrelas e o comentário."
        : (error?.message || "Não foi possível enviar a avaliação. Tente novamente.");
      toast.error(msg);
      return false;
    }
    if (createdReview?.id) {
      void supabase.functions.invoke("notify-product-event", { body: { eventType: "product_review", eventId: createdReview.id } });
    }
    // Atualiza o estado local imediatamente e re-lê o catálogo para os agregados.
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) =>
        p.id === purchaseId ? { ...p, reviewed: true, reviewStars: stars, reviewComment: cleanComment } : p
      ),
    }));
    await loadCatalog();
    return true;
  };

  const loadProductReviews = async (productId: number) => {
    const { data, error } = await (supabase as any)
      .from("product_reviews")
      .select("id, stars, comment, created_at, buyer_id")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[zxmax:reviews:load]", error);
      return [];
    }
    const reviews = (data || []) as Array<{ id: number; stars: number; comment: string; created_at: string; buyer_id: string }>;
    // Resolve nomes dos compradores a partir do diretório (sem expor e-mails).
    return reviews.map((r) => ({
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      createdAt: r.created_at,
      buyerName: state.userDirectory?.[r.buyer_id]?.name || "Comprador",
    }));
  };

  const refreshGlobalNotices = React.useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("global_notices")
      .select("id,text,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.warn("[zxmax:notices:load]", error);
      return false;
    }
    const notices: GlobalNotice[] = (data || []).map((row: any) => ({
      id: String(row.id),
      text: String(row.text || ""),
      date: String(row.created_at || new Date().toISOString()),
    }));
    setState((s) => ({ ...s, globalNotices: notices }));
    return true;
  }, []);

  useEffect(() => {
    void refreshGlobalNotices();
  }, [refreshGlobalNotices]);

  const setGlobalNotice = (notice: string) => updateConfig({ globalNotice: notice });

  const publishNotice = async (text: string) => {
    const clean = text.trim();
    if (!clean || !authUserRef.current) return false;
    const { error } = await (supabase as any).from("global_notices").insert({
      text: clean.slice(0, 1000),
      created_by: authUserRef.current.id,
    });
    if (error) {
      console.warn("[zxmax:notices:publish]", error);
      return false;
    }
    await refreshGlobalNotices();
    return true;
  };

  const updatePixKey = (key: string) =>
    setState((s) => ({
      ...s,
      currentUser: s.currentUser ? { ...s.currentUser, pixKey: key } : null,
    }));

  const sendAdminChat = (from: string, text: string) =>
    setState((s) => ({
      ...s,
      adminChat: [...(s.adminChat || []), { from, text, date: new Date().toISOString() }],
    }));

  const addProductQuestion = (productId: number, text: string) => {
    if (!state.currentUser) return;
    const q: ProductQuestion = {
      id: Date.now(),
      userEmail: state.currentUser.email,
      userName: state.currentUser.name,
      text,
      date: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      products: s.products.map((p) =>
        p.id === productId ? { ...p, questions: [...(p.questions || []), q] } : p
      ),
    }));
  };

  const answerProductQuestion = (productId: number, questionId: number, answer: string) => {
    setState((s) => ({
      ...s,
      products: s.products.map((p) =>
        p.id === productId
          ? {
              ...p,
              questions: (p.questions || []).map((q) =>
                q.id === questionId ? { ...q, answer, answerDate: new Date().toISOString() } : q
              ),
            }
          : p
      ),
    }));
  };

  const deleteNotice = async (id: string) => {
    const { error } = await (supabase as any).from("global_notices").delete().eq("id", id);
    if (error) {
      console.warn("[zxmax:notices:delete]", error);
      return false;
    }
    setState((s) => ({ ...s, globalNotices: (s.globalNotices || []).filter((n) => n.id !== id) }));
    return true;
  };

  const createUserTag = async (name: string, color: string, iconUrl = "") => {
    const { error } = await (supabase as any).rpc("create_admin_user_tag", { _name: name.trim(), _color: color, _icon_url: iconUrl.trim() });
    if (error) { console.warn("[zxmax:tags:create]", error); return false; }
    await refreshUserTags();
    return true;
  };

  const deleteUserTag = async (id: string) => {
    const { error } = await (supabase as any).rpc("delete_admin_user_tag", { _tag_id: id });
    if (error) { console.warn("[zxmax:tags:delete]", error); return false; }
    await refreshUserTags();
    return true;
  };

  const assignUserTag = async (publicId: string, tagId: string) => {
    const normalized = Number(publicId);
    if (!Number.isSafeInteger(normalized) || normalized <= 0) return false;
    const { error } = await (supabase as any).rpc("assign_admin_user_tag", { _public_id: normalized, _tag_id: tagId });
    if (error) { console.warn("[zxmax:tags:assign]", error); return false; }
    await refreshUserTags();
    return true;
  };

  const unassignUserTag = async (publicId: string, tagId: string) => {
    const normalized = Number(publicId);
    if (!Number.isSafeInteger(normalized) || normalized <= 0) return false;
    const { error } = await (supabase as any).rpc("unassign_admin_user_tag", { _public_id: normalized, _tag_id: tagId });
    if (error) { console.warn("[zxmax:tags:unassign]", error); return false; }
    await refreshUserTags();
    return true;
  };

  const verifyUser = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "verify_user", userId } });
      if (!error && !data?.error) {
        setState(s => ({
          ...s,
          currentUser: s.currentUser?.id === userId ? { ...s.currentUser, isVerified: true } : s.currentUser,
          userDirectory: {
            ...(s.userDirectory || {}),
            ...(s.userDirectory?.[userId] ? { [userId]: { ...s.userDirectory[userId], isVerified: true } } : {}),
          },
        }));
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const submitSellerDocument = (filePath: string, fileName: string) => {
    if (!state.currentUser) return;
    const doc: SellerDocument = { id: String(Date.now()), userId: state.currentUser.id, userPublicId: state.currentUser.publicId, userEmail: state.currentUser.email, filePath, fileName, status: "pending", createdAt: new Date().toISOString() };
    void (supabase as any).from("seller_documents").insert({ user_id: doc.userId, file_path: filePath, file_name: fileName, document_type: "rg_ou_certidao", status: "pending" });
    setState(s => ({ ...s, sellerDocuments: [doc, ...(s.sellerDocuments || [])] }));
  };

  const toggleDark = () => setIsDark((d) => !d);

  return (
    <StoreContext.Provider
      value={{
        state, login, logout, addProduct, updateProduct, approveProduct, rejectProduct, deleteProduct,
        refreshProducts: loadCatalog,
        catalogStatus,
        buyProduct, savePixCharge, refreshPurchases, markPurchasePaid, approvePurchase, revertPurchase, requestWithdraw,
        approveWithdraw, rejectWithdraw, updateConfig, updateProfile,
        banUser, unbanUser, addTicket, replyTicket, closeTicket, resolveTicket,
        setGlobalNotice, publishNotice, updatePixKey, sendAdminChat,
        sendPurchaseMessage, confirmDelivery, confirmOrderReceipt, sellerRefundOrder, openDispute, reviewPurchase, loadProductReviews,
        addProductQuestion, answerProductQuestion,
        deleteNotice, refreshUserTags, createUserTag, deleteUserTag, assignUserTag, unassignUserTag,
        verifyUser, submitSellerDocument, isDark, toggleDark,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
