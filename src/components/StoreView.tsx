import React, { useState } from "react";
import { useStore } from "@/store/StoreContext";
import { StarEmoji, FireEmoji, RocketEmoji } from "@/components/CustomEmojis";
import { Search } from "lucide-react";
import { toast } from "sonner";

export default function StoreView() {
  const { state, buyProduct } = useStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");

  const approved = state.products.filter((p) => p.approved);
  const categories = ["Todos", ...state.config.categories];
  const filtered = approved.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "Todos" || p.category === category;
    return matchSearch && matchCat;
  });

  const handleBuy = (id: number) => {
    const product = state.products.find((p) => p.id === id);
    if (!product) return;
    buyProduct(id);
    toast.success(`Compra realizada! ${product.name} — R$ ${product.price.toFixed(2)}`);
  };

  return (
    <div className="animate-fade-in-up">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl md:text-4xl font-black text-foreground">Descobrir</h1>
          <RocketEmoji className="w-8 h-8" />
        </div>
        <p className="text-muted-foreground">Os melhores produtos digitais com entrega imediata.</p>
      </div>

      {/* Search mobile */}
      <div className="md:hidden flex items-center bg-card rounded-2xl px-4 py-3 mb-6 border border-border/40">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produtos..."
          className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-2 text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              category === cat
                ? "btn-gradient"
                : "bg-card border border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((p, i) => (
          <div
            key={p.id}
            className="glass-card overflow-hidden group animate-fade-in-up"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="relative h-48 overflow-hidden">
              <img
                src={p.image}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                alt={p.name}
              />
              <div className="absolute top-3 right-3 bg-card/90 backdrop-blur px-3 py-1 rounded-full text-[11px] font-bold text-foreground shadow-sm">
                {p.category}
              </div>
              {p.sales > 50 && (
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-destructive/90 backdrop-blur px-2 py-1 rounded-full">
                  <FireEmoji className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold text-destructive-foreground">HOT</span>
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-foreground leading-tight">{p.name}</h3>
                <div className="flex items-center gap-0.5 shrink-0">
                  <StarEmoji className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold text-foreground">{p.rating || "Novo"}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                por <span className="text-primary font-semibold">{p.seller}</span>
              </p>
              <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{p.description}</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Preço</p>
                  <p className="text-xl font-black text-foreground">R$ {p.price.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => handleBuy(p.id)}
                  className="btn-gradient px-5 py-2.5 text-sm"
                >
                  Comprar
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">{p.sales} vendas</p>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-2xl mb-2">🏜️</p>
          <p className="text-muted-foreground font-medium">Nenhum produto encontrado.</p>
        </div>
      )}
    </div>
  );
}
