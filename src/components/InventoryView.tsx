import React, { useState, useRef } from "react";
import { useStore, Product } from "@/store/StoreContext";
import { Plus, X, Trash2, Upload, Users, Clock, MessageSquare, Pencil, Package, Coins } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Variation {
  name: string;
  price: string;
}

export default function InventoryView({ onOpenChat }: { onOpenChat?: (purchaseId: number) => void }) {
  const { state, addProduct, updateProduct, deleteProduct } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showSales, setShowSales] = useState<number | null>(null);
  const [uploading, setUploading] = useState<"image" | "banner" | null>(null);
  const [form, setForm] = useState({
    name: "", category: state.config.categories[0] || "", description: "", price: "",
    image: "", banner: "",
    deliveryType: "manual" as "auto" | "manual", deliveryContent: "",
    stock: "", minQuantity: "", deliveryTime: "",
    robuxAmount: "", // e.g., 100 Robux = price
  });
  const [variations, setVariations] = useState<Variation[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const isRobuxCategory = form.category === "Robux e Gift Cards";

  const resetForm = () => {
    setForm({ name: "", category: state.config.categories[0] || "", description: "", price: "", image: "", banner: "", deliveryType: "manual", deliveryContent: "", stock: "", minQuantity: "", deliveryTime: "", robuxAmount: "" });
    setVariations([]);
    setEditingId(null);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      category: p.category,
      description: p.description || "",
      price: String(p.price),
      image: p.image || "",
      banner: p.banner || "",
      deliveryType: p.deliveryType,
      deliveryContent: p.deliveryContent || "",
      stock: String(p.stock || ""),
      minQuantity: String(p.minQuantity || ""),
      deliveryTime: p.deliveryTime || "",
      robuxAmount: p.variations?.[0]?.name ? p.variations[0].name.replace(/\D/g, "") : "",
    });
    setVariations((p.variations || []).map((v) => ({ name: v.name, price: String(v.price) })));
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Excluir este anúncio?")) return;
    const { paused } = await deleteProduct(id);
    if (paused) toast.success("Produto tem pedidos, foi pausado para preservar histórico.");
    else toast.success("Produto excluído.");
  };

  const myProducts = state.products.filter((p) => p.sellerId === state.currentUser?.id || p.sellerEmail === state.currentUser?.email);
  const mySales = state.purchases.filter((p) => p.sellerId === state.currentUser?.id || p.sellerEmail === state.currentUser?.email);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "banner") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Imagem inválida"); e.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); e.target.value = ""; return; }
    setUploading(type);
    const localUrl = URL.createObjectURL(file);
    setForm(f => ({ ...f, [type]: localUrl }));
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${state.currentUser!.id}/${Date.now()}_${type}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(filePath, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data, error: signErr } = await supabase.storage.from("product-images").createSignedUrl(filePath, 60 * 60 * 24 * 365);
      if (signErr || !data?.signedUrl) throw signErr || new Error("Falha URL");
      setForm(f => ({ ...f, [type]: data.signedUrl }));
      toast.success("Imagem enviada!");
    } catch (err: any) {
      setForm(f => ({ ...f, [type]: "" }));
      toast.error("Erro upload: " + (err?.message || ""));
    }
    setUploading(null);
    e.target.value = "";
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.currentUser?.isVerified && !state.currentUser?.isAdmin) return toast.error("Verifique sua conta para anunciar.");
    if (!form.name || !form.price) return toast.error("Preencha nome e preço.");
    if (parseFloat(form.price) < 2) return toast.error("Mínimo R$ 2,00.");

    // Robux special calculation: price per robuxAmount
    let finalPrice = parseFloat(form.price);
    let finalVariations = variations.filter((v) => v.name && v.price).map((v) => ({ name: v.name, price: parseFloat(v.price) }));
    
    if (isRobuxCategory) {
      const robuxQty = parseInt(form.robuxAmount) || 100;
      if (robuxQty <= 0) return toast.error("Quantidade Robux inválida");
      // Price is per robuxQty, e.g., 100 Robux = R$2 => unit price = 2/100 = 0.02 per Robux
      // But we store price as per unit for marketplace display like Eldorado: R$0,02 / unidade
      // For simplicity, store price as per unit, but also keep variation for display
      const unitPrice = finalPrice / robuxQty;
      finalPrice = unitPrice;
      // Add variation that represents the package
      if (robuxQty !== 100) {
        finalVariations = [{ name: `${robuxQty} Robux`, price: unitPrice }, ...finalVariations];
      }
    }

    if (editingId !== null) {
      const ok = await updateProduct(editingId, {
        name: form.name, category: form.category, description: form.description,
        price: finalPrice, image: form.image, banner: form.banner || undefined,
        deliveryType: form.deliveryType, deliveryContent: form.deliveryContent,
        variations: finalVariations.length > 0 ? finalVariations : [],
        stock: form.stock ? parseInt(form.stock) : undefined,
        minQuantity: form.minQuantity ? parseInt(form.minQuantity) : undefined,
        deliveryTime: form.deliveryTime || undefined,
      });
      if (ok) toast.success("Produto atualizado!");
      else toast.error("Falha ao atualizar");
    } else {
      addProduct({
        name: form.name, category: form.category, description: form.description,
        price: finalPrice, image: form.image, banner: form.banner || undefined,
        seller: state.currentUser!.name, sellerEmail: state.currentUser!.email,
        deliveryType: form.deliveryType, deliveryContent: form.deliveryContent,
        variations: finalVariations.length > 0 ? finalVariations : undefined,
        stock: form.stock ? parseInt(form.stock) : undefined,
        minQuantity: form.minQuantity ? parseInt(form.minQuantity) : undefined,
        deliveryTime: form.deliveryTime || undefined,
      } as any);
      toast.success("Produto criado! Aguardando aprovação.");
    }
    setShowForm(false);
    resetForm();
  };

  const salesForProduct = showSales ? mySales.filter(s => s.productId === showSales) : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Package className="w-6 h-6 text-[#0084ff]" /> Meus Anúncios</h1>
          <p className="text-white/40 text-sm mt-1">Gerencie seus produtos e vendas.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-[#0084ff] hover:bg-[#0066cc] text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#15151a] border border-[#25252e] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white">{editingId !== null ? "Editar Produto" : "Criar Produto"}</h3>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do Produto" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white placeholder:text-white/20 text-sm focus:border-[#0084ff] outline-none" />
              
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm focus:border-[#0084ff] outline-none">
                {state.config.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              {isRobuxCategory && (
                <div className="bg-[#ffbd2e]/10 border border-[#ffbd2e]/20 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-black uppercase text-[#ffbd2e] flex items-center gap-2"><Coins className="w-4 h-4" /> Configuração Robux (Eldorado.gg)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Qtd Robux no pacote</label>
                      <input value={form.robuxAmount} onChange={(e) => setForm({ ...form, robuxAmount: e.target.value })} type="number" placeholder="100" className="w-full p-3 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-white/40 mb-1 block">Preço do pacote (R$)</label>
                      <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" step="0.01" placeholder="2.00" className="w-full p-3 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm" />
                    </div>
                  </div>
                  {form.robuxAmount && form.price && (
                    <p className="text-xs text-white/60 bg-[#0a0a0f] p-2 rounded-lg">
                      = R$ {(parseFloat(form.price) / (parseInt(form.robuxAmount) || 100)).toFixed(5)} / Robux × {form.robuxAmount} Robux = R$ {form.price}
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
                <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" step="0.01" placeholder="Preço (R$)" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white placeholder:text-white/20 text-sm focus:border-[#0084ff] outline-none" />
              )}

              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição detalhada" rows={3} className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white placeholder:text-white/20 text-sm resize-none focus:border-[#0084ff] outline-none" />

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
              {salesForProduct.length === 0 ? <p className="text-center text-white/40 py-10 text-sm">Nenhuma venda</p> : salesForProduct.map(s => (
                <div key={s.id} onClick={() => { if(onOpenChat) { onOpenChat(s.id); setShowSales(null); } }} className="p-4 bg-[#1a1a20] border border-[#25252e] rounded-xl hover:border-[#0084ff]/30 cursor-pointer transition">
                  <p className="font-bold text-sm text-white">{s.buyerEmail}</p>
                  <p className="text-xs text-white/40">R$ {s.amount.toFixed(2)} • {new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
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
            return (
              <div key={p.id} className="bg-[#15151a] border border-[#25252e] rounded-2xl p-4 flex gap-4">
                <img src={p.image} className="w-16 h-16 rounded-xl object-cover bg-[#0a0a0f]" alt="" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white truncate text-sm">{p.name}</h4>
                  <p className="text-xs text-white/40">{p.category} • {p.sales} vendas</p>
                  <p className="text-sm font-black text-white mt-1">R$ {p.price.toFixed(5)} {p.category === "Robux e Gift Cards" ? "/ un" : ""}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full text-center ${p.approved ? "bg-[#00c950]/10 text-[#00c950] border border-[#00c950]/20" : "bg-[#ffbd2e]/10 text-[#ffbd2e] border border-[#ffbd2e]/20"}`}>{p.approved ? "Aprovado" : "Pendente"}</span>
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
