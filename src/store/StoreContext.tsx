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
import { WITHDRAW_FEE, WITHDRAW_MIN, withdrawTotals } from "@/lib/fees";
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
}

export interface GlobalNotice {
  id: number;
  text: string;
  date: string;
}

export interface AdminChatMessage {
  from: string;
  text: string;
  date: string;
}

export interface ProductVariation {
  name: string;
  price: number;
  stock?: number;
  minQuantity?: number;
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
  deliveryType: "auto" | "manual";
  deliveryContent?: string;
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
  paymentProvider?: "zennith_pix" | "vexopay_pix" | "crypto" | "card" | "boleto";
  messages: PurchaseMessage[];
  reviewed?: boolean;
  reviewStars?: number;
  reviewComment?: string;
  variationName?: string;
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
  method: "normal" | "instant";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  pixKey?: string;
  rejectionReason?: string;
  providerTxId?: string;
  retryOf?: number | null;
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
}

export interface AppConfig {
  commission: number;
  instantFee: number;
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
  addProduct: (p: Omit<Product, "id" | "sales" | "rating" | "approved" | "sellerId">) => Promise<boolean>;
  updateProduct: (id: number, p: Partial<Omit<Product, "id" | "sellerId">>) => Promise<boolean>;
  approveProduct: (id: number) => Promise<boolean>;
  rejectProduct: (id: number, reason?: string) => Promise<boolean>;
  refreshProducts: () => Promise<void>;
  /** Real network state of the catalog, so the store can show a skeleton, an
   * error with retry, or a truthful empty state instead of a silent zero. */
  catalogStatus: CatalogStatus;
  deleteProduct: (id: number) => Promise<{ paused: boolean }>;
  buyProduct: (id: number, variation?: ProductVariation, quantity?: number, paymentMethod?: string) => Promise<number | null>;
  savePixCharge: (purchaseId: number, charge: { evopayId: string; qrCodeText: string; expiresAt: string }) => void;
  refreshPurchases: () => Promise<void>;
  markOrderDelivered: (orderId: number) => Promise<boolean>;
  markPurchasePaid: (purchaseId: number) => void;
  approvePurchase: (id: number) => void;
  revertPurchase: (id: number) => void;
  requestWithdraw: (method: "normal" | "instant", options?: { retryOf?: number }) => Promise<void>;
  approveWithdraw: (id: number) => Promise<void>;
  rejectWithdraw: (id: number, reason?: string) => Promise<void>;
  updateConfig: (c: Partial<AppConfig>) => void;
  updateProfile: (name: string) => void;
  banUser: (identifier: string, reason?: string) => Promise<boolean>;
  unbanUser: (identifier: string) => Promise<boolean>;
  addTicket: (subject: string, message: string) => void;
  replyTicket: (id: number, text: string) => void;
  closeTicket: (id: number) => void;
  resolveTicket: (id: number) => void;
  setGlobalNotice: (notice: string) => void;
  publishNotice: (text: string) => void;
  updatePixKey: (key: string) => void;
  sendAdminChat: (from: string, text: string) => void;
  sendPurchaseMessage: (purchaseId: number, from: string, text: string) => void;
  confirmDelivery: (purchaseId: number) => Promise<boolean>;
  confirmOrderReceipt: (purchaseId: number) => Promise<boolean>;
  sellerRefundOrder: (purchaseId: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  checkAutoReleaseOrders: () => Promise<void>;
  openDispute: (purchaseId: number, reason: string) => Promise<boolean>;
  reviewPurchase: (purchaseId: number, stars: number, comment: string) => Promise<boolean>;
  loadProductReviews: (productId: number) => Promise<Array<{ id: number; stars: number; comment: string; createdAt: string; buyerName: string }>>;
  addProductQuestion: (productId: number, text: string) => void;
  answerProductQuestion: (productId: number, questionId: number, answer: string) => void;
  deleteNotice: (id: number) => void;
  refreshUserTags: () => Promise<void>;
  createUserTag: (name: string, color: string) => Promise<boolean>;
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
  discordLink: "https://discord.gg/zxmax",
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
  buyerEmail: p.buyer_email,
  buyerId: p.buyer_id,
  buyerPublicId: p.buyer_public_id,
  sellerEmail: p.seller_email,
  sellerId: p.seller_id,
  sellerPublicId: p.seller_public_id,
  status: p.status,
  createdAt: p.created_at,
  updatedAt: p.updated_at || undefined,
  amount: Number(p.amount),
  paymentProvider: p.payment_provider || undefined,
  messages: p.messages || [],
  reviewed: p.reviewed,
  reviewStars: p.review_stars || undefined,
  reviewComment: p.review_comment || undefined,
  variationName: p.variation_name || undefined,
  evopayChargeId: p.evopay_charge_id || undefined,
  pixQrCode: p.pix_qr_code || undefined,
  pixExpiresAt: p.pix_expires_at || undefined,
  deliveredPendingAt: p.delivered_pending_at || undefined,
  refundReason: p.refund_reason || undefined,
  refundedAt: p.refunded_at || undefined,
  sellerReleased: !!p.seller_released,
  releasedAt: p.released_at || undefined,
});

/** Persist stock/minQuantity inside variation JSON so a missing column never hides them. */
const mapVariation = (v: ProductVariation) => {
  const out: Record<string, unknown> = { name: v.name, price: sanitizePrice(v.price) };
  const stock = Number(v.stock);
  if (Number.isFinite(stock) && stock >= 0) out.stock = Math.trunc(stock);
  const minQ = Number(v.minQuantity);
  if (Number.isFinite(minQ) && minQ > 0) out.minQuantity = Math.trunc(minQ);
  return out;
};

const mapWithdrawalRow = (w: any): Withdrawal => ({
  id: Number(w.id),
  userEmail: w.user_email || "",
  userId: w.user_id,
  amount: Number(w.amount),
  method: w.method === "instant" ? "instant" : "normal",
  status: w.status,
  createdAt: w.created_at,
  pixKey: w.pix_key || undefined,
  rejectionReason: w.rejection_reason || undefined,
  providerTxId: w.provider_tx || w.provider_tx_id || undefined,
  retryOf: w.retry_of ?? null,
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user: authUser, profile, isAdmin, signOut } = useAuth();
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
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile?.display_name || authUser.email || "")}`,
        isAdmin,
        pixKey: profile?.pix_key || "",
        isVerified: profile?.is_verified_seller || false,
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
            [authUser.id]: { userId: authUser.id, publicId: userPublicId, email: user.email || "", name: user.name, avatar: user.avatar, isVerified: user.isVerified },
          },
        };
      });
    } else {
      // No auth user, clear currentUser
      setState((s) => ({ ...s, currentUser: null }));
    }
  }, [authUserId, profile, isAdmin, state.userBalances, state.userEarnings]);

  useEffect(() => {
    void (async () => {
      const { data: profiles } = await (supabase as any)
        .from("profiles_public")
        .select("user_id, public_id, display_name, avatar_url, is_verified_seller");
      const directory = ((profiles || []) as any[]).reduce((acc, p) => {
        acc[p.user_id] = { userId: p.user_id, publicId: String(p.public_id || ""), email: "", name: p.display_name || "Usuário", avatar: p.avatar_url || undefined, isVerified: !!p.is_verified_seller };
        return acc;
      }, {} as Record<string, UserDirectoryEntry>);

      setState((s) => ({ ...s, userDirectory: { ...(s.userDirectory || {}), ...directory } }));
    })();
  }, [authUserId]);

  const refreshUserTags = React.useCallback(async () => {
    if (!isAdmin) {
      setState((s) => ({ ...s, userTags: [], userTagAssignments: {} }));
      return;
    }
    const { data, error } = await (supabase as any).rpc("get_admin_user_tags");
    if (error) {
      console.warn("[zxmax:tags:load]", error);
      return;
    }
    const tags = Array.isArray(data?.tags)
      ? data.tags.map((tag: any) => ({ id: String(tag.id), name: String(tag.name || ""), color: String(tag.color || "#8b5cf6") }))
      : [];
    const assignments = data?.assignments && typeof data.assignments === "object"
      ? Object.fromEntries(Object.entries(data.assignments).map(([publicId, tagIds]) => [publicId, Array.isArray(tagIds) ? tagIds.map(String) : []]))
      : {};
    setState((s) => ({ ...s, userTags: tags, userTagAssignments: assignments }));
  }, [isAdmin]);

  useEffect(() => { void refreshUserTags(); }, [refreshUserTags]);

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

  const addProduct = async (p: Omit<Product, "id" | "sales" | "rating" | "approved" | "sellerId">): Promise<boolean> => {
    const authUser = authUserRef.current;
    if (!state.currentUser || !authUser) {
      toast.error("Sua sessão expirou. Entre novamente para publicar o anúncio.");
      return false;
    }

    // Client-side guards first, so obvious problems never reach the database
    // and the seller gets a precise message instead of a generic failure.
    const price = parsePriceInput(p.price);
    if (!p.name?.trim()) { toast.error("Informe o nome do anúncio."); return false; }
    if (price < MIN_PRODUCT_PRICE) {
      toast.error(`O preço mínimo é R$ ${MIN_PRODUCT_PRICE.toFixed(2).replace(".", ",")}.`);
      return false;
    }
    if (!state.currentUser.isVerified && !isAdmin) {
      toast.error("Sua conta ainda não está verificada como vendedor. Conclua a verificação para anunciar.");
      return false;
    }

    // `approved` is decided by the database (trigger + RLS). We only send the
    // intent; a seller sending `true` is rejected server-side, never trusted.
    const base: Record<string, unknown> = {
      seller_id: authUser.id,
      seller_public_id: state.currentUser.publicId,
      seller_name: state.currentUser.name,
      seller_email: state.currentUser.email,
      name: p.name.trim(),
      price,
      category: p.category,
      image: p.image,
      banner: p.banner || null,
      description: p.description || "",
      delivery_type: p.deliveryType,
      variations: (p.variations || []).map(mapVariation),
      questions: [],
      approved: isAdmin,
    };
    const optionalColumns = {
      ...(p.stock !== undefined ? { stock: p.stock } : {}),
      ...(p.minQuantity !== undefined ? { min_quantity: p.minQuantity } : {}),
      ...(p.deliveryTime ? { delivery_time: p.deliveryTime } : {}),
    };

    // Attempt order narrows the payload only for *schema/grant* problems on
    // older databases. Every other error is reported as-is.
    const attempts: Record<string, unknown>[] = [
      { ...base, ...optionalColumns },
      base,
      (() => { const { approved, ...rest } = base; return rest; })(),
      (() => { const { approved, seller_email, ...rest } = base; return rest; })(),
    ];

    let created: { id: number; approved: boolean } | null = null;
    let lastError: any = null;
    for (const payload of attempts) {
      const { data, error } = await (supabase as any)
        .from("products")
        .insert(payload)
        .select("id,approved")
        .maybeSingle();
      if (!error && data?.id) {
        created = { id: Number(data.id), approved: !!data.approved };
        break;
      }
      lastError = error;
      logProductError("addProduct:insert", error);
      // Only a missing column / column-grant problem justifies a narrower retry.
      const code = String(error?.code ?? "");
      const retriable = code === "42703" || code === "PGRST204" || code === "42501";
      if (!retriable) break;
    }

    if (!created) {
      toast.error(productErrorMessage(lastError));
      return false;
    }

    // Delivery content lives in `product_delivery`, never in the public table.
    if (p.deliveryContent || p.deliveryType === "auto") {
      const { error: deliveryError } = await (supabase as any)
        .from("product_delivery")
        .upsert({ product_id: created.id, delivery_type: p.deliveryType, delivery_content: p.deliveryContent || null });
      if (deliveryError) {
        logProductError("addProduct:delivery", deliveryError);
        toast.warning("Anúncio criado, mas o conteúdo de entrega automática não foi salvo. Edite o anúncio para tentar de novo.");
      }
    }

    // Reload from the database so the seller sees the row that really exists
    // (with the approval state the server decided), not an optimistic guess.
    await loadCatalog();
    toast.success(created.approved ? "Anúncio publicado!" : "Anúncio criado! Aguardando aprovação da moderação.");
    return true;
  };

  const updateProduct = async (id: number, p: Partial<Omit<Product, "id" | "sellerId">>) => {
    const existing = state.products.find((pr) => pr.id === id);
    if (!existing) return false;
    // If price or delivery content changed, send back to review - but admin edits stay approved
    const essentialChanged =
      (p.price !== undefined && p.price !== existing.price) ||
      (p.deliveryContent !== undefined && p.deliveryContent !== existing.deliveryContent) ||
      (p.deliveryType !== undefined && p.deliveryType !== existing.deliveryType);
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
      if (error && ("stock" in dbPayload || "min_quantity" in dbPayload || "delivery_time" in dbPayload)) {
        const { stock, min_quantity, delivery_time, ...safePayload } = dbPayload;
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
    const { error } = await (supabase as any).rpc("moderate_product", { _product_id: id, _approved: true, _reason: null });
    if (error) {
      logProductError("approveProduct", error);
      toast.error(productErrorMessage(error));
      await loadCatalog();
      return false;
    }
    setState((s) => ({
      ...s,
      products: s.products.map((p) => (p.id === id ? { ...p, approved: true } : p)),
    }));
    await loadCatalog();
    return true;
  };

  const rejectProduct = async (id: number, reason?: string) => {
    const { error } = await (supabase as any).rpc("moderate_product", { _product_id: id, _approved: false, _reason: reason?.trim() || null });
    if (error) {
      logProductError("rejectProduct", error);
      toast.error(productErrorMessage(error));
      return false;
    }
    await loadCatalog();
    return true;
  };


  const deleteProduct = async (id: number): Promise<{ paused: boolean }> => {
    // If product has orders, pause (unapprove) instead of deleting to preserve history
    const hasOrders = state.purchases.some((pu) => pu.productId === id);
    if (hasOrders) {
      const { error } = await (supabase as any).from("products").update({ approved: false }).eq("id", id);
      if (error) { logProductError("deleteProduct:pause", error); toast.error(productErrorMessage(error)); return { paused: true }; }
      setState((s) => ({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, approved: false } : p)) }));
      return { paused: true };
    }
    const { error } = await (supabase as any).from("products").delete().eq("id", id);
    if (error) { logProductError("deleteProduct", error); toast.error(productErrorMessage(error)); return { paused: false }; }
    // Deleted rows must stay deleted — never re-added by a stale merge.
    setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) }));
    return { paused: false };
  };

  const buyProduct = async (id: number, variation?: ProductVariation, quantity?: number, paymentMethod?: string) => {
    const product = state.products.find((p) => p.id === id);
    if (!product || !state.currentUser) return null;
    // unwrapEdgeCall lê o corpo real da resposta: sem isso toda falha virava
    // "Edge Function returned a non-2xx status code" na tela do comprador.
    const res = await unwrapEdgeCall<{ purchase: any }>(
      await supabase.functions.invoke("create-purchase", {
        body: { productId: id, variationName: variation?.name || null, quantity: quantity ?? 1, paymentMethod },
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
    const { data } = await (supabase as any).from("purchases").select("id,product_id,buyer_id,buyer_email,buyer_public_id,seller_id,seller_email,seller_public_id,status,amount,payment_provider,messages,reviewed,review_stars,review_comment,variation_name,created_at,updated_at,evopay_charge_id,pix_qr_code,pix_expires_at,delivered_pending_at,refund_reason,refunded_at,seller_released,released_at").order("created_at", { ascending: false });
    if (!data) return;
    const purchases = (data as any[]).map(mapPurchaseRow) as Purchase[];
    // Check if any delivered_pending_confirmation order is > 3 days old and auto-release
    const hasPendingAutoRelease = purchases.some(
      (p) => p.status === "delivered_pending_confirmation" && p.deliveredPendingAt && (Date.now() - new Date(p.deliveredPendingAt).getTime() >= 3 * 24 * 60 * 60 * 1000)
    );
    if (hasPendingAutoRelease) {
      await checkAutoReleaseOrders();
    }
    setState((s) => ({ ...s, purchases }));
  };

  const markOrderDelivered = async (orderId: number) => {
    const { data, error } = await supabase.functions.invoke("mark-order-delivered", { body: { orderId } });
    if (error || data?.error) return false;
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) => (p.id === orderId ? { ...p, status: "delivered" as const } : p)),
    }));
    return true;
  };

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
      .select("id,user_id,user_email,amount,method,status,created_at,pix_key,rejection_reason,provider_tx,retry_of,fee,net_amount")
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

  const requestWithdraw = async (method: "normal" | "instant", options?: { retryOf?: number }) => {
    if (!state.currentUser || state.currentUser.balance <= 0) return;
    const totals = withdrawTotals(state.currentUser.balance);
    if (!totals.canWithdraw) throw new Error(totals.reason || `O saque mínimo é R$ ${WITHDRAW_MIN.toFixed(2).replace(".", ",")}.`);
    const amount = totals.balance;
    // Idempotency: the same user + amount + method within the same minute never
    // creates two withdrawals, even if the request is retried on a flaky network.
    const minuteBucket = new Date().toISOString().slice(0, 16);
    const idempotencyKey = `${state.currentUser.id}:${amount}:${method}:${options?.retryOf ?? "new"}:${minuteBucket}`;
    const { error } = await (supabase as any).rpc("request_withdrawal", {
      _amount: amount,
      _method: method,
      _idempotency_key: idempotencyKey,
      _retry_of: options?.retryOf ?? null,
    });
    if (error) throw new Error(error.message || "Não foi possível solicitar o saque");
    await Promise.all([refreshWithdrawals(), refreshBalance()]);
  };

  const approveWithdraw = async (id: number) => {
    const withdrawal = state.withdrawals.find((w) => w.id === id);
    if (!withdrawal?.pixKey) throw new Error("Este saque não tem chave Pix cadastrada.");
    const net = Math.round((Number(withdrawal.amount) - WITHDRAW_FEE) * 100) / 100;
    const res = await unwrapEdgeCall<{ id?: string; status?: string; error?: string }>(
      await supabase.functions.invoke("zennith-withdraw", {
        body: {
          amount: net > 0 ? net : Number(withdrawal.amount),
          pixKey: withdrawal.pixKey,
          clientReference: `zxmax-withdraw-${id}`,
        },
      }),
      "Erro ao processar saque na ZennithPay.",
    );
    if (res.errorMessage || !res.data) {
      // 404 = function ainda não publicada — mensagem honesta em vez de falha genérica.
      if (res.status === 404 || /not found/i.test(res.errorMessage || "")) {
        throw new Error("Função de saque ZennithPay ainda não publicada no Supabase. Publique as edges antes de aprovar saques.");
      }
      throw new Error(res.errorMessage || "Erro ao processar saque na ZennithPay");
    }
    const data = res.data;
    const providerTx = data?.id ? String(data.id) : null;
    const { error: rpcError } = await (supabase as any).rpc("approve_withdrawal", {
      _id: id,
      _provider_tx: providerTx,
    });
    if (rpcError) throw new Error(rpcError.message || "Erro ao aprovar o saque");
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

  const resolveUserId = async (identifier: string) => {
    const normalized = identifier.trim();
    if (!normalized) return null;
    if (/^[0-9]+$/.test(normalized)) {
      const { data } = await (supabase as any).from("profiles").select("user_id").eq("public_id", Number(normalized)).maybeSingle();
      return (data as any)?.user_id || null;
    }
    if (normalized.includes("@") && isAdmin) {
      const { data } = await (supabase as any).from("profiles").select("user_id").eq("email", normalized.toLowerCase()).maybeSingle();
      return (data as any)?.user_id || null;
    }
    return normalized;
  };

  const banUser = async (identifier: string, reason = "Violação das regras da plataforma") => {
    const normalized = identifier.trim();
    if (!normalized) return false;
    const userId = await resolveUserId(normalized);
    if (!userId) return false;

    const { error } = await supabase.from("bans").insert({
      user_id: userId,
      banned_by: authUser?.id || userId,
      reason,
      active: true,
    });
    if (error) {
      toast.error(error.message.includes("administradora") ? "Não é possível banir uma conta administradora." : "Erro ao banir: " + error.message);
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
    const userId = await resolveUserId(normalized);
    if (!userId) return false;

    const { error } = await supabase.from("bans").update({ active: false }).eq("user_id", userId).eq("active", true);
    if (error) return false;

    setState((s) => ({ ...s, bannedUsers: s.bannedUsers.filter((e) => e !== normalized) }));
    return true;
  };

  const addTicket = (subject: string, message: string) => {
    if (!state.currentUser) return;
    const ticket: SupportTicket = {
      id: Date.now(),
      userEmail: state.currentUser.email,
      userId: state.currentUser.id,
      subject,
      messages: [{ from: state.currentUser.email, text: message, date: new Date().toISOString() }],
      status: "open",
    };
    setState((s) => ({ ...s, tickets: [...s.tickets, ticket] }));
  };

  const replyTicket = (id: number, text: string) => {
    if (!state.currentUser) return;
    setState((s) => ({
      ...s,
      tickets: s.tickets.map((t) =>
        t.id === id
          ? { ...t, messages: [...t.messages, { from: state.currentUser!.email, text, date: new Date().toISOString() }] }
          : t
      ),
    }));
  };

  const closeTicket = (id: number) =>
    setState((s) => ({
      ...s,
      tickets: s.tickets.map((t) => (t.id === id ? { ...t, status: "closed" as const } : t)),
    }));

  const resolveTicket = (id: number) =>
    setState((s) => ({
      ...s,
      tickets: s.tickets.map((t) => (t.id === id ? { ...t, status: "closed" as const } : t)),
    }));

  const sendPurchaseMessage = (purchaseId: number, from: string, text: string) =>
    setState((s) => {
      const nextPurchases = s.purchases.map((p) =>
        p.id === purchaseId
          ? { ...p, messages: [...(p.messages || []), { from, text, date: new Date().toISOString() }] }
          : p
      );
      const updated = nextPurchases.find((p) => p.id === purchaseId);
      if (updated) void (supabase as any).from("purchases").update({ messages: updated.messages }).eq("id", purchaseId);
      return {
      ...s,
      purchases: nextPurchases,
      };
    });

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

  const checkAutoReleaseOrders = async () => {
    try {
      await supabase.functions.invoke("order-action", { body: { orderId: 1, action: "check_auto_release" } });
    } catch {}
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
    const { error } = await (supabase as any).rpc("create_product_review", {
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

  const setGlobalNotice = (notice: string) => updateConfig({ globalNotice: notice });

  const publishNotice = (text: string) => {
    if (!text.trim()) return;
    const n: GlobalNotice = { id: Date.now(), text: text.trim(), date: new Date().toISOString() };
    setState((s) => ({ ...s, globalNotices: [n, ...(s.globalNotices || [])] }));
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

  const deleteNotice = (id: number) =>
    setState((s) => ({ ...s, globalNotices: (s.globalNotices || []).filter((n) => n.id !== id) }));

  const createUserTag = async (name: string, color: string) => {
    const { error } = await (supabase as any).rpc("create_admin_user_tag", { _name: name.trim(), _color: color });
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
        buyProduct, savePixCharge, refreshPurchases, markOrderDelivered, markPurchasePaid, approvePurchase, revertPurchase, requestWithdraw,
        approveWithdraw, rejectWithdraw, updateConfig, updateProfile,
        banUser, unbanUser, addTicket, replyTicket, closeTicket, resolveTicket,
        setGlobalNotice, publishNotice, updatePixKey, sendAdminChat,
        sendPurchaseMessage, confirmDelivery, confirmOrderReceipt, sellerRefundOrder, checkAutoReleaseOrders, openDispute, reviewPurchase, loadProductReviews,
        addProductQuestion, answerProductQuestion,
        deleteNotice, refreshUserTags, createUserTag, deleteUserTag, assignUserTag, unassignUserTag,
        verifyUser, submitSellerDocument, isDark, toggleDark,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
