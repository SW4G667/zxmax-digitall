import React, { useState } from "react";
import { useStore } from "@/store/StoreContext";
import { PackageEmoji } from "@/components/CustomEmojis";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

export default function InventoryView() {
  const { state, addProduct } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", category: state.config.categories[0] || "", description: "", price: "",
    image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400",
    deliveryType: "manual" as "auto" | "manual", deliveryContent: "",
  });

  const myProducts = state.products.filter((p) => p.sellerEmail === state.currentUser?.email);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) return toast.error("Preencha nome e preço.");
    addProduct({
      name: form.name, category: form.category, description: form.description,
      price: parseFloat(form.price), image: form.image,
      seller: state.currentUser!.name, sellerEmail: state.currentUser!.email,
      deliveryType: form.deliveryType, deliveryContent: form.deliveryContent,
    });
    toast.success("Produto criado! Aguardando aprovação do admin.");
    setShowForm(false);
    setForm({ name: "", category: state.config.categories[0] || "", description: "", price: "", image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400", deliveryType: "manual", deliveryContent: "" });
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg p-6 bg-card animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-foreground">Criar Produto</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do Produto" className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm">
                {state.config.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição detalhada" rows={3} className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm resize-none" />
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" step="0.01" placeholder="Preço (R$)" className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />
              <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="URL da Imagem" className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />
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
          {myProducts.map((p) => (
            <div key={p.id} className="glass-card p-5 flex items-center gap-4">
              <img src={p.image} className="w-16 h-16 rounded-xl object-cover" alt={p.name} />
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-foreground truncate">{p.name}</h4>
                <p className="text-xs text-muted-foreground">{p.category} · {p.sales} vendas</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">R$ {p.price.toFixed(2)}</p>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${p.approved ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                  {p.approved ? "Aprovado" : "Pendente"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
