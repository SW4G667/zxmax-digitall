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
  stock?: number;
  minQuantity?: number;
  deliveryTime?: string;
  sellerRating?: number;
  sellerReviews?: number;
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
  openDispute: (purchaseId: number, reason: string) => Promise<boolean>;
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
  categories: ["Robux e Gift Cards", "Bots Discord", "Contas", "Scripts", "Assinaturas", "Designs Digitais", "Serviços Online", "Consultoria Virtual", "Keys de Software", "Arquivos", "Jogos e Itens"],
  globalNotice: "",
  authMode: "automatic",
  discordClientId: "",
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
  const [isDark, setIsDark] = useState<boolean>(() => {
    // GGMAX-style: dark theme is the default. Only opt OUT via theme toggle.
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
        avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile?.display_name || authUser.email || "")}`,
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
    const authUser = authUserRef.current;
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
  }, [authUserId, isAdmin]);

  // Load admin-configurable gateway settings (only readable by admins via RLS)
  useEffect(() => {
    if (!authUserId || !isAdmin) return;
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
  }, [authUserId, isAdmin]);



  const loadCatalog = React.useCallback(async () => {
    const authUser = authUserRef.current;
    const withTimeout = <T,>(p: Promise<T>, ms = 4000): Promise<T | null> =>
      Promise.race([
        p,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]) as Promise<T | null>;

    try {
      // Public catalog must work 100% - anon uses public-products edge function (service_role) to bypass RLS issues
      let dbProducts: any[] = [];
      
      if (!authUser) {
        // Anon: Use public-products edge function first (service_role, always works)
        try {
          const { data, error } = await supabase.functions.invoke("public-products", {});
          if (!error && data?.products && data.products.length > 0) {
            dbProducts = data.products;
            console.log("Anon public-products edge loaded:", dbProducts.length);
          } else {
            console.log("public-products edge empty or error, trying products_public view", error, data);
            // Fallback to products_public view
            const { data: viewData, error: viewError } = await (supabase as any)
              .from("products_public")
              .select("id,seller_id,seller_public_id,seller_name,name,price,category,image,banner,description,approved,delivery_type,variations,questions,sales,rating,created_at,updated_at")
              .order("created_at", { ascending: false });
            
            if (!viewError && viewData && viewData.length > 0) {
              dbProducts = viewData;
              console.log("Anon products_public loaded:", dbProducts.length);
            } else {
              console.error("Anon view error:", viewError);
              // Last fallback: products table with approved filter
              const { data: fallbackData } = await (supabase as any)
                .from("products")
                .select("id,seller_id,seller_public_id,seller_name,name,price,category,image,banner,description,approved,delivery_type,variations,questions,sales,rating,created_at,updated_at")
                .eq("approved", true)
                .order("created_at", { ascending: false });
              if (fallbackData) dbProducts = fallbackData as any[];
            }
          }
        } catch (e) {
          console.error("Anon load failed", e);
          // Try direct view as last resort
          try {
            const { data: viewData } = await (supabase as any).from("products_public").select("id,seller_id,seller_public_id,seller_name,name,price,category,image,banner,description,approved,delivery_type,variations,questions,sales,rating,created_at,updated_at").order("created_at", { ascending: false });
            if (viewData) dbProducts = viewData as any[];
          } catch {}
        }
      } else {
        // Authenticated: try products table (RLS allows approved OR own OR admin)
        const result = await withTimeout(
          (supabase as any)
            .from("products")
            .select("id,seller_id,seller_public_id,seller_name,name,price,category,image,banner,description,approved,delivery_type,variations,questions,sales,rating,created_at,updated_at,stock,min_quantity,delivery_time")
            .order("created_at", { ascending: false }),
          5000
        );
        dbProducts = (result as any)?.data || [];
        
        // If empty for auth user, try public view as fallback
        if (dbProducts.length === 0) {
          const { data: publicData } = await (supabase as any)
            .from("products_public")
            .select("id,seller_id,seller_public_id,seller_name,name,price,category,image,banner,description,approved,delivery_type,variations,questions,sales,rating,created_at,updated_at")
            .order("created_at", { ascending: false });
          if (publicData && publicData.length > 0) dbProducts = publicData as any[];
        }
      }

      const results = await Promise.all([
        Promise.resolve({ data: dbProducts } as any),
        authUser
          ? withTimeout((supabase as any).from("purchases").select("id,product_id,buyer_id,buyer_email,buyer_public_id,seller_id,seller_email,seller_public_id,status,amount,messages,reviewed,review_stars,review_comment,variation_name,created_at,updated_at,evopay_charge_id,pix_qr_code,pix_expires_at").order("created_at", { ascending: false }), 5000)
          : Promise.resolve({ data: [] } as any),
        authUser ? withTimeout((supabase as any).from("withdrawals").select("*").order("created_at", { ascending: false }), 5000) : Promise.resolve({ data: [] } as any),
        authUser ? withTimeout((supabase as any).from("product_delivery").select("product_id,delivery_content"), 5000) : Promise.resolve({ data: [] } as any),
      ]);

      const dbPurchases = (results[1] as any)?.data || [];
      const dbWithdrawals = (results[2] as any)?.data || [];
      const deliveryRows = (results[3] as any)?.data || [];

      const deliveryByProduct = new Map(((deliveryRows || []) as any[]).map((d) => [Number(d.product_id), d.delivery_content || undefined]));
      const products = ((dbProducts || []) as any[]).map((p) => ({ 
        id: Number(p.id), 
        name: p.name, 
        price: Number(p.price), 
        category: p.category, 
        seller: p.seller_name, 
        sellerEmail: "", 
        sellerId: p.seller_id, 
        sellerPublicId: p.seller_public_id, 
        sales: p.sales || 0, 
        rating: Number(p.rating || 0), 
        image: p.image, 
        banner: p.banner || undefined, 
        description: p.description, 
        approved: p.approved, 
        deliveryType: p.delivery_type, 
        deliveryContent: deliveryByProduct.get(Number(p.id)), 
        variations: p.variations || [], 
        questions: p.questions || [],
        stock: p.stock || Math.floor((p.sales || 0) * 137 + 500),
        minQuantity: p.min_quantity || p.minQuantity || 100,
        deliveryTime: p.delivery_time || p.deliveryTime || "11 min - 1 h",
        sellerRating: 99.4,
        sellerReviews: Math.floor((p.sales || 0) * 12 + 100),
      })) as Product[];
      const purchases = ((dbPurchases || []) as any[]).map(mapPurchaseRow) as Purchase[];
      const withdrawals = ((dbWithdrawals || []) as any[]).map((w) => ({ id: Number(w.id), userEmail: w.user_email, userId: w.user_id, amount: Number(w.amount), method: w.method, status: w.status, createdAt: w.created_at, pixKey: w.pix_key || "", rejectionReason: w.rejection_reason || "", providerTxId: w.provider_tx_id || "", retryOf: w.retry_of ?? null })) as Withdrawal[];
      setState((s) => ({
        ...s,
        products,
        purchases,
        withdrawals,
      }));
    } catch (e) {
      console.error("loadCatalog failed", e);
      if (authUserRef.current) {
        setTimeout(() => void loadCatalog(), 3000);
      }
    }
  }, [authUserId]);

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

  const addProduct = (p: Omit<Product, "id" | "sales" | "rating" | "approved" | "sellerId">) => {
    if (!state.currentUser) return;
    // Admin products are always auto-approved, even if state is stale, check isAdmin from auth
    const initialApproved = !!state.currentUser.isAdmin || isAdmin;
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
    // If price or delivery content changed, send back to review - but admin edits stay approved
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
    if (p.stock !== undefined) dbPayload.stock = p.stock;
    if (p.minQuantity !== undefined) dbPayload.min_quantity = p.minQuantity;
    if (p.deliveryTime !== undefined) dbPayload.delivery_time = p.deliveryTime;
    // Only unapprove if not admin and essential changed
    if (essentialChanged && !isAdmin) dbPayload.approved = false;
    else if (isAdmin) dbPayload.approved = true;
    
    try {
      const { error } = await (supabase as any).from("products").update(dbPayload).eq("id", id);
      if (error) {
        console.error("updateProduct error", error);
        toast.error("Erro ao atualizar: " + error.message);
        return false;
      }
      if (p.deliveryContent !== undefined || p.deliveryType !== undefined) {
        await (supabase as any).from("product_delivery").upsert({ product_id: id, delivery_type: p.deliveryType || existing.deliveryType, delivery_content: p.deliveryContent ?? existing.deliveryContent ?? null });
      }
      setState((s) => ({
        ...s,
        products: s.products.map((pr) => (pr.id === id ? { ...pr, ...p, approved: isAdmin ? true : (essentialChanged ? false : pr.approved) } : pr)),
      }));
      return true;
    } catch (e: any) {
      console.error("updateProduct exception", e);
      toast.error("Erro ao atualizar produto: " + (e?.message || "tente novamente"));
      return false;
    }
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
    void supabase.functions.invoke("order-action", { body: { orderId: id, action: "approve" } }).then(() => refreshPurchases());
  };

  const revertPurchase = (id: number) => {
    void supabase.functions.invoke("order-action", { body: { orderId: id, action: "revert" } }).then(() => refreshPurchases());
  };

  const requestWithdraw = async (method: "normal" | "instant", options?: { retryOf?: number }) => {
    if (!state.currentUser || state.currentUser.balance <= 0) return;
    const fee = method === "instant" ? (state.currentUser.balance * state.config.instantFee) / 100 : 0;
    const amount = Number((state.currentUser.balance - fee).toFixed(2));
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
    await loadCatalog();
  };

  const approveWithdraw = async (id: number) => {
    const withdrawal = state.withdrawals.find((w) => w.id === id);
    let providerTx: string | null = null;
    if (withdrawal?.pixKey) {
      const pixType = inferPixType(withdrawal.pixKey);
      const { data, error } = await supabase.functions.invoke("evopay-withdraw", {
        body: {
          amount: withdrawal.amount,
          pixKey: withdrawal.pixKey,
          pixType,
          description: "Saque ZXMAX",
          // stable reference => gateway-side idempotency on retries
          clientReference: `withdraw_${id}`,
        },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao processar saque na EvoPay");
      }
      providerTx = data?.id ? String(data.id) : null;
    }
    const { error: rpcError } = await (supabase as any).rpc("approve_withdrawal", {
      _id: id,
      _provider_tx: providerTx,
    });
    if (rpcError) throw new Error(rpcError.message || "Erro ao aprovar o saque");
    await loadCatalog();
  };

  const rejectWithdraw = async (id: number, reason?: string) => {
    const { error } = await (supabase as any).rpc("reject_withdrawal", {
      _id: id,
      _reason: reason || "",
    });
    if (error) throw new Error(error.message || "Erro ao recusar o saque");
    await loadCatalog();
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

  const openDispute = async (purchaseId: number, reason: string) => {
    const { data, error } = await supabase.functions.invoke("order-action", { body: { orderId: purchaseId, action: "open_dispute", reason } });
    if (error || data?.error) return false;
    await refreshPurchases();
    return true;
  };

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
    // Try via admin-verify edge function (service_role) first
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
    } catch {}

    // Fallback direct (requires RLS fix migration)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified_seller: true, verification_status: "approved", verification_notes: null } as any)
        .eq("user_id", userId);
      if (!error) {
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
      console.error("verifyUser direct error", error);
      return false;
    } catch {
      return false;
    }
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
