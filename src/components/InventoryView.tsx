import React, { useState, useRef } from "react";
import { useStore, Purchase, Product } from "@/store/StoreContext";
import { PackageEmoji } from "@/components/CustomEmojis";
import { Plus, X, Trash2, Upload, Users, Eye, CheckCircle, Clock, MessageSquare, Pencil } from "lucide-react";
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
    image: "",
    banner: "",
    deliveryType: "manual" as "auto" | "manual", deliveryContent: "",
  });
  const [variations, setVariations] = useState<Variation[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setForm({ name: "", category: state.config.categories[0] || "", description: "", price: "", image: "", banner: "", deliveryType: "manual", deliveryContent: "" });
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
    });
    setVariations((p.variations || []).map((v) => ({ name: v.name, price: String(v.price) })));
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja excluir este anúncio?")) return;
    const { paused } = await deleteProduct(id);
    if (paused) toast.success("Produto tem pedidos, então foi pausado (não excluído) para preservar o histórico.");
    else toast.success("Produto excluído.");
  };

  const myProducts = state.products.filter((p) => p.sellerEmail === state.currentUser?.email);
  const mySales = state.purchases.filter((p) => p.sellerEmail === state.currentUser?.email);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "banner") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido (JPG, PNG, WEBP).");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo: 5MB.");
      e.target.value = "";
      return;
    }

    setUploading(type);
    // Immediate local preview
    const localUrl = URL.createObjectURL(file);
    setForm(f => ({ ...f, [type]: localUrl }));
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${state.currentUser!.id}/${Date.now()}_${type}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      // Private bucket: generate a long-lived signed URL (1 year) for display
      const { data, error: signErr } = await supabase.storage
        .from("product-images")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);
      if (signErr || !data?.signedUrl) throw signErr || new Error("Falha ao gerar URL");

      setForm(f => ({ ...f, [type]: data.signedUrl }));
      toast.success(`${type === "image" ? "Imagem" : "Banner"} enviado com sucesso!`);
    } catch (err: any) {
      setForm(f => ({ ...f, [type]: "" }));
      toast.error("Erro no upload: " + (err?.message || "tente novamente"));
    }
    setUploading(null);
    e.target.value = "";
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.currentUser?.isVerified) return toast.error("Sua conta precisa ser verificada pelo admin para criar anúncios.");
    if (!form.name || !form.price) return toast.error("Preencha nome e preço.");
    if (parseFloat(form.price) < 5) return toast.error("O preço mínimo de um produto é R$ 5,00.");
    const parsedVariations = variations.filter((v) => v.name && v.price).map((v) => ({ name: v.name, price: parseFloat(v.price) }));

    if (editingId !== null) {
      const ok = await updateProduct(editingId, {
        name: form.name, category: form.category, description: form.description,
        price: parseFloat(form.price), image: form.image, banner: form.banner || undefined,
        deliveryType: form.deliveryType, deliveryContent: form.deliveryContent,
        variations: parsedVariations.length > 0 ? parsedVariations : [],
      });
      if (ok) toast.success("Produto atualizado! Se você alterou preço ou entrega, ele volta para análise.");
      else toast.error("Não foi possível atualizar o produto.");
    } else {
      addProduct({
        name: form.name, category: form.category, description: form.description,
        price: parseFloat(form.price), image: form.image, banner: form.banner || undefined,
        seller: state.currentUser!.name, sellerEmail: state.currentUser!.email,
        deliveryType: form.deliveryType, deliveryContent: form.deliveryContent,
        variations: parsedVariations.length > 0 ? parsedVariations : undefined,
      });
      toast.success("Produto criado! Aguardando aprovação do admin.");
    }
    setShowForm(false);
    resetForm();
  };

  const salesForProduct = showSales ? mySales.filter(s => s.productId === showSales) : [];

  return (
    <div className="animate-fade-in-up">
      <div className="flex justify-between items-end mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-black text-foreground">Meus Anúncios</h1>
            <PackageEmoji className="w-8 h-8" />
          </div>
          <p className="text-muted-foreground">Gerencie seus produtos e vendas.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-gradient px-5 py-3 text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[60] bg-card md:bg-foreground/40 md:backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4">
          <div className="h-full w-full overflow-y-auto p-6 pb-24 md:glass-card md:w-full md:max-w-lg md:max-h-[90vh] md:h-auto md:pb-6 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-foreground">{editingId !== null ? "Editar Produto" : "Criar Produto"}</h3>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="rounded-xl p-2 hover:bg-muted"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do Produto" className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm">
                {state.config.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição detalhada" rows={3} className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm resize-none" />
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" step="0.01" placeholder="Preço Base (R$)" className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Imagem Principal</label>
                  <div 
                    onClick={() => imageInputRef.current?.click()}
                    className="aspect-square bg-muted rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition overflow-hidden"
                  >
                    {uploading === "image" ? (
                      <Clock className="animate-spin" />
                    ) : form.image ? (
                      <img src={form.image} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="w-6 h-6" />
                        <span className="text-xs">Clique para enviar</span>
                      </div>
                    )}
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "image")} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Banner (Opcional)</label>
                  <div 
                    onClick={() => bannerInputRef.current?.click()}
                    className="aspect-square bg-muted rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition overflow-hidden"
                  >
                    {uploading === "banner" ? (
                      <Clock className="animate-spin" />
                    ) : form.banner ? (
                      <img src={form.banner} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="w-6 h-6" />
                        <span className="text-xs">Clique para enviar</span>
                      </div>
                    )}
                  </div>
                  <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "banner")} />
                </div>
              </div>

              {/* Variations */}
              <div className="border border-border/40 rounded-xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Variações (opcional)</p>
                  <button type="button" onClick={() => setVariations([...variations, { name: "", price: "" }])} className="text-primary text-xs font-bold">+ Adicionar</button>
                </div>
                {variations.map((v, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input value={v.name} onChange={(e) => { const nv = [...variations]; nv[i].name = e.target.value; setVariations(nv); }} placeholder="Nome (ex: Premium)" className="flex-1 p-2 rounded-lg bg-muted text-foreground text-xs border-none outline-none" />
                    <input value={v.price} onChange={(e) => { const nv = [...variations]; nv[i].price = e.target.value; setVariations(nv); }} placeholder="Preço" type="number" step="0.01" className="w-24 p-2 rounded-lg bg-muted text-foreground text-xs border-none outline-none" />
                    <button type="button" onClick={() => setVariations(variations.filter((_, j) => j !== i))} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="delivery" checked={form.deliveryType === "manual"} onChange={() => setForm({ ...form, deliveryType: "manual" })} /> Manual
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="delivery" checked={form.deliveryType === "auto"} onChange={() => setForm({ ...form, deliveryType: "auto" })} /> Automática
                </label>
              </div>
              {form.deliveryType === "auto" && (
                <input value={form.deliveryContent} onChange={(e) => setForm({ ...form, deliveryContent: e.target.value })} placeholder="Código/Key/Link de entrega" className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />
              )}
              <button type="submit" className="w-full btn-gradient p-3 text-sm">Criar Produto</button>
            </form>
          </div>
        </div>
      )}

      {/* Sales Modal */}
      {showSales !== null && (
        <div className="fixed inset-0 z-[60] bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSales(null)}>
          <div className="glass-card w-full max-w-lg p-6 bg-card max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-foreground">Compradores</h3>
              <button onClick={() => setShowSales(null)}><X /></button>
            </div>
            <div className="space-y-3">
              {salesForProduct.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Nenhuma venda para este produto ainda.</p>
              ) : (
                salesForProduct.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => { if(onOpenChat) { onOpenChat(s.id); setShowSales(null); } }}
                    className="p-4 bg-muted rounded-xl border border-border/40 hover:border-primary/50 cursor-pointer transition group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-sm text-foreground group-hover:text-primary transition">{s.buyerEmail}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">ID: {s.buyerId}</p>
                        {s.variationName && <p className="text-[10px] text-primary font-bold">Opção: {s.variationName}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'paid' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                          {s.status}
                        </span>
                        {onOpenChat && <span className="text-[9px] text-primary font-bold flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> Abrir Chat</span>}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-black text-foreground">R$ {s.amount.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {myProducts.length === 0 ? (
        <div className="bg-card rounded-3xl p-12 text-center border-2 border-dashed border-border">
          <PackageEmoji className="w-12 h-12 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground">Nenhum anúncio ativo</h3>
          <p className="text-muted-foreground mt-2">Comece a vender hoje mesmo!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {myProducts.map((p) => {
            const productSales = mySales.filter((s) => s.productId === p.id);
            const hasPending = productSales.some((s) => s.status === "paid");
            return (
              <div key={p.id} className="glass-card p-5 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <img src={p.image} className="w-16 h-16 rounded-xl object-cover" alt={p.name} />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-foreground truncate">{p.name}</h4>
                    <p className="text-xs text-muted-foreground">{p.category} · {p.sales} vendas</p>
                    {hasPending && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full mt-1 inline-block">Vendas pendentes</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">R$ {p.price.toFixed(2)}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${p.approved ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                      {p.approved ? "Aprovado" : "Pendente"}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2 border-t border-border/20">
                  <button 
                    onClick={() => setShowSales(p.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-muted rounded-xl text-xs font-bold text-foreground hover:bg-muted/80 transition"
                  >
                    <Users className="w-3.5 h-3.5" /> Ver Compradores
                  </button>
                  <button onClick={() => openEdit(p)} className="px-3 py-2.5 bg-muted rounded-xl text-xs font-bold text-foreground hover:text-primary transition flex items-center gap-1">
                    <Pencil className="w-4 h-4" /> Editar
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-2.5 bg-muted rounded-xl text-muted-foreground hover:text-destructive transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
