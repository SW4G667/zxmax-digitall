import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
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
  abacatepayApiKey: string;
  abacatepayMode: "automatic" | "manual";
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
  approveProduct: (id: number) => void;
  rejectProduct: (id: number) => void;
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
  verifyUser: (userId: string) => void;
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
  abacatepayApiKey: "",
  abacatepayMode: "automatic",
  rules: "1- Proibido estelionato(golpe).\n2-Proibido lavagem de dinheiro no sistema de saque do site.\n3-Proibido venda de conteúdo adulto, cp, gore ou qualquer conteúdo doloso\n\n**(Toda regra quebrada resultará a suspensão do usuário de 1 semana a permanente sem receber dinheiro de vendas durante a suspensão.)**",
};

const StoreContext = createContext<StoreContextType | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be inside StoreProvider");
  return ctx;
}

function loadState(): AppState {
  try {
    const saved = localStorage.getItem("zxmax_state");
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        userTags: [],
        userTagAssignments: {},
        userBalances: parsed.userBalances || {},
        userEarnings: parsed.userEarnings || {},
        sellerDocuments: parsed.sellerDocuments || [],
        userDirectory: parsed.userDirectory || {},
        ...parsed,
        config: {
          ...defaultConfig,
          ...parsed.config,
          authMode: parsed.config?.authMode || defaultConfig.authMode,
          discordClientId: parsed.config?.discordClientId || defaultConfig.discordClientId,
          discordClientSecret: parsed.config?.discordClientSecret || defaultConfig.discordClientSecret,
          discordRedirectUri: parsed.config?.discordRedirectUri || defaultConfig.discordRedirectUri,
          discordScopes: parsed.config?.discordScopes || defaultConfig.discordScopes,
          discordMode: parsed.config?.discordMode || defaultConfig.discordMode,
          discordServerLink: parsed.config?.discordServerLink || defaultConfig.discordServerLink,
          abacatepayApiKey: parsed.config?.abacatepayApiKey || defaultConfig.abacatepayApiKey,
          abacatepayMode: parsed.config?.abacatepayMode || defaultConfig.abacatepayMode,
          rules: parsed.config?.rules || defaultConfig.rules,
        },
        products: parsed.products?.length ? parsed.products : [],
      };
    }
  } catch {}
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
          [authUser.id]: { userId: authUser.id, publicId: userPublicId, email: user.email, name: user.name },
        },
      }));
    }
  }, [authUser, profile, isAdmin, state.userBalances, state.userEarnings]);

  useEffect(() => {
    if (!authUser) return;
    void (async () => {
      const { data: profiles } = await (supabase as any).from("profiles").select("user_id, public_id, email, display_name");
      const directory = ((profiles || []) as any[]).reduce((acc, p) => {
        acc[p.user_id] = { userId: p.user_id, publicId: String(p.public_id || ""), email: p.email, name: p.display_name || p.email?.split("@")[0] || "Usuário" };
        return acc;
      }, {} as Record<string, UserDirectoryEntry>);

      const { data: docs } = await (supabase as any).from("seller_documents").select("id, user_id, file_path, file_name, status, created_at").order("created_at", { ascending: false });
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
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    void (async () => {
      const [{ data: dbProducts }, { data: dbPurchases }, { data: dbWithdrawals }] = await Promise.all([
        (supabase as any).from("products").select("*").order("created_at", { ascending: false }),
        (supabase as any).from("purchases").select("*").order("created_at", { ascending: false }),
        (supabase as any).from("withdrawals").select("*").order("created_at", { ascending: false }),
      ]);
      const products = ((dbProducts || []) as any[]).map((p) => ({ id: Number(p.id), name: p.name, price: Number(p.price), category: p.category, seller: p.seller_name, sellerEmail: p.seller_email, sellerId: p.seller_id, sellerPublicId: p.seller_public_id, sales: p.sales || 0, rating: Number(p.rating || 0), image: p.image, banner: p.banner || undefined, description: p.description, approved: p.approved, deliveryType: p.delivery_type, deliveryContent: p.delivery_content || undefined, variations: p.variations || [], questions: p.questions || [] })) as Product[];
      const purchases = ((dbPurchases || []) as any[]).map(mapPurchaseRow) as Purchase[];
      const withdrawals = ((dbWithdrawals || []) as any[]).map((w) => ({ id: Number(w.id), userEmail: w.user_email, userId: w.user_id, amount: Number(w.amount), method: w.method, status: w.status, createdAt: w.created_at, pixKey: w.pix_key || "" })) as Withdrawal[];
      setState((s) => ({
        ...s,
        products: products.length ? products : s.products,
        purchases: purchases.length ? purchases : s.purchases,
        withdrawals: withdrawals.length ? withdrawals : s.withdrawals,
      }));
    })();
  }, [authUser]);

  useEffect(() => {
    localStorage.setItem("zxmax_state", JSON.stringify(state));
  }, [state]);

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
    const newProduct = { ...p, id: Date.now(), sales: 0, rating: 0, approved: false, sellerId: state.currentUser.id, sellerPublicId: state.currentUser.publicId };
    void (supabase as any).from("products").insert({ seller_id: newProduct.sellerId, seller_public_id: newProduct.sellerPublicId, seller_email: newProduct.sellerEmail, seller_name: newProduct.seller, name: newProduct.name, price: newProduct.price, category: newProduct.category, image: newProduct.image, banner: newProduct.banner || null, description: newProduct.description, approved: false, delivery_type: newProduct.deliveryType, delivery_content: newProduct.deliveryContent || null, variations: newProduct.variations || [], questions: newProduct.questions || [] });
    setState((s) => ({
      ...s,
      products: [...s.products, newProduct],
    }));
  };

  const approveProduct = (id: number) => {
    void (supabase as any).from("products").update({ approved: true }).eq("id", id);
    setState((s) => ({
      ...s,
      products: s.products.map((p) => (p.id === id ? { ...p, approved: true } : p)),
    }));
  };

  const rejectProduct = (id: number) => {
    void (supabase as any).from("products").delete().eq("id", id);
    setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) }));
  };

  const deleteProduct = (id: number) => {
    void (supabase as any).from("products").delete().eq("id", id);
    setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) }));
  };

  const buyProduct = async (id: number, variation?: ProductVariation) => {
    const product = state.products.find((p) => p.id === id);
    if (!product || !state.currentUser) return null;
    
    const purchase: Purchase = {
      id: Date.now(),
      productId: id,
      buyerEmail: state.currentUser.email,
      buyerId: state.currentUser.id,
      buyerPublicId: state.currentUser.publicId,
      sellerEmail: product.sellerEmail,
      sellerId: product.sellerId,
      sellerPublicId: product.sellerPublicId || state.userDirectory?.[product.sellerId]?.publicId,
      status: "pending",
      createdAt: new Date().toISOString(),
      amount: variation ? variation.price : product.price,
      messages: [],
      reviewed: false,
      variationName: variation?.name,
    };
    const { data } = await (supabase as any).from("purchases").insert({ product_id: id, buyer_id: purchase.buyerId, buyer_public_id: purchase.buyerPublicId || "", buyer_email: purchase.buyerEmail, seller_id: purchase.sellerId, seller_public_id: purchase.sellerPublicId || "", seller_email: purchase.sellerEmail, status: "pending", amount: purchase.amount, messages: [], variation_name: purchase.variationName || null }).select("id, created_at").maybeSingle();
    const finalPurchase = data ? { ...purchase, id: Number(data.id), createdAt: data.created_at } : purchase;
    setState((s) => ({ ...s, purchases: [...s.purchases, finalPurchase] }));
    return finalPurchase.id;
  };

  const markPurchasePaid = (id: number) => {
    const existing = state.purchases.find((p) => p.id === id);
    const prod = existing ? state.products.find((p) => p.id === existing.productId) : null;
    const isAutoDelivery = prod?.deliveryType === "auto" && !!prod?.deliveryContent;
    const dbStatus = isAutoDelivery ? "delivered" : "paid";
    void (async () => {
      const { data: current } = await (supabase as any).from("purchases").select("messages").eq("id", id).maybeSingle();
      const baseMessages = Array.isArray(current?.messages) ? current.messages : [];
      const messages = isAutoDelivery
        ? [...baseMessages, { from: "System", text: `📦 ENTREGA_AUTO: ${prod?.deliveryContent}`, date: new Date().toISOString() }]
        : baseMessages;
      await (supabase as any).from("purchases").update({ status: dbStatus, messages }).eq("id", id);
    })();
    setState((s) => {
      const purchase = s.purchases.find((p) => p.id === id);
      if (!purchase) return s;
      
      const product = s.products.find((p) => p.id === purchase.productId);
      const isAuto = product?.deliveryType === "auto";
      
      const newPurchases = s.purchases.map((p) => {
        if (p.id === id) {
          const updated: Purchase = { ...p, status: "paid" as const };
          if (isAuto && product?.deliveryContent) {
            updated.status = "delivered";
            updated.messages = [
              ...(updated.messages || []),
              { from: "System", text: `📦 ENTREGA_AUTO: ${product.deliveryContent}`, date: new Date().toISOString() }
            ];
          }
          return updated;
        }
        return p;
      });

      const newProducts = s.products.map((pr) => {
        if (pr.id === purchase.productId) return { ...pr, sales: pr.sales + 1 };
        return pr;
      });

      const sellerNet = Math.max(0, purchase.amount - (purchase.amount * s.config.commission) / 100);
      const nextBalances = {
        ...(s.userBalances || {}),
        [purchase.sellerId]: (s.userBalances?.[purchase.sellerId] || 0) + sellerNet,
      };
      const nextEarnings = {
        ...(s.userEarnings || {}),
        [purchase.sellerId]: (s.userEarnings?.[purchase.sellerId] || 0) + sellerNet,
      };

      return {
        ...s,
        purchases: newPurchases,
        products: newProducts,
        userBalances: nextBalances,
        userEarnings: nextEarnings,
        currentUser: s.currentUser
          ? {
              ...s.currentUser,
              balance: nextBalances[s.currentUser.id] || 0,
              earnings: nextEarnings[s.currentUser.id] || 0,
            }
          : null,
      };
    });
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
    if (error) return false;

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

  const verifyUser = (userId: string) => {
    void supabase.from("profiles").update({ is_verified_seller: true }).eq("user_id", userId);

    setState(s => ({
      ...s,
      currentUser: s.currentUser?.id === userId ? { ...s.currentUser, isVerified: true } : s.currentUser,
    }));
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

  const toggleDark = () => setIsDark((d) => !d);

  return (
    <StoreContext.Provider
      value={{
        state, login, logout, addProduct, approveProduct, rejectProduct, deleteProduct,
        buyProduct, markPurchasePaid, approvePurchase, revertPurchase, requestWithdraw,
        approveWithdraw, rejectWithdraw, updateConfig, updateProfile,
        banUser, unbanUser, addTicket, replyTicket, closeTicket, resolveTicket,
        setGlobalNotice, publishNotice, updatePixKey, sendAdminChat,
        sendPurchaseMessage, confirmDelivery, openDispute, reviewPurchase,
        addProductQuestion, answerProductQuestion,
        deleteNotice, createUserTag, deleteUserTag, assignUserTag, unassignUserTag,
        verifyUser, submitSellerDocument, reviewSellerDocument, isDark, toggleDark,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
