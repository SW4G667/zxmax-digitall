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
  status: "pending" | "paid" | "delivered" | "dispute";
  createdAt: string;
  amount: number;
  messages: PurchaseMessage[];
  reviewed?: boolean;
  reviewStars?: number;
  reviewComment?: string;
  variationName?: string;
}

export interface Withdrawal {
  id: number;
  userEmail: string;
  userId: string;
  amount: number;
  method: "normal" | "instant";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
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
  approveProduct: (id: number) => void;
  rejectProduct: (id: number) => void;
  deleteProduct: (id: number) => void;
  buyProduct: (id: number, variation?: ProductVariation) => void;
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
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user: authUser, profile, isAdmin, signOut } = useAuth();
  const [state, setState] = useState<AppState>(loadState);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("zxmax_dark") === "true";
  });

  // Sync auth user to store state
  useEffect(() => {
    if (authUser && profile) {
      const user: User = {
        id: authUser.id,
        email: profile.email || authUser.email || "",
        name: profile.display_name || authUser.email?.split("@")[0] || "",
        balance: state.userBalances[authUser.id] || 0,
        earnings: state.userEarnings[authUser.id] || 0,
        avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile.display_name || "")}`,
        isAdmin,
        pixKey: profile.pix_key || "",
        isVerified: profile.is_verified_seller,
      };
      setState((s) => ({ ...s, currentUser: user }));
    }
  }, [authUser, profile, isAdmin, state.userBalances, state.userEarnings]);

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
    setState((s) => ({
      ...s,
      products: [...s.products, { ...p, id: Date.now(), sales: 0, rating: 0, approved: false, sellerId: state.currentUser!.id }],
    }));
  };

  const approveProduct = (id: number) =>
    setState((s) => ({
      ...s,
      products: s.products.map((p) => (p.id === id ? { ...p, approved: true } : p)),
    }));

  const rejectProduct = (id: number) =>
    setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) }));

  const deleteProduct = (id: number) =>
    setState((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) }));

  const buyProduct = (id: number, variation?: ProductVariation) => {
    const product = state.products.find((p) => p.id === id);
    if (!product || !state.currentUser) return;
    
    const purchase: Purchase = {
      id: Date.now(),
      productId: id,
      buyerEmail: state.currentUser.email,
      buyerId: state.currentUser.id,
      sellerEmail: product.sellerEmail,
      sellerId: product.sellerId,
      status: "pending",
      createdAt: new Date().toISOString(),
      amount: variation ? variation.price : product.price,
      messages: [],
      reviewed: false,
      variationName: variation?.name,
    };
    setState((s) => ({
      ...s,
      purchases: [...s.purchases, purchase],
    }));
  };

  const markPurchasePaid = (id: number) =>
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

  const approvePurchase = (id: number) =>
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) => (p.id === id ? { ...p, status: "delivered" as const } : p)),
    }));

  const revertPurchase = (id: number) =>
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) => (p.id === id ? { ...p, status: "pending" as const } : p)),
    }));

  const requestWithdraw = (method: "normal" | "instant") => {
    if (!state.currentUser || state.currentUser.balance <= 0) return;
    const fee = method === "instant" ? (state.currentUser.balance * state.config.instantFee) / 100 : 0;
    const w: Withdrawal = {
      id: Date.now(),
      userEmail: state.currentUser.email,
      userId: state.currentUser.id,
      amount: state.currentUser.balance - fee,
      method,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      withdrawals: [...s.withdrawals, w],
      userBalances: s.currentUser ? { ...(s.userBalances || {}), [s.currentUser.id]: 0 } : s.userBalances,
      currentUser: s.currentUser ? { ...s.currentUser, balance: 0 } : null,
    }));
  };

  const approveWithdraw = (id: number) =>
    setState((s) => ({
      ...s,
      withdrawals: s.withdrawals.map((w) => (w.id === id ? { ...w, status: "approved" } : w)),
    }));

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

  const banUser = (identifier: string, reason = "Violação das regras da plataforma") => {
    const normalized = identifier.trim();
    if (!normalized) return;

    void supabase.from("bans").insert({
      user_id: normalized,
      banned_by: authUser?.id || normalized,
      reason,
      active: true,
    });

    setState((s) => ({
      ...s,
      bannedUsers: s.bannedUsers.includes(normalized) ? s.bannedUsers : [...s.bannedUsers, normalized],
    }));
  };

  const unbanUser = (identifier: string) => {
    const normalized = identifier.trim();
    if (!normalized) return;

    void supabase.from("bans").update({ active: false }).eq("user_id", normalized).eq("active", true);

    setState((s) => ({ ...s, bannedUsers: s.bannedUsers.filter((e) => e !== normalized) }));
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
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) =>
        p.id === purchaseId
          ? { ...p, messages: [...(p.messages || []), { from, text, date: new Date().toISOString() }] }
          : p
      ),
    }));

  const confirmDelivery = (purchaseId: number) =>
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) =>
        p.id === purchaseId ? { ...p, status: "delivered" as const } : p
      ),
    }));

  const openDispute = (purchaseId: number, reason: string) =>
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) =>
        p.id === purchaseId ? { ...p, status: "dispute" as const, messages: [...(p.messages || []), { from: "System", text: `⚠️ DISPUTA ABERTA: ${reason}`, date: new Date().toISOString() }] } : p
      ),
    }));

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
        verifyUser, isDark, toggleDark,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
