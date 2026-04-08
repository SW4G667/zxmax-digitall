import React, { useState } from "react";
import { useStore } from "@/store/StoreContext";
import { PackageEmoji } from "@/components/CustomEmojis";
import { Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Variation {
  name: string;
  price: string;
}

export default function InventoryView() {
  const { state, addProduct } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", category: state.config.categories[0] || "", description: "", price: "",
    image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400",
    banner: "",
    deliveryType: "manual" as "auto" | "manual", deliveryContent: "",
  });
  const [variations, setVariations] = useState<Variation[]>([]);

  const myProducts = state.products.filter((p) => p.sellerEmail === state.currentUser?.email);

  // Sales for the user
  const mySales = state.purchases.filter((p) => p.sellerEmail === state.currentUser?.email);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) return toast.error("Preencha nome e preço.");
    const parsedVariations = variations.filter((v) => v.name && v.price).map((v) => ({ name: v.name, price: parseFloat(v.price) }));
    addProduct({
      name: form.name, category: form.category, description: form.description,
      price: parseFloat(form.price), image: form.image, banner: form.banner || undefined,
      seller: state.currentUser!.name, sellerEmail: state.currentUser!.email,
      deliveryType: form.deliveryType, deliveryContent: form.deliveryContent,
      variations: parsedVariations.length > 0 ? parsedVariations : undefined,
    });
    toast.success("Produto criado! Aguardando aprovação do admin.");
    setShowForm(false);
    setForm({ name: "", category: state.config.categories[0] || "", description: "", price: "", image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400", banner: "", deliveryType: "manual", deliveryContent: "" });
    setVariations([]);
  };

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
        <button onClick={() => setShowForm(true)} className="btn-gradient px-5 py-3 text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-foreground/40 p-4 pt-20 pb-24 backdrop-blur-sm md:flex md:items-center md:justify-center md:pt-4 md:pb-4" onClick={() => setShowForm(false)}>
          <div className="glass-card w-full max-w-lg bg-card p-6 animate-fade-in-up touch-pan-y md:max-h-[90vh] md:overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 flex items-center justify-between bg-card px-6 py-4">
              <h3 className="text-xl font-bold text-foreground">Criar Produto</h3>
              <button onClick={() => setShowForm(false)} className="rounded-xl p-2 hover:bg-muted"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do Produto" className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm">
                {state.config.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição detalhada" rows={3} className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm resize-none" />
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" step="0.01" placeholder="Preço (R$)" className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />
              <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="URL da Imagem Principal" className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />
              <input value={form.banner} onChange={(e) => setForm({ ...form, banner: e.target.value })} placeholder="URL do Banner/Imagem de Destaque (opcional)" className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />

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
              <div key={p.id} className="glass-card p-5 flex items-center gap-4">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
