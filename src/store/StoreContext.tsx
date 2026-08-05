import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
}

export interface ProductQuestion {
  id: number;
  userEmail: string;
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
  sellerEmail: string;
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
  status: "pending" | "paid" | "delivered" | "dispute" | "cancelled";
  createdAt: string;
  amount: number;
  messages: PurchaseMessage[];
  reviewed?: boolean;
  reviewStars?: number;
  reviewComment?: string;
  variationName?: string;
  evopayChargeId?: string;
  pixQrCode?: string;
  pixExpiresAt?: string;
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
  id: number;
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
  authMode: "automatic" | "manual";
  discordClientId: string;
  discordClientSecret: string;
  discordRedirectUri: string;
  discordScopes: string;
  discordMode: "automatic" | "manual";
  discordServerLink: string;
  evopayApiKey: string;
  evopayMode: "automatic" | "manual";
  evopayWebhookUrl: string;
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
  userTagAssignments: Record<string, number[]>; // email -> tagIds
  userBalances: Record<string, number>;
  userEarnings: Record<string, number>;
  sellerDocuments: SellerDocument[];
  userDirectory: Record<string, UserDirectoryEntry>;
}

interface StoreContextType {
  state: AppState;
  login: (email: string, name: string) => void;
  logout: () => void;
  addProduct: (p: Omit<Product, "id" | "sales" | "rating" | "approved" | "sellerId">) => void;
  updateProduct: (id: number, p: Partial<Omit<Product, "id" | "sellerId">>) => Promise<boolean>;
  approveProduct: (id: number) => Promise<boolean>;
  rejectProduct: (id: number) => Promise<boolean>;
  refreshProducts: () => Promise<void>;
  deleteProduct: (id: number) => Promise<{ paused: boolean }>;
  buyProduct: (id: number, variation?: ProductVariation) => Promise<number | null>;
  savePixCharge: (purchaseId: number, charge: { evopayId: string; qrCodeText: string; expiresAt: string }) => void;
  refreshPurchases: () => Promise<void>;
  markOrderDelivered: (orderId: number) => Promise<boolean>;
  markPurchasePaid: (purchaseId: number) => void;
  approvePurchase: (id: number) => void;
  revertPurchase: (id: number) => void;
  requestWithdraw: (method: "normal" | "instant") => void;
  approveWithdraw: (id: number) => void;
  rejectWithdraw: (id: number) => void;
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
  confirmDelivery: (purchaseId: number) => void;
  openDispute: (purchaseId: number, reason: string) => void;
  reviewPurchase: (purchaseId: number, stars: number, comment: string) => void;
  addProductQuestion: (productId: number, text: string) => void;
  answerProductQuestion: (productId: number, questionId: number, answer: string) => void;
  deleteNotice: (id: number) => void;
  createUserTag: (name: string, color: string) => void;
  deleteUserTag: (id: number) => void;
  assignUserTag: (email: string, tagId: number) => void;
  unassignUserTag: (email: string, tagId: number) => void;
  verifyUser: (userId: string) => Promise<boolean>;
  saveGatewaySettings: (settings: { evopayApiKey?: string; evopayMode?: string }) => Promise<boolean>;
  submitSellerDocument: (filePath: string, fileName: string) => void;
  reviewSellerDocument: (documentId: string, status: "approved" | "rejected") => void;
  isDark: boolean;
  toggleDark: () => void;
}

const defaultConfig: AppConfig = {
  commission: 10,
  instantFee: 7,
  discordLink: "https://discord.gg/zxmax",
  categories: ["Bots Discord", "Contas", "Scripts", "Assinaturas", "Designs Digitais", "Serviços Online", "Consultoria Virtual", "Keys de Software", "Arquivos"],
  globalNotice: "",
  authMode: "automatic",
  discordClientId: "1485093454517371070",
  discordClientSecret: "",
  discordRedirectUri: typeof window !== "undefined" ? window.location.origin + "/" : "",
  discordScopes: "identify email",
  discordMode: "automatic",
  discordServerLink: "https://discord.gg/zxmax",
  evopayApiKey: "",
  evopayMode: "automatic",
  evopayWebhookUrl: typeof window !== "undefined" ? `https://dbekdedzgkfgtlytrnyw.supabase.co/functions/v1/evopay-webhook` : "",
  rules: "1- Proibido estelionato(golpe).\n2-Proibido lavagem de dinheiro no sistema de saque do site.\n3-Proibido venda de conteúdo adulto, cp, gore ou qualquer conteúdo doloso\n\n**(Toda regra quebrada resultará a suspensão do usuário de 1 semana a permanente sem receber dinheiro de vendas durante a suspensão.)**",
};

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
  amount: Number(p.amount),
  messages: p.messages || [],
  reviewed: p.reviewed,
  reviewStars: p.review_stars || undefined,
  reviewComment: p.review_comment || undefined,
  variationName: p.variation_name || undefined,
  evopayChargeId: p.evopay_charge_id || undefined,
  pixQrCode: p.pix_qr_code || undefined,
  pixExpiresAt: p.pix_expires_at || undefined,
});

const inferPixType = (key: string): string => {
  const k = (key || "").trim();
  if (k.includes("@")) return "email";
  const digits = k.replace(/\D/g, "");
  if (/^\+?\d{12,13}$/.test(k.replace(/[\s()-]/g, "")) || (digits.length >= 12 && digits.length <= 13)) return "phone";
  if (digits.length === 11) return "cpf";
  if (digits.length === 14) return "cnpj";
  return "random";
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user: authUser, profile, isAdmin, signOut } = useAuth();
  const [state, setState] = useState<AppState>(loadState);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("zxmax_dark") === "true";
  });

  // Sync auth user to store state
  useEffect(() => {
    if (authUser && profile) {
      const userPublicId = publicIdFromProfile(profile, authUser.id);
      const user: User = {
        id: authUser.id,
        publicId: userPublicId,
        email: profile.email || authUser.email || "",
        name: profile.display_name || authUser.email?.split("@")[0] || "",
        balance: state.userBalances[authUser.id] || 0,
        earnings: state.userEarnings[authUser.id] || 0,
        avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.display_name || "")}`,
        isAdmin,
        pixKey: profile.pix_key || "",
        isVerified: profile.is_verified_seller,
      };
      setState((s) => ({
        ...s,
        currentUser: user,
        userDirectory: {
          ...(s.userDirectory || {}),
          [authUser.id]: { userId: authUser.id, publicId: userPublicId, email: user.email, name: user.name, avatar: user.avatar, isVerified: user.isVerified },
        },
      }));
    }
  }, [authUser, profile, isAdmin, state.userBalances, state.userEarnings]);

  useEffect(() => {
    void (async () => {
      const profileSource = isAdmin ? "profiles" : "profiles_public";
      const profileSelect = isAdmin
        ? "user_id, public_id, email, display_name, avatar_url, is_verified_seller"
        : "user_id, public_id, display_name, avatar_url, is_verified_seller";
      const { data: profiles } = await (supabase as any).from(profileSource).select(profileSelect);
      const directory = ((profiles || []) as any[]).reduce((acc, p) => {
        acc[p.user_id] = { userId: p.user_id, publicId: String(p.public_id || ""), email: p.email || "", name: p.display_name || p.email?.split("@")[0] || "Usuário", avatar: p.avatar_url || undefined, isVerified: !!p.is_verified_seller };
        return acc;
      }, {} as Record<string, UserDirectoryEntry>);

      const { data: docs } = authUser
        ? await (supabase as any).from("seller_documents").select("id, user_id, file_path, file_name, status, created_at").order("created_at", { ascending: false })
        : { data: [] };
      const sellerDocuments = ((docs || []) as any[]).map((d) => ({
        id: d.id,
        userId: d.user_id,
        userPublicId: directory[d.user_id]?.publicId || d.user_id,
        userEmail: directory[d.user_id]?.email || "",
        filePath: d.file_path,
        fileName: d.file_name || "Documento",
        status: d.status || "pending",
        createdAt: d.created_at,
      }));

      setState((s) => ({ ...s, userDirectory: { ...(s.userDirectory || {}), ...directory }, sellerDocuments }));
    })();
  }, [authUser, isAdmin]);

  // Load admin-configurable gateway settings (only readable by admins via RLS)
  useEffect(() => {
    if (!authUser || !isAdmin) return;
    void (async () => {
      const { data } = await (supabase as any).from("app_settings").select("key, value").eq("key", "evopay").maybeSingle();
      if (data?.value) {
        setState((s) => ({
          ...s,
          config: {
            ...s.config,
            evopayMode: data.value.mode || s.config.evopayMode,
            evopayApiKey: data.value.apiKey || s.config.evopayApiKey,
          },
        }));
      }
    })();
  }, [authUser, isAdmin]);



  const loadCatalog = React.useCallback(async () => {
    const productSource = authUser ? "products" : "products_public";
    const [{ data: dbProducts }, { data: dbPurchases }, { data: dbWithdrawals }, { data: deliveryRows }] = await Promise.all([
      (supabase as any).from(productSource).select("id,seller_id,seller_public_id,seller_name,name,price,category,image,banner,description,approved,delivery_type,variations,questions,sales,rating,created_at,updated_at").order("created_at", { ascending: false }),
      authUser
        ? (supabase as any).from("purchases").select("id,product_id,buyer_id,buyer_email,buyer_public_id,seller_id,seller_email,seller_public_id,status,amount,messages,reviewed,review_stars,review_comment,variation_name,created_at,updated_at,evopay_charge_id,pix_qr_code,pix_expires_at").order("created_at", { ascending: false })
        : { data: [] },
      authUser ? (supabase as any).from("withdrawals").select("*").order("created_at", { ascending: false }) : { data: [] },
      authUser ? (supabase as any).from("product_delivery").select("product_id,delivery_content") : { data: [] },
    ]);
    const deliveryByProduct = new Map(((deliveryRows || []) as any[]).map((d) => [Number(d.product_id), d.delivery_content || undefined]));
    const products = ((dbProducts || []) as any[]).map((p) => ({ id: Number(p.id), name: p.name, price: Number(p.price), category: p.category, seller: p.seller_name, sellerEmail: "", sellerId: p.seller_id, sellerPublicId: p.seller_public_id, sales: p.sales || 0, rating: Number(p.rating || 0), image: p.image, banner: p.banner || undefined, description: p.description, approved: p.approved, deliveryType: p.delivery_type, deliveryContent: deliveryByProduct.get(Number(p.id)), variations: p.variations || [], questions: p.questions || [] })) as Product[];
    const purchases = ((dbPurchases || []) as any[]).map(mapPurchaseRow) as Purchase[];
    const withdrawals = ((dbWithdrawals || []) as any[]).map((w) => ({ id: Number(w.id), userEmail: w.user_email, userId: w.user_id, amount: Number(w.amount), method: w.method, status: w.status, createdAt: w.created_at, pixKey: w.pix_key || "" })) as Withdrawal[];
    setState((s) => ({
      ...s,
      products,
      purchases,
      withdrawals,
    }));
  }, [authUser]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);


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

  const addProduct = (p: Omit<Product, "id" | "sales" | "rating" | "approved" | "sellerId">) => {
    if (!state.currentUser) return;
    const initialApproved = !!state.currentUser.isAdmin;
    const newProduct = { ...p, id: Date.now(), sales: 0, rating: 0, approved: initialApproved, sellerId: state.currentUser.id, sellerPublicId: state.currentUser.publicId };
    void (async () => {
      const { data } = await (supabase as any).from("products").insert({ seller_id: newProduct.sellerId, seller_public_id: newProduct.sellerPublicId, seller_email: newProduct.sellerEmail, seller_name: newProduct.seller, name: newProduct.name, price: newProduct.price, category: newProduct.category, image: newProduct.image, banner: newProduct.banner || null, description: newProduct.description, approved: initialApproved, delivery_type: newProduct.deliveryType, variations: newProduct.variations || [], questions: newProduct.questions || [] }).select("id").maybeSingle();
      if (data?.id) {
        await (supabase as any).from("product_delivery").upsert({ product_id: Number(data.id), delivery_type: newProduct.deliveryType, delivery_content: newProduct.deliveryContent || null });
        setState((s) => ({ ...s, products: s.products.map((pr) => (pr.id === newProduct.id ? { ...pr, id: Number(data.id) } : pr)) }));
      }
    })();
    setState((s) => ({
      ...s,
      products: [...s.products, newProduct],
    }));
  };

  const updateProduct = async (id: number, p: Partial<Omit<Product, "id" | "sellerId">>) => {
    const existing = state.products.find((pr) => pr.id === id);
    if (!existing) return false;
    // If price or delivery content changed, send back to review
    const essentialChanged =
      (p.price !== undefined && p.price !== existing.price) ||
      (p.deliveryContent !== undefined && p.deliveryContent !== existing.deliveryContent) ||
      (p.deliveryType !== undefined && p.deliveryType !== existing.deliveryType);
    const dbPayload: any = {};
    if (p.name !== undefined) dbPayload.name = p.name;
    if (p.category !== undefined) dbPayload.category = p.category;
    if (p.description !== undefined) dbPayload.description = p.description;
    if (p.price !== undefined) dbPayload.price = p.price;
    if (p.image !== undefined && p.image) dbPayload.image = p.image;
    if (p.banner !== undefined) dbPayload.banner = p.banner || null;
    if (p.deliveryType !== undefined) dbPayload.delivery_type = p.deliveryType;
    if (p.variations !== undefined) dbPayload.variations = p.variations || [];
    if (essentialChanged) dbPayload.approved = false;
    const { error } = await (supabase as any).from("products").update(dbPayload).eq("id", id);
    if (error) return false;
    if (p.deliveryContent !== undefined || p.deliveryType !== undefined) {
      await (supabase as any).from("product_delivery").upsert({ product_id: id, delivery_type: p.deliveryType || existing.deliveryType, delivery_content: p.deliveryContent ?? existing.deliveryContent ?? null });
    }
    setState((s) => ({
      ...s,
      products: s.products.map((pr) => (pr.id === id ? { ...pr, ...p, approved: essentialChanged ? false : pr.approved } : pr)),
    }));
    return true;
  };

  const approveProduct = async (id: number) => {
    const { error } = await (supabase as any).from("products").update({ approved: true }).eq("id", id).select("id").maybeSingle();
    if (error) {
      toast.error("Não foi possível aprovar o anúncio: " + error.message);
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

  const rejectProduct = async (id: number) => {
    const { error } = await (supabase as any).from("products").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover o anúncio: " + error.message);
      return false;
    }
    setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) }));
    return true;
  };


  const deleteProduct = async (id: number): Promise<{ paused: boolean }> => {
    // If product has orders, pause (unapprove) instead of deleting to preserve history
    const hasOrders = state.purchases.some((pu) => pu.productId === id);
    if (hasOrders) {
      await (supabase as any).from("products").update({ approved: false }).eq("id", id);
      setState((s) => ({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, approved: false } : p)) }));
      return { paused: true };
    }
    await (supabase as any).from("products").delete().eq("id", id);
    setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) }));
    return { paused: false };
  };

  const buyProduct = async (id: number, variation?: ProductVariation) => {
    const product = state.products.find((p) => p.id === id);
    if (!product || !state.currentUser) return null;
    const { data, error } = await supabase.functions.invoke("create-purchase", {
      body: { productId: id, variationName: variation?.name || null },
    });
    if (error || data?.error || !data?.purchase) {
      const message = data?.error || error?.message || "Não foi possível registrar a compra.";
      toast.error(message);
      return null;
    }
    const finalPurchase = mapPurchaseRow(data.purchase);
    setState((s) => ({ ...s, purchases: [...s.purchases, finalPurchase] }));
    return finalPurchase.id;
  };

  const savePixCharge = (purchaseId: number, charge: { evopayId: string; qrCodeText: string; expiresAt: string }) => {
    void (supabase as any).from("purchases").update({
      evopay_charge_id: charge.evopayId,
      pix_qr_code: charge.qrCodeText,
      pix_expires_at: charge.expiresAt,
    }).eq("id", purchaseId);
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) =>
        p.id === purchaseId ? { ...p, evopayChargeId: charge.evopayId, pixQrCode: charge.qrCodeText, pixExpiresAt: charge.expiresAt } : p
      ),
    }));
  };

  const refreshPurchases = async () => {
    const { data } = await (supabase as any).from("purchases").select("id,product_id,buyer_id,buyer_email,buyer_public_id,seller_id,seller_email,seller_public_id,status,amount,messages,reviewed,review_stars,review_comment,variation_name,created_at,updated_at,evopay_charge_id,pix_qr_code,pix_expires_at").order("created_at", { ascending: false });
    if (!data) return;
    const purchases = (data as any[]).map(mapPurchaseRow) as Purchase[];
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
    void (supabase as any).from("purchases").update({ status: "delivered" }).eq("id", id);
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) => (p.id === id ? { ...p, status: "delivered" as const } : p)),
    }));
  };

  const revertPurchase = (id: number) => {
    void (supabase as any).from("purchases").update({ status: "pending" }).eq("id", id);
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) => (p.id === id ? { ...p, status: "pending" as const } : p)),
    }));
  };

  const requestWithdraw = async (method: "normal" | "instant") => {
    if (!state.currentUser || state.currentUser.balance <= 0) return;
    const fee = method === "instant" ? (state.currentUser.balance * state.config.instantFee) / 100 : 0;
    const pixKey = (profile as any)?.pix_key || state.currentUser.pixKey || "";
    const amount = state.currentUser.balance - fee;
    const userId = state.currentUser.id;
    const { data } = await (supabase as any)
      .from("withdrawals")
      .insert({
        user_id: userId,
        user_public_id: String(state.currentUser.publicId || ""),
        user_email: state.currentUser.email,
        amount,
        method,
        status: "pending",
        pix_key: pixKey,
      })
      .select("id, created_at")
      .maybeSingle();
    const w: Withdrawal = {
      id: data ? Number(data.id) : Date.now(),
      userEmail: state.currentUser.email,
      userId,
      amount,
      method,
      status: "pending",
      createdAt: data?.created_at || new Date().toISOString(),
      pixKey,
    };
    setState((s) => ({
      ...s,
      withdrawals: [...s.withdrawals, w],
      userBalances: s.currentUser ? { ...(s.userBalances || {}), [s.currentUser.id]: 0 } : s.userBalances,
      currentUser: s.currentUser ? { ...s.currentUser, balance: 0 } : null,
    }));
  };

  const approveWithdraw = async (id: number) => {
    const withdrawal = state.withdrawals.find((w) => w.id === id);
    if (withdrawal?.pixKey) {
      const pixType = inferPixType(withdrawal.pixKey);
      const { data, error } = await supabase.functions.invoke("evopay-withdraw", {
        body: {
          amount: withdrawal.amount,
          pixKey: withdrawal.pixKey,
          pixType,
          description: "Saque ZXMAX",
          clientReference: String(id),
        },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao processar saque na EvoPay");
      }
    }
    void (supabase as any).from("withdrawals").update({ status: "approved" }).eq("id", id);
    setState((s) => ({
      ...s,
      withdrawals: s.withdrawals.map((w) => (w.id === id ? { ...w, status: "approved" } : w)),
    }));
  };

  const rejectWithdraw = (id: number) =>
    setState((s) => {
      const withdrawal = s.withdrawals.find((w) => w.id === id);
      if (!withdrawal) return s;

      const refundedBalance = (s.userBalances?.[withdrawal.userId] || 0) + withdrawal.amount;
      return {
        ...s,
        withdrawals: s.withdrawals.map((w) => (w.id === id ? { ...w, status: "rejected" } : w)),
        userBalances: { ...(s.userBalances || {}), [withdrawal.userId]: refundedBalance },
        currentUser: s.currentUser?.id === withdrawal.userId
          ? { ...s.currentUser, balance: refundedBalance }
          : s.currentUser,
      };
    });

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

  const confirmDelivery = (purchaseId: number) =>
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) =>
        p.id === purchaseId ? { ...p, status: "delivered" as const } : p
      ),
    }));

  const openDispute = (purchaseId: number, reason: string) =>
    setState((s) => {
      const nextPurchases = s.purchases.map((p) =>
        p.id === purchaseId ? { ...p, status: "dispute" as const, messages: [...(p.messages || []), { from: "System", text: `⚠️ DISPUTA ABERTA: ${reason}`, date: new Date().toISOString() }] } : p
      );
      const updated = nextPurchases.find((p) => p.id === purchaseId);
      if (updated) void (supabase as any).from("purchases").update({ status: "dispute", messages: updated.messages }).eq("id", purchaseId);
      return {
      ...s,
      purchases: nextPurchases,
      };
    });

  const reviewPurchase = (purchaseId: number, stars: number, comment: string) =>
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) =>
        p.id === purchaseId ? { ...p, reviewed: true, reviewStars: stars, reviewComment: comment } : p
      ),
    }));

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

  const createUserTag = (name: string, color: string) => {
    if (!name.trim()) return;
    const tag: UserTag = { id: Date.now(), name: name.trim(), color };
    setState((s) => ({ ...s, userTags: [...(s.userTags || []), tag] }));
  };

  const deleteUserTag = (id: number) =>
    setState((s) => {
      const newAssignments: Record<string, number[]> = {};
      Object.entries(s.userTagAssignments || {}).forEach(([email, ids]) => {
        const filtered = ids.filter((tid) => tid !== id);
        if (filtered.length) newAssignments[email] = filtered;
      });
      return {
        ...s,
        userTags: (s.userTags || []).filter((t) => t.id !== id),
        userTagAssignments: newAssignments,
      };
    });

  const assignUserTag = (email: string, tagId: number) =>
    setState((s) => {
      const current = s.userTagAssignments?.[email] || [];
      if (current.includes(tagId)) return s;
      return {
        ...s,
        userTagAssignments: { ...(s.userTagAssignments || {}), [email]: [...current, tagId] },
      };
    });

  const unassignUserTag = (email: string, tagId: number) =>
    setState((s) => {
      const current = s.userTagAssignments?.[email] || [];
      const filtered = current.filter((id) => id !== tagId);
      const next = { ...(s.userTagAssignments || {}) };
      if (filtered.length) next[email] = filtered;
      else delete next[email];
      return { ...s, userTagAssignments: next };
    });

  const verifyUser = async (userId: string): Promise<boolean> => {
    const { error } = await supabase.from("profiles").update({ is_verified_seller: true }).eq("user_id", userId);
    if (error) return false;

    setState(s => ({
      ...s,
      currentUser: s.currentUser?.id === userId ? { ...s.currentUser, isVerified: true } : s.currentUser,
      userDirectory: {
        ...(s.userDirectory || {}),
        ...(s.userDirectory?.[userId] ? { [userId]: { ...s.userDirectory[userId], isVerified: true } } : {}),
      },
    }));
    return true;
  };

  const submitSellerDocument = (filePath: string, fileName: string) => {
    if (!state.currentUser) return;
    const doc: SellerDocument = { id: String(Date.now()), userId: state.currentUser.id, userPublicId: state.currentUser.publicId, userEmail: state.currentUser.email, filePath, fileName, status: "pending", createdAt: new Date().toISOString() };
    void (supabase as any).from("seller_documents").insert({ user_id: doc.userId, file_path: filePath, file_name: fileName, document_type: "rg_ou_certidao", status: "pending" });
    setState(s => ({ ...s, sellerDocuments: [doc, ...(s.sellerDocuments || [])] }));
  };

  const reviewSellerDocument = (documentId: string, status: "approved" | "rejected") => {
    void (supabase as any).from("seller_documents").update({ status, reviewed_by: authUser?.id, reviewed_at: new Date().toISOString() }).eq("id", documentId);
    setState(s => ({ ...s, sellerDocuments: (s.sellerDocuments || []).map(d => d.id === documentId ? { ...d, status } : d) }));
  };

  const saveGatewaySettings = async (settings: { evopayApiKey?: string; evopayMode?: string }): Promise<boolean> => {
    const { data: existing } = await (supabase as any).from("app_settings").select("value").eq("key", "evopay").maybeSingle();
    const value: Record<string, any> = { ...(existing?.value || {}) };
    if (settings.evopayMode !== undefined) value.mode = settings.evopayMode;
    if (settings.evopayApiKey !== undefined && settings.evopayApiKey !== "") value.apiKey = settings.evopayApiKey;
    const { error } = await (supabase as any).from("app_settings").upsert({ key: "evopay", value }, { onConflict: "key" });
    if (error) return false;
    setState((s) => ({
      ...s,
      config: {
        ...s.config,
        evopayMode: (settings.evopayMode as any) ?? s.config.evopayMode,
        evopayApiKey: settings.evopayApiKey ?? s.config.evopayApiKey,
      },
    }));
    return true;
  };

  const toggleDark = () => setIsDark((d) => !d);

  return (
    <StoreContext.Provider
      value={{
        state, login, logout, addProduct, updateProduct, approveProduct, rejectProduct, deleteProduct,
        refreshProducts: loadCatalog,
        buyProduct, savePixCharge, refreshPurchases, markOrderDelivered, markPurchasePaid, approvePurchase, revertPurchase, requestWithdraw,
        approveWithdraw, rejectWithdraw, updateConfig, updateProfile,
        banUser, unbanUser, addTicket, replyTicket, closeTicket, resolveTicket,
        setGlobalNotice, publishNotice, updatePixKey, sendAdminChat,
        sendPurchaseMessage, confirmDelivery, openDispute, reviewPurchase,
        addProductQuestion, answerProductQuestion,
        deleteNotice, createUserTag, deleteUserTag, assignUserTag, unassignUserTag,
        verifyUser, saveGatewaySettings, submitSellerDocument, reviewSellerDocument, isDark, toggleDark,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
