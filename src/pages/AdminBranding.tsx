import React, { useRef, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Image, Upload, Save, ArrowLeft, Globe2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSiteBranding } from "@/context/SiteBrandingContext";

const inputClass = "w-full rounded-xl border border-white/10 bg-[#0d0d12] px-4 py-3 text-sm text-white outline-none focus:border-[#0084ff]";

export default function AdminBranding() {
  const { user, isAdmin, loading } = useAuth();
  const { branding, refreshBranding } = useSiteBranding();
  const [form, setForm] = useState(branding);
  const [busy, setBusy] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => setForm(branding), [branding]);

  if (loading) return <div className="min-h-screen bg-[#09090d] grid place-items-center text-white/50"><Loader2 className="animate-spin" /></div>;
  if (!user || !isAdmin) return <Navigate to="/admin" replace />;

  const upload = async (slot: "logo" | "favicon", file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Escolha uma imagem.");
    if (file.size > 2 * 1024 * 1024) return toast.error("Máximo de 2 MB.");
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      const { data, error } = await supabase.functions.invoke("site-config", {
        body: { action: "upload", slot, dataUrl: String(reader.result || "") },
      });
      setBusy(false);
      if (error || data?.error) return toast.error(data?.error || "Falha ao enviar imagem.");
      await refreshBranding();
      toast.success(slot === "logo" ? "Logo atualizado." : "Favicon atualizado.");
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("site-config", { body: { action: "save", values: form } });
    setBusy(false);
    if (error || data?.error) return toast.error(data?.error || "Falha ao salvar.");
    await refreshBranding();
    toast.success("Identidade visual atualizada.");
  };

  return (
    <div className="min-h-screen bg-[#09090d] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-7">
          <div>
            <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-white/40 hover:text-white mb-3"><ArrowLeft className="w-4 h-4" /> Voltar ao painel</Link>
            <h1 className="text-2xl font-black">Identidade visual do site</h1>
            <p className="text-sm text-white/40 mt-1">Troque logo, favicon, nome e textos principais sem editar código.</p>
          </div>
          <Globe2 className="w-9 h-9 text-[#0084ff]" />
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <div className="bg-[#121217] border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="space-y-2"><span className="text-xs font-bold text-white/50">Nome do marketplace</span><input className={inputClass} value={form.siteName} onChange={e=>setForm({...form,siteName:e.target.value})} /></label>
              <label className="space-y-2"><span className="text-xs font-bold text-white/50">Link de suporte</span><input className={inputClass} value={form.supportUrl} onChange={e=>setForm({...form,supportUrl:e.target.value})} /></label>
            </div>
            <label className="space-y-2 block"><span className="text-xs font-bold text-white/50">Título principal</span><input className={inputClass} value={form.heroTitle} onChange={e=>setForm({...form,heroTitle:e.target.value})} /></label>
            <label className="space-y-2 block"><span className="text-xs font-bold text-white/50">Subtítulo</span><textarea className={inputClass+" min-h-24 resize-none"} value={form.heroSubtitle} onChange={e=>setForm({...form,heroSubtitle:e.target.value})} /></label>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border border-white/10 rounded-xl p-4">
                <p className="text-xs font-bold mb-3">Logo do site</p>
                <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>void upload("logo",e.target.files?.[0])} />
                <button onClick={()=>logoRef.current?.click()} className="w-full border border-white/10 hover:border-[#0084ff]/60 rounded-xl py-3 text-xs font-bold flex items-center justify-center gap-2"><Upload className="w-4 h-4" /> Enviar logo</button>
              </div>
              <div className="border border-white/10 rounded-xl p-4">
                <p className="text-xs font-bold mb-3">Ícone / favicon</p>
                <input ref={faviconRef} type="file" accept="image/png,image/jpeg,image/webp,image/x-icon" className="hidden" onChange={e=>void upload("favicon",e.target.files?.[0])} />
                <button onClick={()=>faviconRef.current?.click()} className="w-full border border-white/10 hover:border-[#0084ff]/60 rounded-xl py-3 text-xs font-bold flex items-center justify-center gap-2"><Image className="w-4 h-4" /> Enviar favicon</button>
              </div>
            </div>

            <button onClick={save} disabled={busy} className="bg-[#0084ff] hover:bg-[#006ed6] disabled:opacity-50 rounded-xl px-5 py-3 font-black text-sm flex items-center gap-2"><Save className="w-4 h-4" /> {busy ? "Salvando..." : "Salvar alterações"}</button>
          </div>

          <div className="bg-[#121217] border border-white/10 rounded-2xl p-5 h-fit">
            <p className="text-xs font-bold text-white/40 uppercase mb-4">Prévia</p>
            <div className="bg-[#0a0a0f] border border-white/10 rounded-xl p-4">
              {branding.logoUrl ? <img src={branding.logoUrl} className="h-10 max-w-[180px] object-contain object-left mb-4" alt="" /> : <p className="text-2xl font-black mb-4">{form.siteName}</p>}
              <p className="font-black leading-tight">{form.heroTitle}</p>
              <p className="text-xs text-white/40 mt-2">{form.heroSubtitle}</p>
              <div className="mt-4 h-9 bg-[#0084ff] rounded-lg grid place-items-center text-xs font-black">Explorar produtos</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
