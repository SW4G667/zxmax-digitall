import React, { useEffect, useState, useRef } from "react";
import { useStore, Product } from "@/store/StoreContext";
import { Plus, X, Trash2, Upload, Users, Clock, MessageSquare, Pencil, Package, Coins, Zap, Boxes, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatRobuxPackage, formatStockLabel, isValidProductPrice, listingStatus, MIN_PRODUCT_PRICE, parsePriceInput, productStock, ROBUX_CATEGORY } from "@/lib/catalog";
import { useSearchParams } from "react-router-dom";
import { getDiscordListingRedirectTo } from "@/lib/discordAuth";
import { getAppUrl } from "@/lib/appUrl";
import { useSiteBranding } from "@/context/SiteBrandingContext";

interface Variation {
  id: string;
  name: string;
  price: string;
  stock: string;
  minQuantity: string;
  deliveryTime: string;
  deliveryType: "auto" | "manual";
  autoItems: string;
}

const makeVariationId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `var_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const parseAutoItems = (value: string): string[] =>
  [...new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))];

const autoItemCount = (value: string): number => parseAutoItems(value).length;

const emptyVariation = (seed?: Partial<Variation>): Variation => ({
  id: makeVariationId(),
  name: "",
  price: "",
  stock: "",
  minQuantity: "1",
  deliveryTime: "",
  deliveryType: "manual",
  autoItems: "",
  ...seed,
});

export default function InventoryView({ onOpenChat }: { onOpenChat?: (purchaseId: number) => void }) {
  const { state, addProduct, updateProduct, deleteProduct, refreshProducts } = useStore();
  const { branding } = useSiteBranding();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [discordGateOpen, setDiscordGateOpen] = useState(false);
  const [discordStarting, setDiscordStarting] = useState(false);
  const [emailResending, setEmailResending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showSales, setShowSales] = useState<number | null>(null);
  const [uploading, setUploading] = useState<"image" | "banner" | null>(null);
  const [form, setForm] = useState({
    name: "", category: state.config.categories[0] || "", description: "", price: "",
    image: "", banner: "",
    deliveryType: "manual" as "auto" | "manual", deliveryContent: "", autoItems: "",
    stock: "", minQuantity: "", deliveryTime: "",
    robuxAmount: "", // e.g., 100 Robux = price
  });
  const [variations, setVariations] = useState<Variation[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const isRobuxCategory = form.category === ROBUX_CATEGORY;
  const discordInvite = branding.discordInviteUrl || state.config.discordLink || "";

  const canOpenListingForm = () => {
    if (state.currentUser?.isAdmin) return true;
    if (!state.currentUser?.emailConfirmed) {
      toast.info("Confirme o e-mail da sua conta antes de anunciar.");
      return false;
    }
    if (!state.currentUser?.discordMemberVerified) {
      setDiscordGateOpen(true);
      return false;
    }
    return true;
  };

  const resendConfirmationEmail = async () => {
    const email = state.currentUser?.email?.trim();
    if (!email || emailResending || state.currentUser?.emailConfirmed) return;
    setEmailResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: getAppUrl("/meus-produtos?new=1") },
      });
      if (error) throw error;
      toast.success("E-mail de confirmação reenviado. Confira também a caixa de spam.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível reenviar o e-mail agora.");
    } finally {
      setEmailResending(false);
    }
  };

  const startDiscordVerification = async () => {
    if (!state.currentUser || discordStarting) return;
    if (!state.currentUser.emailConfirmed) {
      toast.info("Confirme seu e-mail antes de vincular o Discord.");
      return;
    }

    setDiscordStarting(true);
    try {
      window.sessionStorage.setItem("zxmax_discord_verify_user", state.currentUser.id);
      const redirectTo = getDiscordListingRedirectTo("/meus-produtos?new=1");
      const options = { redirectTo, scopes: "identify email guilds" };

      // Preserve the current ZXMAX account. New Discord identities are linked
      // to the authenticated user instead of replacing the session.
      const identitiesResult = await supabase.auth.getUserIdentities();
      const hasDiscordIdentity = Boolean(identitiesResult.data?.identities?.some((identity: any) => identity.provider === "discord"));

      let authError: any = null;
      if (!hasDiscordIdentity) {
        const linked = await (supabase.auth as any).linkIdentity({ provider: "discord", options });
        authError = linked?.error || null;

        // Some projects may still have manual identity linking disabled. In
        // that case automatic linking by the already-confirmed e-mail remains
        // a safe fallback, and the callback rejects a different ZXMAX user ID.
        if (authError && /manual|linking|identity/i.test(String(authError.message || ""))) {
          const oauth = await supabase.auth.signInWithOAuth({ provider: "discord", options });
          authError = oauth.error;
        }
      } else {
        const oauth = await supabase.auth.signInWithOAuth({ provider: "discord", options });
        authError = oauth.error;
      }

      if (authError) {
        window.sessionStorage.removeItem("zxmax_discord_verify_user");
        throw authError;
      }
    } catch (error: any) {
      setDiscordStarting(false);
      toast.error(error?.message || "Não foi possível iniciar a verificação pelo Discord.");
    }
  };

  const openCreateForm = () => {
    if (!canOpenListingForm()) return;
    resetForm();
    setShowForm(true);
  };

  useEffect(() => {
    const discordState = searchParams.get("discord");
    if (discordState === "join") {
      setDiscordGateOpen(true);
      toast.info("Entre no servidor da ZXMAX e clique em Verificar com Discord novamente.");
    } else if (discordState === "retry") {
      setDiscordGateOpen(true);
      toast.error("Não foi possível confirmar sua entrada no Discord. Tente novamente.");
    } else if (discordState === "verified") {
      toast.success("Discord verificado. Você já pode anunciar.");
    }

    if (discordState) {
      const cleaned = new URLSearchParams(searchParams);
      cleaned.delete("discord");
      setSearchParams(cleaned, { replace: true });
    }

    if (searchParams.get("new") !== "1") return;
    if (!canOpenListingForm()) return;
    resetForm();
    setShowForm(true);
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    next.delete("discord");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentUser?.emailConfirmed, state.currentUser?.discordMemberVerified, state.currentUser?.isAdmin]);

  const resetForm = () => {
    setForm({ name: "", category: state.config.categories[0] || "", description: "", price: "", image: "", banner: "", deliveryType: "manual", deliveryContent: "", autoItems: "", stock: "", minQuantity: "", deliveryTime: "", robuxAmount: "" });
    setVariations([]);
    setEditingId(null);
  };

  const openEdit = async (p: Product) => {
    const robuxVariation = p.category === ROBUX_CATEGORY ? p.variations?.[0] : undefined;
    const mappedVariations: Variation[] = p.category === ROBUX_CATEGORY
      ? []
      : (p.variations || []).map((v, index) => ({
          id: v.id || `legacy_${p.id}_${index + 1}`,
          name: v.name,
          price: String(v.price),
          stock: v.stock == null ? "" : String(v.stock),
          minQuantity: v.minQuantity == null ? "1" : String(v.minQuantity),
          deliveryTime: v.deliveryTime || p.deliveryTime || "",
          deliveryType: v.deliveryType || p.deliveryType || "manual",
          autoItems: "",
        }));

    setEditingId(p.id);
    setForm({
      name: p.category === ROBUX_CATEGORY ? "Robux" : p.name,
      category: p.category,
      description: p.category === ROBUX_CATEGORY ? "" : p.description || "",
      price: String(p.price),
      image: p.image || "",
      banner: p.banner || "",
      deliveryType: p.deliveryType,
      deliveryContent: "",
      autoItems: "",
      stock: String(p.stock ?? (robuxVariation as any)?.stock ?? ""),
      minQuantity: String(p.minQuantity ?? (robuxVariation as any)?.minQuantity ?? ""),
      deliveryTime: p.deliveryTime || "",
      robuxAmount: robuxVariation?.name ? robuxVariation.name.replace(/\D/g, "") : "",
    });
    setVariations(mappedVariations);
    setShowForm(true);

    if (p.category === ROBUX_CATEGORY) return;

    try {
      if (p.inventoryMode === "items") {
        const { data, error } = await (supabase as any).rpc("get_product_auto_inventory", { _product_id: p.id });
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        const baseItems = rows.filter((row: any) => !row.variation_id).map((row: any) => String(row.content || "")).filter(Boolean);
        setForm((current) => ({ ...current, autoItems: baseItems.join("\n") }));
        setVariations((current) => current.map((variation) => ({
          ...variation,
          autoItems: rows
            .filter((row: any) => String(row.variation_id || "") === variation.id)
            .map((row: any) => String(row.content || ""))
            .filter(Boolean)
            .join("\n"),
        })));
      } else if (p.deliveryType === "auto") {
        // Legacy listings stored one reusable delivery text in product_delivery.
        // Loading it here lets the seller migrate it into the new private item stock.
        const { data } = await (supabase as any)
          .from("product_delivery")
          .select("delivery_content")
          .eq("product_id", p.id)
          .maybeSingle();
        const legacyContent = String(data?.delivery_content || "").trim();
        if (legacyContent) {
          if (mappedVariations.length) {
            setVariations((current) => current.map((variation) => ({
              ...variation,
              deliveryType: "auto",
              autoItems: legacyContent,
            })));
          } else {
            setForm((current) => ({ ...current, autoItems: legacyContent }));
          }
        }
      }
    } catch (error) {
      console.warn("[zxmax:inventory:load]", error);
      toast.warning("O anúncio abriu, mas não foi possível carregar o estoque automático agora.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Excluir este anúncio?")) return;
    const { ok, paused } = await deleteProduct(id);
    if (!ok) return;
    if (paused) toast.success("Produto tem pedidos, foi pausado para preservar histórico.");
    else toast.success("Produto excluído.");
  };

  const myProducts = state.products.filter((p) => p.sellerId === state.currentUser?.id);
  const mySales = state.purchases.filter((p) => p.sellerId === state.currentUser?.id);
  const recentSales = [...mySales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const activeListings = myProducts.filter((product) => product.approved).length;
  const pendingDelivery = mySales.filter((sale) => sale.status === "paid" || sale.status === "delivered_pending_confirmation").length;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "banner") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Envie uma imagem JPG, PNG ou WebP."); e.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); e.target.value = ""; return; }
    setUploading(type);
    const localUrl = URL.createObjectURL(file);
    setForm(f => ({ ...f, [type]: localUrl }));
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${state.currentUser!.id}/${Date.now()}_${type}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(filePath, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
      if (!data?.publicUrl) throw new Error("Falha ao preparar a imagem");
      setForm(f => ({ ...f, [type]: data.publicUrl }));
      toast.success("Imagem enviada!");
    } catch {
      setForm(f => ({ ...f, [type]: "" }));
      toast.error("Não foi possível enviar a imagem. Atualize a página e tente novamente.");
    }
    setUploading(null);
    e.target.value = "";
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canOpenListingForm()) return;
    if ((!isRobuxCategory && !form.name.trim()) || !form.price.trim()) {
      return toast.error("Preencha nome e preço.");
    }

    const finalPrice = parsePriceInput(form.price);
    if (!isValidProductPrice(finalPrice)) {
      return toast.error(`Informe um preço válido a partir de ${formatBRL(MIN_PRODUCT_PRICE)}. Use 2,00 ou 2.00.`);
    }

    const stockNum = form.stock.trim() === "" ? undefined : Number.parseInt(form.stock, 10);
    const minQtyNum = form.minQuantity.trim() === "" ? undefined : Number.parseInt(form.minQuantity, 10);
    if (stockNum !== undefined && (!Number.isFinite(stockNum) || stockNum < 0)) return toast.error("Estoque inválido.");
    if (minQtyNum !== undefined && (!Number.isFinite(minQtyNum) || minQtyNum <= 0)) return toast.error("Quantidade mínima inválida.");

    let finalVariations: Array<{
      id?: string;
      name: string;
      price: number;
      stock?: number;
      minQuantity?: number;
      deliveryType?: "auto" | "manual";
      deliveryTime?: string;
      autoItems?: string;
    }> = [];

    if (isRobuxCategory) {
      const robuxQty = Number.parseInt(form.robuxAmount, 10);
      if (!Number.isFinite(robuxQty) || robuxQty <= 0) return toast.error("Informe quantos Robux o pacote entrega.");
      if (stockNum === undefined || stockNum <= 0) return toast.error("Informe o estoque disponível de Robux.");
      if (minQtyNum === undefined || minQtyNum <= 0) return toast.error("Informe a quantidade mínima de compra de Robux.");
      if (minQtyNum > stockNum) return toast.error("A quantidade mínima não pode exceder o estoque disponível.");
      finalVariations = [{
        id: `robux_${robuxQty}`,
        name: `${robuxQty} Robux`,
        price: finalPrice,
        stock: stockNum,
        minQuantity: minQtyNum,
        deliveryType: "manual",
        deliveryTime: form.deliveryTime || undefined,
      }];
    } else {
      const partiallyFilled = variations.some((variation) => Boolean(variation.name.trim()) !== Boolean(variation.price.trim()));
      if (partiallyFilled) return toast.error("Complete o nome e o preço de todas as variações.");

      for (let index = 0; index < variations.length; index += 1) {
        const variation = variations[index];
        if (!variation.name.trim() && !variation.price.trim()) continue;

        const price = parsePriceInput(variation.price);
        if (!isValidProductPrice(price)) {
          return toast.error(`A variação "${variation.name || index + 1}" precisa custar pelo menos ${formatBRL(MIN_PRODUCT_PRICE)}.`);
        }

        const minQuantity = variation.minQuantity.trim() === "" ? 1 : Number.parseInt(variation.minQuantity, 10);
        if (!Number.isFinite(minQuantity) || minQuantity <= 0) {
          return toast.error(`Quantidade mínima inválida na variação "${variation.name}".`);
        }

        const automaticItems = parseAutoItems(variation.autoItems);
        const variationStock = variation.deliveryType === "auto"
          ? automaticItems.length
          : Number.parseInt(variation.stock, 10);

        if (!Number.isFinite(variationStock) || variationStock < 0) {
          return toast.error(`Informe o estoque da variação "${variation.name}".`);
        }
        if (variationStock > 0 && minQuantity > variationStock) {
          return toast.error(`A quantidade mínima da variação "${variation.name}" não pode ser maior que o estoque.`);
        }

        finalVariations.push({
          id: variation.id,
          name: variation.name.trim(),
          price,
          stock: variationStock,
          minQuantity,
          deliveryType: variation.deliveryType,
          deliveryTime: variation.deliveryTime.trim() || undefined,
          autoItems: variation.autoItems,
        });
      }
    }

    const hasVariations = !isRobuxCategory && finalVariations.length > 0;
    const anyAutomatic = !isRobuxCategory && (
      hasVariations
        ? finalVariations.some((variation) => variation.deliveryType === "auto")
        : form.deliveryType === "auto"
    );
    const allAutomatic = hasVariations && finalVariations.every((variation) => variation.deliveryType === "auto");
    const effectiveDeliveryType: "auto" | "manual" = isRobuxCategory
      ? "manual"
      : hasVariations
        ? (allAutomatic ? "auto" : "manual")
        : form.deliveryType;
    const inventoryMode: "legacy" | "items" = anyAutomatic ? "items" : "legacy";

    const baseAutoItems = parseAutoItems(form.autoItems);
    const effectiveStock = isRobuxCategory
      ? stockNum
      : hasVariations
        ? finalVariations.reduce((sum, variation) => sum + Number(variation.stock || 0), 0)
        : form.deliveryType === "auto"
          ? baseAutoItems.length
          : stockNum;

    const effectiveMinQuantity = hasVariations
      ? Math.min(...finalVariations.map((variation) => Number(variation.minQuantity || 1)))
      : minQtyNum;

    const publicVariations = finalVariations.map(({ autoItems: _autoItems, ...variation }) => variation);
    const inventoryPayload = isRobuxCategory
      ? []
      : hasVariations
        ? finalVariations
            .filter((variation) => variation.deliveryType === "auto")
            .map((variation) => ({
              variationId: variation.id,
              items: parseAutoItems(variation.autoItems || ""),
            }))
        : form.deliveryType === "auto"
          ? [{ variationId: null, items: baseAutoItems }]
          : [];

    const productPayload = {
      name: isRobuxCategory ? "Robux" : form.name.trim(),
      category: form.category,
      description: isRobuxCategory ? "" : form.description,
      price: finalPrice,
      image: form.image,
      banner: form.banner || undefined,
      deliveryType: effectiveDeliveryType,
      deliveryContent: "",
      inventoryMode,
      variations: publicVariations,
      stock: effectiveStock,
      minQuantity: effectiveMinQuantity,
      deliveryTime: form.deliveryTime || undefined,
    } as const;

    let productId: number;
    if (editingId !== null) {
      const ok = await updateProduct(editingId, productPayload as any);
      if (!ok) return;
      productId = editingId;
    } else {
      const created = await addProduct({
        ...productPayload,
        seller: state.currentUser!.name,
        variations: publicVariations.length ? publicVariations : undefined,
      } as any);
      if (!created) return;
      productId = Number(created);
    }

    if (!isRobuxCategory) {
      const { data: inventoryResult, error: inventoryError } = await (supabase as any).rpc(
        "replace_product_auto_inventory",
        { _product_id: productId, _inventories: inventoryPayload },
      );
      if (inventoryError || inventoryResult?.success === false) {
        console.warn("[zxmax:inventory:save]", inventoryError);
        setEditingId(productId);
        toast.error("O anúncio foi salvo, mas o estoque automático não. O formulário ficou aberto para você tentar novamente.");
        return;
      }
    }

    await refreshProducts();
    if (editingId !== null) toast.success("Produto e estoque atualizados!");
    setShowForm(false);
    resetForm();
  };

  const salesForProduct = showSales ? mySales.filter(s => s.productId === showSales) : [];

  return (
    <div className="space-y-6">
      {discordGateOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setDiscordGateOpen(false)}>
          <section className="w-full max-w-md rounded-2xl border border-[#2b2b33] bg-[#111116] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()} aria-labelledby="discord-listing-gate-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#70bdff]">Requisito para anunciar</p>
                <h2 id="discord-listing-gate-title" className="mt-1 text-xl font-black text-white">Confirme o e-mail e entre no Discord</h2>
                <p className="mt-2 text-xs leading-5 text-white/45">Não precisa cadastrar número de telefone. Para publicar, basta ter o e-mail da ZXMAX confirmado e estar no servidor oficial do Discord.</p>
              </div>
              <button type="button" onClick={() => setDiscordGateOpen(false)} className="rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-white" aria-label="Fechar"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                <span className="text-xs font-semibold text-white/65">E-mail confirmado</span>
                <span className={`text-xs font-black ${state.currentUser?.emailConfirmed ? "text-emerald-300" : "text-amber-300"}`}>{state.currentUser?.emailConfirmed ? "OK" : "Pendente"}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                <span className="text-xs font-semibold text-white/65">Servidor do Discord</span>
                <span className={`text-xs font-black ${state.currentUser?.discordMemberVerified ? "text-emerald-300" : "text-amber-300"}`}>{state.currentUser?.discordMemberVerified ? "Verificado" : "Necessário"}</span>
              </div>
            </div>

            {!state.currentUser?.emailConfirmed ? (
              <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3">
                <p className="text-xs leading-5 text-amber-100/75">Abra o e-mail de confirmação enviado pela ZXMAX e confirme a conta. Depois volte aqui.</p>
                <button type="button" onClick={() => void resendConfirmationEmail()} disabled={emailResending} className="mt-2 text-[11px] font-bold text-amber-200 underline underline-offset-2 disabled:opacity-50">
                  {emailResending ? "Reenviando..." : "Não recebeu? Reenviar e-mail"}
                </button>
              </div>
            ) : null}

            <div className="mt-5 grid gap-2">
              {discordInvite ? (
                <a href={discordInvite} target="_blank" rel="noreferrer" className="rounded-xl border border-[#5865f2]/35 bg-[#5865f2]/10 px-4 py-3 text-center text-sm font-bold text-[#aeb4ff] hover:bg-[#5865f2]/15">1. Entrar no servidor do Discord</a>
              ) : (
                <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-center text-xs font-bold text-amber-100/70">O convite do servidor ainda não foi configurado pela administração.</div>
              )}
              <button type="button" onClick={() => void startDiscordVerification()} disabled={discordStarting || !state.currentUser?.emailConfirmed || !discordInvite} className="rounded-xl bg-[#168cff] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45">
                {discordStarting ? "Abrindo Discord..." : "2. Verificar com Discord"}
              </button>
            </div>
            <p className="mt-3 text-[10px] leading-4 text-white/28">A ZXMAX verifica somente se o e-mail foi confirmado e se o Discord vinculado está no servidor oficial. CPF, RG e selfie continuam restritos aos fluxos financeiros de carteira e saque.</p>
          </section>
        </div>
      )}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Package className="w-6 h-6 text-[#0084ff]" /> Meus Anúncios</h1>
          <p className="text-white/40 text-sm mt-1">Gerencie seus produtos e vendas.</p>
        </div>
        <button onClick={openCreateForm} className="bg-[#0084ff] hover:bg-[#0066cc] text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3" aria-label="Resumo de vendas">
        {[
          ["Anúncios ativos", activeListings, "text-[#5aaeff]"],
          ["Pedidos recebidos", mySales.length, "text-white"],
          ["Em andamento", pendingDelivery, "text-[#ffbd2e]"],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="rounded-2xl border border-[#25252e] bg-[#15151a] px-3 py-3">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wide text-white/35 leading-tight">{label}</p>
            <p className={`mt-1 text-xl font-black ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-[#25252e] bg-[#111114] overflow-hidden" aria-labelledby="recent-sales-title">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-[#25252e]">
          <div>
            <h2 id="recent-sales-title" className="font-black text-white flex items-center gap-2"><Users className="w-4 h-4 text-[#0084ff]" /> Vendas recentes</h2>
            <p className="text-xs text-white/40 mt-1">Acesse a conversa do pedido sem expor contatos pessoais.</p>
          </div>
          {mySales.length > 5 && <span className="text-xs font-bold text-[#5aaeff]">Últimas 5</span>}
        </div>
        {recentSales.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-white/40">As vendas confirmadas aparecerão aqui com o acesso ao chat do pedido.</p>
        ) : (
          <div className="divide-y divide-[#25252e]">
            {recentSales.map((sale) => {
              const buyer = state.userDirectory?.[sale.buyerId];
              const product = state.products.find((item) => item.id === sale.productId);
              const awaitingDelivery = sale.status === "paid" || sale.status === "delivered_pending_confirmation";
              return (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => onOpenChat?.(sale.id)}
                  className="w-full p-4 text-left transition hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0084ff]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-white truncate">{product?.name || "Produto indisponível"}</p>
                      <p className="mt-1 text-xs text-white/45 truncate">Comprador: {buyer?.name || "Usuário"} · ID público {sale.buyerPublicId || buyer?.publicId || "—"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${awaitingDelivery ? "border-[#ffbd2e]/20 bg-[#ffbd2e]/10 text-[#ffbd2e]" : sale.status === "delivered" ? "border-[#00c950]/20 bg-[#00c950]/10 text-[#00c950]" : "border-[#0084ff]/20 bg-[#0084ff]/10 text-[#5aaeff]"}`}>
                      {awaitingDelivery ? "Em andamento" : sale.status === "delivered" ? "Concluído" : "Aguardando pagamento"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-white">{formatBRL(sale.amount)}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5aaeff]"><MessageSquare className="w-3.5 h-3.5" /> Abrir chat</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#15151a] border border-[#25252e] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white">{editingId !== null ? "Editar Produto" : "Criar Produto"}</h3>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              {!isRobuxCategory && <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do Produto" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white placeholder:text-white/20 text-sm focus:border-[#0084ff] outline-none" />}
              
              <select value={form.category} onChange={(e) => { const category = e.target.value; setForm({ ...form, category, ...(category === ROBUX_CATEGORY ? { name: "Robux", description: "", deliveryType: "manual" as const } : {}) }); if (category === ROBUX_CATEGORY) setVariations([]); }} className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm focus:border-[#0084ff] outline-none">
                {state.config.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              {isRobuxCategory && (
                <div className="bg-[#ffbd2e]/10 border border-[#ffbd2e]/20 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-black uppercase text-[#ffbd2e] flex items-center gap-2"><Coins className="w-4 h-4" /> Oferta de Robux</p>
                  <p className="text-xs text-white/55">O título é sempre <b className="text-white">Robux</b>. Esta oferta usa um único pacote, sem descrição ou variações extras.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Qtd Robux no pacote</label>
                      <input value={form.robuxAmount} onChange={(e) => setForm({ ...form, robuxAmount: e.target.value })} type="number" placeholder="100" className="w-full p-3 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Preço do pacote (R$)</label>
                      <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="text" inputMode="decimal" placeholder="2,00 ou 2.00" className="w-full p-3 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm" />
                    </div>
                  </div>
                  {form.robuxAmount && form.price && (
                    <p className="text-xs text-white/60 bg-[#0a0a0f] p-2 rounded-lg">
                      = pacote de {form.robuxAmount || 100} Robux por R$ {form.price || "0,00"}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} type="number" placeholder="Estoque" className="p-2.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-xs" />
                    <input value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} type="number" placeholder="Qtd mín" className="p-2.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-xs" />
                    <input value={form.deliveryTime} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} placeholder="Entrega ex: 11 min - 1 h" className="p-2.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-xs" />
                  </div>
                </div>
              )}

              {!isRobuxCategory && (
                <>
                  <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="text" inputMode="decimal" placeholder="Preço (R$) — ex: 2,00" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white placeholder:text-white/20 text-sm focus:border-[#0084ff] outline-none" />
                  <div className="grid grid-cols-3 gap-2">
                    <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} type="number" placeholder="Estoque" className="p-2.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-xs" />
                    <input value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} type="number" placeholder="Qtd mín" className="p-2.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-xs" />
                    <input value={form.deliveryTime} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} placeholder="Prazo de entrega" className="p-2.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-xs" />
                  </div>
                </>
              )}

              {!isRobuxCategory && <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição detalhada" rows={3} className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white placeholder:text-white/20 text-sm resize-none focus:border-[#0084ff] outline-none" />}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Imagem Principal</label>
                  <div onClick={() => imageInputRef.current?.click()} className="aspect-square bg-[#0a0a0f] rounded-xl border-2 border-dashed border-[#25252e] flex flex-col items-center justify-center cursor-pointer hover:border-[#0084ff]/50 transition overflow-hidden">
                    {uploading === "image" ? <Clock className="animate-spin text-white/40" /> : form.image ? <img src={form.image} className="w-full h-full object-cover" alt="" /> : <div className="flex flex-col items-center gap-2 text-white/30"><Upload className="w-6 h-6" /><span className="text-xs">Enviar</span></div>}
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "image")} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Banner</label>
                  <div onClick={() => bannerInputRef.current?.click()} className="aspect-square bg-[#0a0a0f] rounded-xl border-2 border-dashed border-[#25252e] flex flex-col items-center justify-center cursor-pointer hover:border-[#0084ff]/50 transition overflow-hidden">
                    {uploading === "banner" ? <Clock className="animate-spin text-white/40" /> : form.banner ? <img src={form.banner} className="w-full h-full object-cover" alt="" /> : <div className="flex flex-col items-center gap-2 text-white/30"><Upload className="w-6 h-6" /><span className="text-xs">Enviar</span></div>}
                  </div>
                  <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "banner")} />
                </div>
              </div>

              {!isRobuxCategory && (
                <div className="bg-[#0a0a0f] border border-[#1e1e28] rounded-xl p-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold uppercase text-white/30">Variações</p>
                    <button type="button" onClick={() => setVariations([...variations, { name: "", price: "" }])} className="text-[#0084ff] text-xs font-bold">+ Adicionar</button>
                  </div>
                  {variations.map((v, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input value={v.name} onChange={(e) => { const nv = [...variations]; nv[i].name = e.target.value; setVariations(nv); }} placeholder="Nome" className="flex-1 p-2.5 rounded-lg bg-[#15151a] border border-[#25252e] text-white text-xs" />
                      <input value={v.price} onChange={(e) => { const nv = [...variations]; nv[i].price = e.target.value; setVariations(nv); }} placeholder="Preço" type="number" step="0.01" className="w-20 p-2.5 rounded-lg bg-[#15151a] border border-[#25252e] text-white text-xs" />
                      <button type="button" onClick={() => setVariations(variations.filter((_, j) => j !== i))} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-2 text-white"><input type="radio" checked={form.deliveryType === "manual"} onChange={() => setForm({ ...form, deliveryType: "manual" })} /> Manual</label>
                <label className="flex items-center gap-2 text-white"><input type="radio" checked={form.deliveryType === "auto"} onChange={() => setForm({ ...form, deliveryType: "auto" })} /> Automática</label>
              </div>
              {form.deliveryType === "auto" && <input value={form.deliveryContent} onChange={(e) => setForm({ ...form, deliveryContent: e.target.value })} placeholder="Código de entrega" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm" />}

              <button type="submit" className="w-full bg-[#0084ff] hover:bg-[#0066cc] text-white p-3.5 rounded-xl font-bold text-sm transition">{editingId !== null ? "Salvar" : "Criar Produto"}</button>
            </form>
          </div>
        </div>
      )}

      {showSales !== null && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSales(null)}>
          <div className="bg-[#15151a] border border-[#25252e] rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-white">Compradores</h3>
              <button onClick={() => setShowSales(null)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {salesForProduct.length === 0 ? <p className="text-center text-white/40 py-10 text-sm">Nenhuma venda confirmada para este anúncio.</p> : salesForProduct.map(s => {
                const buyer = state.userDirectory?.[s.buyerId];
                return (
                <div key={s.id} onClick={() => { if(onOpenChat) { onOpenChat(s.id); setShowSales(null); } }} className="p-4 bg-[#1a1a20] border border-[#25252e] rounded-xl hover:border-[#0084ff]/30 cursor-pointer transition">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-bold text-sm text-white">{buyer?.name || "Comprador"}</p><p className="text-xs text-[#5aaeff] mt-0.5">ID público: {s.buyerPublicId || buyer?.publicId || "—"}</p></div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#0084ff]/10 text-[#5aaeff] border border-[#0084ff]/20">{s.status === "pending" ? "Aguardando pagamento" : s.status === "delivered" ? "Concluído" : "Em andamento"}</span>
                  </div>
                  <p className="text-xs text-white/40 mt-2">Pedido #{s.id} · {formatBRL(s.amount)} · {new Date(s.createdAt).toLocaleDateString()}</p>
                  <p className="text-[11px] text-white/30 mt-2">Toque para abrir o chat seguro do pedido.</p>
                </div>
              )})}
            </div>
          </div>
        </div>
      )}

      {myProducts.length === 0 ? (
        <div className="bg-[#111114] border border-[#1e1e28] rounded-2xl p-12 text-center">
          <Package className="w-10 h-10 mx-auto text-white/20 mb-3" />
          <h3 className="font-bold text-white">Nenhum anúncio</h3>
          <p className="text-white/40 text-sm mt-1">Crie seu primeiro produto</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {myProducts.map((p) => {
            const productSales = mySales.filter((s) => s.productId === p.id);
            const status = listingStatus(p);
            const statusMeta = status === "approved"
              ? { label: "Aprovado", className: "bg-[#00c950]/10 text-[#00c950] border border-[#00c950]/20" }
              : status === "rejected"
                ? { label: "Rejeitado", className: "bg-red-500/10 text-red-300 border border-red-500/20" }
                : status === "paused"
                  ? { label: "Pausado", className: "bg-white/[0.05] text-white/55 border border-white/[0.09]" }
                  : status === "soldout"
                    ? { label: "Esgotado", className: "bg-white/[0.05] text-white/55 border border-white/[0.09]" }
                    : { label: "Em análise", className: "bg-[#ffbd2e]/10 text-[#ffbd2e] border border-[#ffbd2e]/20" };
            return (
              <div key={p.id} className="bg-[#15151a] border border-[#25252e] rounded-2xl p-4 flex gap-4">
                {p.image ? (
                  <img src={p.image} className="w-16 h-16 rounded-xl object-cover bg-[#0a0a0f]" alt="" />
                ) : (
                  <div className="grid w-16 h-16 shrink-0 place-items-center rounded-xl bg-[#0a0a0f] border border-white/[0.06] text-white/20"><Package className="w-6 h-6" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white truncate text-sm">{p.name}</h4>
                  <p className="text-xs text-white/40">ID do anúncio #{p.id} • {p.category} • {p.sales} vendas</p>
                  <p className="text-sm font-black text-white mt-1">
                    {p.category === ROBUX_CATEGORY ? formatRobuxPackage(p) : formatBRL(p.price)}
                    <span className="text-white/40 font-normal"> · Estoque: {formatStockLabel(productStock(p))}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full text-center ${statusMeta.className}`}>{statusMeta.label}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setShowSales(p.id)} className="p-2 bg-[#1a1a20] border border-[#25252e] rounded-xl text-white/40 hover:text-white"><Users className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(p)} className="p-2 bg-[#1a1a20] border border-[#25252e] rounded-xl text-white/40 hover:text-[#0084ff]"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 bg-[#1a1a20] border border-[#25252e] rounded-xl text-white/40 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
