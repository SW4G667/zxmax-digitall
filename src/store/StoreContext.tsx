import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface User {
  email: string;
  name: string;
  balance: number;
  earnings: number;
  avatar: string;
  isAdmin: boolean;
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
  description: string;
  approved: boolean;
  deliveryType: "auto" | "manual";
  deliveryContent?: string;
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

export interface AppConfig {
  commission: number;
  instantFee: number;
  discordLink: string;
  stripePublishableKey: string;
  stripeSecretKey: string;
  categories: string[];
  globalNotice: string;
}

interface AppState {
  currentUser: User | null;
  products: Product[];
  purchases: Purchase[];
  withdrawals: Withdrawal[];
  tickets: SupportTicket[];
  config: AppConfig;
  bannedUsers: string[];
}

interface StoreContextType {
  state: AppState;
  login: (email: string, name: string) => void;
  logout: () => void;
  addProduct: (p: Omit<Product, "id" | "sales" | "rating" | "approved">) => void;
  approveProduct: (id: number) => void;
  rejectProduct: (id: number) => void;
  buyProduct: (id: number) => void;
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
  setGlobalNotice: (notice: string) => void;
  isDark: boolean;
  toggleDark: () => void;
}

const defaultProducts: Product[] = [
  { id: 1, name: "Discord Nitro 1 Mês", price: 15.90, category: "Assinaturas", seller: "ZX Store", sellerEmail: "zxstore@zx.com", sales: 142, rating: 4.9, image: "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400", description: "Discord Nitro Gaming com boost de servidor incluído. Entrega imediata por DM.", approved: true, deliveryType: "auto", deliveryContent: "NITRO-XXXX-XXXX" },
  { id: 2, name: "Script Auto-Farm Blox Fruits", price: 45.00, category: "Scripts", seller: "DevMaster", sellerEmail: "dev@zx.com", sales: 89, rating: 4.7, image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400", description: "Script completo para farm automático em Blox Fruits. Atualizações vitalícias.", approved: true, deliveryType: "auto", deliveryContent: "https://pastebin.com/xxxxx" },
  { id: 3, name: "Conta Valorant - Skins Faca", price: 250.00, category: "Contas", seller: "SmurfShop", sellerEmail: "smurf@zx.com", sales: 12, rating: 5.0, image: "https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=400", description: "Conta Valorant com 3 facas e mais de 50 skins. Rank Diamante.", approved: true, deliveryType: "manual" },
  { id: 4, name: "Bot Discord Moderação Premium", price: 89.90, category: "Bots Discord", seller: "BotFactory", sellerEmail: "bot@zx.com", sales: 67, rating: 4.8, image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400", description: "Bot completo de moderação com anti-raid, auto-mod, logs e dashboard web.", approved: true, deliveryType: "auto", deliveryContent: "https://discord.com/oauth2/invite/xxxx" },
  { id: 5, name: "Design Pack - 50 Banners", price: 35.00, category: "Designs Digitais", seller: "DesignPro", sellerEmail: "design@zx.com", sales: 203, rating: 4.6, image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400", description: "Pack com 50 banners editáveis para YouTube, Twitch e Discord. PSD + PNG.", approved: true, deliveryType: "auto", deliveryContent: "https://drive.google.com/xxxxx" },
  { id: 6, name: "Consultoria SEO 1 Hora", price: 120.00, category: "Consultoria Virtual", seller: "SEO Master", sellerEmail: "seo@zx.com", sales: 34, rating: 4.9, image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400", description: "1 hora de consultoria ao vivo sobre SEO, análise de site e plano de ação.", approved: true, deliveryType: "manual" },
];

const defaultConfig: AppConfig = {
  commission: 10,
  instantFee: 7,
  discordLink: "https://discord.gg/zxmax",
  stripePublishableKey: "",
  stripeSecretKey: "",
  categories: ["Bots Discord", "Contas", "Scripts", "Assinaturas", "Designs Digitais", "Serviços Online", "Consultoria Virtual", "Keys de Software", "Arquivos"],
  globalNotice: "",
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
        ...parsed,
        config: { ...defaultConfig, ...parsed.config },
        products: parsed.products?.length ? parsed.products : defaultProducts,
      };
    }
  } catch {}
  return {
    currentUser: null,
    products: defaultProducts,
    purchases: [],
    withdrawals: [],
    tickets: [],
    config: defaultConfig,
    bannedUsers: [],
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

  const buyProduct = (id: number) => {
    const product = state.products.find((p) => p.id === id);
    if (!product || !state.currentUser) return;
    const purchase: Purchase = {
      id: Date.now(),
      productId: id,
      buyerEmail: state.currentUser.email,
      sellerEmail: product.sellerEmail,
      status: "paid",
      createdAt: new Date().toISOString(),
      amount: product.price,
    };
    setState((s) => ({
      ...s,
      purchases: [...s.purchases, purchase],
      products: s.products.map((p) => (p.id === id ? { ...p, sales: p.sales + 1 } : p)),
    }));
  };

  const approvePurchase = (id: number) =>
    setState((s) => {
      const purchase = s.purchases.find((p) => p.id === id);
      if (!purchase) return s;
      const commission = (purchase.amount * s.config.commission) / 100;
      const sellerAmount = purchase.amount - commission;
      return {
        ...s,
        purchases: s.purchases.map((p) => (p.id === id ? { ...p, status: "delivered" } : p)),
        products: s.products.map((p) => {
          const prod = s.products.find((pr) => pr.id === purchase.productId);
          if (prod && p.sellerEmail === purchase.sellerEmail) return p;
          return p;
        }),
      };
    });

  const revertPurchase = (id: number) =>
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((p) => (p.id === id ? { ...p, status: "dispute" } : p)),
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

  const setGlobalNotice = (notice: string) => updateConfig({ globalNotice: notice });
  const toggleDark = () => setIsDark((d) => !d);

  return (
    <StoreContext.Provider
      value={{
        state, login, logout, addProduct, approveProduct, rejectProduct,
        buyProduct, approvePurchase, revertPurchase, requestWithdraw,
        approveWithdraw, rejectWithdraw, updateConfig, updateProfile,
        banUser, unbanUser, addTicket, replyTicket, setGlobalNotice,
        isDark, toggleDark,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
