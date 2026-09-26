import React, { useEffect, useState } from "react";
import { Image, Loader2, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import useSiteBranding, { emitBranding, SiteBranding } from "@/hooks/useSiteBranding";

export default function SiteBrandingPanel() {
  const { branding, loading, refresh } = useSiteBranding();
  const [form, setForm] = useState<SiteBranding>(branding);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => setForm(branding), [branding]);

  const set = (key: keyof SiteBranding, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setBusy("save");
    const { data, error } = await supabase.functions.invoke("site-config", {
      body: { action: "save", values: form },
    });
    setBusy(null);
    if (error || data?.error) return toast.error(data?.error || "Não foi possível salvar.");
    if (data?.branding) emitBranding(data.branding);
    toast.success("Identidade visual atualizada.");
  };

  const upload = async (file: File | undefined, slot: "logo" | "favicon") => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("A imagem deve ter no máximo 2 MB.");
    if (!["image/png", "image/jpeg", "image/webp", "image/x-icon"].includes(file.type)) {
      return toast.error("Use PNG, JPG, WEBP ou ICO.");
    }

    setBusy(slot);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }).catch(() => "");

    if (!dataUrl) {
      setBusy(null);
      return toast.error("Não foi possível ler a imagem.");
    }

    const { data, error } = await supabase.functions.invoke("site-config", {
      body: { action: "upload", slot, dataUrl },
    });
    setBusy(null);
    if (error || data?.error) return toast.error(data?.error || "Falha no upload.");
    if (data?.branding) emitBranding(data.branding);
    await refresh();
    toast.success(slot === "logo" ? "Logo atualizada." : "Favicon atualizado.");
  };

  if (loading) {
    return <div className="glass-card p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="glass-card p-5 bg-card">
        <div className="flex items-center gap-2 mb-1">
          <Image className="w-5 h-5 text-primary" />
          <h3 className="font-black text-foreground">Identidade visual do site</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Altere a marca sem editar código. As imagens ficam no Storage público somente para leitura.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card p-5 bg-card">
          <p className="text-xs font-black uppercase text-muted-foreground mb-3">Logo principal</p>
          <div className="h-28 rounded-2xl bg-muted border border-border flex items-center justify-center overflow-hidden mb-3">
            {form.logoUrl ? <img src={form.logoUrl} alt="Logo" className="max-h-20 max-w-[85%] object-contain" /> : <span className="text-2xl font-black">ZXMAX</span>}
          </div>
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-xs font-bold text-foreground">
            <Upload className="w-4 h-4" /> {busy === "logo" ? "Enviando..." : "Trocar logo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy !== null} onChange={(e) => void upload(e.target.files?.[0], "logo")} />
          </label>
        </div>

        <div className="glass-card p-5 bg-card">
          <p className="text-xs font-black uppercase text-muted-foreground mb-3">Ícone / favicon</p>
          <div className="h-28 rounded-2xl bg-muted border border-border flex items-center justify-center overflow-hidden mb-3">
            {form.faviconUrl ? <img src={form.faviconUrl} alt="Favicon" className="w-16 h-16 object-contain" /> : <span className="text-3xl font-black">Z</span>}
          </div>
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted text-xs font-bold text-foreground">
            <Upload className="w-4 h-4" /> {busy === "favicon" ? "Enviando..." : "Trocar favicon"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/x-icon" className="hidden" disabled={busy !== null} onChange={(e) => void upload(e.target.files?.[0], "favicon")} />
          </label>
        </div>
      </div>

      <div className="glass-card p-5 bg-card grid md:grid-cols-2 gap-4">
        <label>
          <span className="text-xs font-bold text-muted-foreground block mb-1.5">Nome da plataforma</span>
          <input value={form.siteName} maxLength={40} onChange={(e) => set("siteName", e.target.value)} className="w-full p-3 rounded-xl bg-muted border border-border text-foreground" />
        </label>
        <label>
          <span className="text-xs font-bold text-muted-foreground block mb-1.5">Link de suporte</span>
          <input value={form.supportUrl} onChange={(e) => set("supportUrl", e.target.value)} className="w-full p-3 rounded-xl bg-muted border border-border text-foreground" />
        </label>
        <label className="md:col-span-2">
          <span className="text-xs font-bold text-muted-foreground block mb-1.5">Título da home</span>
          <input value={form.heroTitle} maxLength={100} onChange={(e) => set("heroTitle", e.target.value)} className="w-full p-3 rounded-xl bg-muted border border-border text-foreground" />
        </label>
        <label className="md:col-span-2">
          <span className="text-xs font-bold text-muted-foreground block mb-1.5">Subtítulo da home</span>
          <textarea value={form.heroSubtitle} maxLength={180} onChange={(e) => set("heroSubtitle", e.target.value)} className="w-full p-3 rounded-xl bg-muted border border-border text-foreground min-h-24" />
        </label>
        <button onClick={() => void save()} disabled={busy !== null} className="md:col-span-2 btn-gradient py-3 rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50">
          <Save className="w-4 h-4" /> {busy === "save" ? "Salvando..." : "Salvar identidade visual"}
        </button>
      </div>
    </div>
  );
}
