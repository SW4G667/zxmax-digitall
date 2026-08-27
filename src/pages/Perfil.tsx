import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Shield, Upload, Loader2, CheckCircle2, Clock, XCircle, LogOut, Camera } from "lucide-react";
import TwoFactorPanel from "@/components/TwoFactorPanel";
import LoadingScreen from "@/components/LoadingScreen";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store/StoreContext";

const STATUS_META: Record<string, { label: string; className: string; icon: any }> = {
  none: { label: "Não verificado", className: "bg-[#1a1a20] text-white/40 border border-[#25252e]", icon: Shield },
  pending: { label: "Em análise", className: "bg-[#0084ff]/10 text-[#0084ff] border border-[#0084ff]/20", icon: Clock },
  approved: { label: "Verificado", className: "bg-[#00c950]/10 text-[#00c950] border border-[#00c950]/20", icon: CheckCircle2 },
  rejected: { label: "Recusado", className: "bg-red-500/10 text-red-400 border border-red-500/20", icon: XCircle },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wide text-white/30 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full p-3 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-sm text-white outline-none focus:border-[#0084ff] focus:ring-1 focus:ring-[#0084ff]/20";
const AVATAR_FILE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

function avatarExtension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function PerfilInner() {
  const { user, profile, loading, refreshProfile, isAdmin, signOut } = useAuth();
  const { state } = useStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    display_name: "",
    full_name: "",
    cpf: "",
    birth_date: "",
    phone: "",
    city: "",
    state: "",
    pix_key: "",
  });
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name || "",
      full_name: (profile as any).full_name || "",
      cpf: (profile as any).cpf || "",
      birth_date: (profile as any).birth_date || "",
      phone: (profile as any).phone || "",
      city: (profile as any).city || "",
      state: (profile as any).state || "",
      pix_key: profile.pix_key || "",
    });
  }, [profile]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile]);

  const status = ((profile as any)?.verification_status as string) || "none";
  const meta = STATUS_META[status] || STATUS_META.none;
  const StatusIcon = meta.icon;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = (requireAll: boolean) => {
    if (!form.display_name.trim()) return "Informe um nome de exibição.";
    if (!requireAll) return null;
    if (form.full_name.trim().split(" ").filter(Boolean).length < 2) return "Informe seu nome completo.";
    const digits = form.cpf.replace(/\D/g, "");
    if (digits.length !== 11) return "CPF deve conter 11 dígitos.";
    if (!form.birth_date) return "Informe sua data de nascimento.";
    if (form.phone.replace(/\D/g, "").length < 10) return "Informe um telefone válido com DDD.";
    if (!form.city.trim()) return "Informe sua cidade.";
    if (form.state.trim().length < 2) return "Informe seu estado (UF).";
    return null;
  };

  const handleAvatarChange = (file: File | null) => {
    if (!file) return;
    if (!AVATAR_FILE_TYPES.has(file.type)) {
      toast.error("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("A foto de perfil deve ter no máximo 2 MB.");
      return;
    }
    setAvatarFile(file);
  };

  const handleSave = async () => {
    const err = validate(false);
    if (err) return toast.error(err);
    if (!user) return;
    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url || null;
      if (avatarFile) {
        if (!profile?.public_id) throw new Error("Perfil público indisponível. Recarregue a página e tente novamente.");
        const path = `${profile.public_id}/perfil.${avatarExtension(avatarFile.type)}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true, cacheControl: "3600", contentType: avatarFile.type });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: form.display_name.trim(),
          avatar_url: avatarUrl,
          full_name: form.full_name.trim(),
          cpf: form.cpf.replace(/\D/g, ""),
          birth_date: form.birth_date || null,
          phone: form.phone.trim(),
          city: form.city.trim(),
          state: form.state.trim().toUpperCase(),
          pix_key: form.pix_key.trim(),
        } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshProfile();
      setAvatarFile(null);
      toast.success(avatarFile ? "Perfil e foto atualizados!" : "Dados salvos!");
    } catch {
      toast.error("Não foi possível salvar o perfil. Tente novamente.");
    }
    setSaving(false);
  };

  const handleSubmitVerification = async () => {
    const err = validate(true);
    if (err) return toast.error(err);
    if (!selfie) return toast.error("Envie a foto segurando documento + papel ZXMAX.");
    if (!selfie.type.startsWith("image/")) return toast.error("Só imagens.");
    if (selfie.size > 5 * 1024 * 1024) return toast.error("Máximo 5MB.");
    if (!user) return;

    setSending(true);
    try {
      const path = `${user.id}/verificacao_${Date.now()}_${selfie.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, selfie, { upsert: true });
      if (upErr) throw upErr;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          display_name: form.display_name.trim(),
          full_name: form.full_name.trim(),
          cpf: form.cpf.replace(/\D/g, ""),
          birth_date: form.birth_date || null,
          phone: form.phone.trim(),
          city: form.city.trim(),
          state: form.state.trim().toUpperCase(),
          pix_key: form.pix_key.trim(),
          verification_selfie_path: path,
          verification_status: "pending",
          verification_submitted_at: new Date().toISOString(),
        } as any)
        .eq("user_id", user.id);
      if (profErr) throw profErr;

      const { error: docErr } = await supabase.from("seller_documents").insert({
        user_id: user.id,
        file_path: path,
        file_name: selfie.name,
        document_type: "verificacao_identidade",
        status: "pending",
      } as any);
      if (docErr) console.error("doc insert error", docErr);

      setSelfie(null);
      // Don't cause page refresh - just refresh profile state
      setTimeout(async () => {
        await refreshProfile();
      }, 500);
      toast.success("Verificação enviada! Aguarde análise.");
    } catch (e: any) {
      console.error("verification error", e);
      toast.error("Erro ao enviar: " + (e?.message || "tente novamente"));
    }
    setSending(false);
  };

  if (loading) return <LoadingScreen message="Carregando perfil..." />;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0a0a0f] p-6 text-center">
        <h1 className="text-2xl font-black text-white">Entre para acessar seu perfil</h1>
        <a href="/" className="bg-[#0084ff] text-white px-5 py-3 rounded-xl font-bold text-sm">Voltar para a loja</a>
      </div>
    );
  }

  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(`zxmax-${profile?.public_id || "perfil"}`)}`;
  const shownAvatar = avatarPreview || profile?.avatar_url || defaultAvatar;
  const myListings = state.products.filter((product) => product.sellerId === user.id);
  const activeListings = myListings.filter((product) => product.approved).length;
  const reviewCount = myListings.reduce((total, product) => total + Number(product.reviewCount || 0), 0);
  const receivedSales = state.purchases.filter((purchase) => purchase.sellerId === user.id).length;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <a href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar para a loja
        </a>

        <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6 mb-5">
          <div className="flex items-center gap-4">
            <img src={shownAvatar} alt="Foto de perfil" className="w-16 h-16 rounded-2xl object-cover bg-[#0084ff]/10 border border-white/10" />
            <div className="min-w-0">
              <h1 className="text-xl font-black text-white truncate">{profile?.display_name || "Meu perfil"}</h1>
              <p className="text-[11px] text-white/30 font-mono">ID público permanente: {profile?.public_id ?? "—"}</p>
            </div>
            <span className={`ml-auto shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border ${meta.className}`}>
              <StatusIcon className="w-3 h-3" /> {meta.label}
            </span>
          </div>
          {status === "rejected" && (profile as any)?.verification_notes && (
            <p className="mt-4 text-xs text-red-400 bg-red-500/5 border border-red-500/20 p-3 rounded-xl">Motivo: {(profile as any).verification_notes}</p>
          )}
        </div>

        <section className="mb-5 grid grid-cols-3 gap-3" aria-label="Resumo público da atividade">
          {[
            ["Anúncios no ar", activeListings, "/meus-produtos"],
            ["Vendas recebidas", receivedSales, "/minhas-compras?scope=sales"],
            ["Avaliações", reviewCount, "/meus-produtos"],
          ].map(([label, value, href]) => (
            <a key={String(label)} href={String(href)} className="rounded-2xl border border-[#25252e] bg-[#15151a] px-3 py-4 transition hover:border-[#0084ff]/40 hover:bg-[#0084ff]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0084ff]">
              <span className="block text-[9px] font-black uppercase tracking-wide text-white/35 leading-tight">{String(label)}</span>
              <span className="mt-1 block text-xl font-black text-white">{String(value)}</span>
            </a>
          ))}
        </section>

        <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6 mb-5">
          <h2 className="font-bold text-white mb-1">Dados pessoais</h2>
          <p className="text-xs text-white/40 mb-5">Nome e foto aparecem publicamente; os demais dados são visíveis só para você e moderação.</p>
          <div className="flex items-center gap-4 rounded-2xl border border-[#25252e] bg-[#0a0a0f] p-4 mb-5">
            <img src={shownAvatar} alt="Prévia da foto de perfil" className="w-14 h-14 rounded-2xl object-cover bg-[#0084ff]/10 border border-white/10" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">Foto pública</p>
              <p className="text-xs text-white/40 mt-1 truncate">{avatarFile ? avatarFile.name : "JPG, PNG ou WebP · até 2 MB"}</p>
            </div>
            <label htmlFor="avatar-upload" className="shrink-0 inline-flex items-center gap-2 cursor-pointer rounded-xl border border-[#0084ff]/30 bg-[#0084ff]/10 px-3 py-2 text-xs font-bold text-[#55aaff] hover:bg-[#0084ff]/20 transition">
              <Camera className="w-4 h-4" /> Alterar foto
            </label>
            <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => handleAvatarChange(event.target.files?.[0] || null)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome de exibição"><input className={inputClass} value={form.display_name} onChange={set("display_name")} /></Field>
            <Field label="Nome completo"><input className={inputClass} value={form.full_name} onChange={set("full_name")} placeholder="Como no documento" /></Field>
            <Field label="CPF"><input className={inputClass} value={form.cpf} onChange={set("cpf")} inputMode="numeric" placeholder="000.000.000-00" /></Field>
            <Field label="Data nascimento"><input type="date" className={inputClass} value={form.birth_date} onChange={set("birth_date")} /></Field>
            <Field label="Telefone"><input className={inputClass} value={form.phone} onChange={set("phone")} placeholder="(00) 00000-0000" /></Field>
            <Field label="Cidade"><input className={inputClass} value={form.city} onChange={set("city")} /></Field>
            <Field label="Estado (UF)"><input className={inputClass} maxLength={2} value={form.state} onChange={set("state")} placeholder="SP" /></Field>
            <Field label="Chave Pix (saques)"><input className={inputClass} value={form.pix_key} onChange={set("pix_key")} placeholder="CPF, email, telefone" /></Field>
          </div>
          <button onClick={handleSave} disabled={saving} className="bg-[#0084ff] hover:bg-[#0066cc] text-white mt-6 px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition">
            {saving ? "Salvando..." : "Salvar dados"}
          </button>
        </div>

        {isAdmin && (
          <div className="mb-5">
            <TwoFactorPanel />
          </div>
        )}

        <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
          <h2 className="font-bold text-white mb-1">Verificação de identidade</h2>
          <p className="text-xs text-white/40 mb-4">Foto segurando documento + papel escrito <strong className="text-white">ZXMAX</strong> com data de hoje.</p>

          {status === "pending" ? (
            <p className="text-sm text-[#0084ff] font-bold">Em análise. Você será avisado.</p>
          ) : status === "approved" ? (
            <p className="text-sm text-[#00c950] font-bold flex items-center gap-2"><Shield className="w-4 h-4" /> Conta verificada.</p>
          ) : (
            <>
              <input type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] || null)} className="block w-full text-xs text-white/40 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#1a1a20] file:text-white file:border file:border-[#25252e]" />
              <button onClick={handleSubmitVerification} disabled={sending} className="bg-[#0084ff] hover:bg-[#0066cc] text-white mt-5 px-5 py-3 rounded-xl font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50 transition">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {sending ? "Enviando..." : "Enviar verificação"}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => {
            void signOut();
            navigate("/");
          }}
          className="mt-5 w-full flex items-center justify-center gap-2 p-3 text-red-400 font-bold text-sm hover:bg-red-500/10 rounded-xl transition border border-red-500/20"
        >
          <LogOut className="w-4 h-4" /> Sair da Conta
        </button>
      </div>
    </AppShell>
  );
}

export default function Perfil() {
  return <PerfilInner />;
}
