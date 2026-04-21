import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface User {
  email: string;
  name: string;
  balance: number;
  earnings: number;
  avatar: string;
  isAdmin: boolean;
  pixKey?: string;
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
  sellerEmail: string;
  status: "pending" | "paid" | "delivered" | "dispute";
  createdAt: string;
  amount: number;
  messages: PurchaseMessage[];
  reviewed?: boolean;
  reviewStars?: number;
  reviewComment?: string;
}

export interface Withdrawal {
  id: number;
  userEmail: string;
  amount: number;
  method: "normal" | "instant";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface SupportTicket {
  id: number;
  userEmail: string;
  subject: string;
  messages: { from: string; text: string; date: string }[];
  status: "open" | "closed";
}

export interface UserTag {
  id: number;
  name: string;
  color: string; // hex or hsl
}

export interface AppConfig {
  commission: number;
  instantFee: number;
  discordLink: string;
  stripePublishableKey: string;
  stripeSecretKey: string;
  categories: string[];
  globalNotice: string;
  googleClientId: string;
  googleClientSecret: string;
  discordClientId: string;
  discordClientSecret: string;
  asaasApiKey: string;
  asaasEnv: "sandbox" | "production";
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
}

interface StoreContextType {
  state: AppState;
  login: (email: string, name: string) => void;
  logout: () => void;
  addProduct: (p: Omit<Product, "id" | "sales" | "rating" | "approved">) => void;
  approveProduct: (id: number) => void;
  rejectProduct: (id: number) => void;
  deleteProduct: (id: number) => void;
  buyProduct: (id: number) => void;
  markPurchasePaid: (purchaseId: number) => void;
  approvePurchase: (id: number) => void;
  revertPurchase: (id: number) => void;
  requestWithdraw: (method: "normal" | "instant") => void;
  approveWithdraw: (id: number) => void;
  rejectWithdraw: (id: number) => void;
  updateConfig: (c: Partial<AppConfig>) => void;
  updateProfile: (name: string) => void;
  banUser: (email: string) => void;
  unbanUser: (email: string) => void;
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
  openDispute: (purchaseId: number) => void;
  reviewPurchase: (purchaseId: number, stars: number, comment: string) => void;
  addProductQuestion: (productId: number, text: string) => void;
  answerProductQuestion: (productId: number, questionId: number, answer: string) => void;
  isDark: boolean;
  toggleDark: () => void;
}

const defaultConfig: AppConfig = {
  commission: 10,
  instantFee: 7,
  discordLink: "https://discord.gg/zxmax",
  stripePublishableKey: "",
  stripeSecretKey: "",
  categories: ["Bots Discord", "Contas", "Scripts", "Assinaturas", "Designs Digitais", "Serviços Online", "Consultoria Virtual", "Keys de Software", "Arquivos"],
  globalNotice: "",
  googleClientId: "",
  googleClientSecret: "",
  discordClientId: "",
  discordClientSecret: "",
  asaasApiKey: "",
  asaasEnv: "sandbox",
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
        ...parsed,
        config: { ...defaultConfig, ...parsed.config },
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
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("zxmax_dark") === "true";
  });

  useEffect(() => {
    localStorage.setItem("zxmax_state", JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem("zxmax_dark", String(isDark));
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const login = (email: string, name: string) => {
    const user: User = {
      email,
      name: name || email.split("@")[0],
      balance: 0,
      earnings: 0,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || email)}`,
      isAdmin: email === "admin@keybot.com",
    };
    setState((s) => ({ ...s, currentUser: user }));
  };

  const logout = () => setState((s) => ({ ...s, currentUser: null }));

  const addProduct = (p: Omit<Product, "id" | "sales" | "rating" | "approved">) => {
    setState((s) => ({
      ...s,
      products: [...s.products, { ...p, id: Date.now(), sales: 0, rating: 0, approved: false }],
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

  const buyProduct = (id: number) => {
    const product = state.products.find((p) => p.id === id);
    if (!product || !state.currentUser) return;
    // Check if already has a pending purchase for this product
    const existingPending = state.purchases.find(
      (p) => p.productId === id && p.buyerEmail === state.currentUser!.email && p.status === "pending"
    );
    if (existingPending) return; // Don't duplicate
    const purchase: Purchase = {
      id: Date.now(),
      productId: id,
      buyerEmail: state.currentUser.email,
      sellerEmail: product.sellerEmail,
      status: "pending",
      createdAt: new Date().toISOString(),
      amount: product.price,
      messages: [],
      reviewed: false,
    };
    setState((s) => ({
      ...s,
      purchases: [...s.purchases, purchase],
    }));
  };

  const markPurchasePaid = (id: number) =>
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) => (p.id === id ? { ...p, status: "paid" as const } : p)),
      products: s.products.map((pr) => {
        const purchase = s.purchases.find((p) => p.id === id);
        if (purchase && pr.id === purchase.productId) return { ...pr, sales: pr.sales + 1 };
        return pr;
      }),
    }));

  const approvePurchase = (id: number) =>
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) => (p.id === id ? { ...p, status: "delivered" as const } : p)),
    }));

  const revertPurchase = (id: number) =>
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) => (p.id === id ? { ...p, status: "dispute" as const } : p)),
    }));

  const requestWithdraw = (method: "normal" | "instant") => {
    if (!state.currentUser || state.currentUser.balance <= 0) return;
    const fee = method === "instant" ? (state.currentUser.balance * state.config.instantFee) / 100 : 0;
    const w: Withdrawal = {
      id: Date.now(),
      userEmail: state.currentUser.email,
      amount: state.currentUser.balance - fee,
      method,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      withdrawals: [...s.withdrawals, w],
      currentUser: s.currentUser ? { ...s.currentUser, balance: 0 } : null,
    }));
  };

  const approveWithdraw = (id: number) =>
    setState((s) => ({
      ...s,
      withdrawals: s.withdrawals.map((w) => (w.id === id ? { ...w, status: "approved" } : w)),
    }));

  const rejectWithdraw = (id: number) =>
    setState((s) => ({
      ...s,
      withdrawals: s.withdrawals.map((w) => (w.id === id ? { ...w, status: "rejected" } : w)),
    }));

  const updateConfig = (c: Partial<AppConfig>) =>
    setState((s) => ({ ...s, config: { ...s.config, ...c } }));

  const updateProfile = (name: string) =>
    setState((s) => ({
      ...s,
      currentUser: s.currentUser
        ? { ...s.currentUser, name, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}` }
        : null,
    }));

  const banUser = (email: string) =>
    setState((s) => ({ ...s, bannedUsers: [...s.bannedUsers, email] }));

  const unbanUser = (email: string) =>
    setState((s) => ({ ...s, bannedUsers: s.bannedUsers.filter((e) => e !== email) }));

  const addTicket = (subject: string, message: string) => {
    if (!state.currentUser) return;
    const ticket: SupportTicket = {
      id: Date.now(),
      userEmail: state.currentUser.email,
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

  const openDispute = (purchaseId: number) =>
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) =>
        p.id === purchaseId ? { ...p, status: "dispute" as const } : p
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
        isDark, toggleDark,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
