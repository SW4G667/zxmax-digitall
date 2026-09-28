import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Shield, Upload, Loader2, CheckCircle2, Clock, XCircle, LogOut, Camera, Phone, FileImage, KeyRound } from "lucide-react";
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
  const [searchParams] = useSearchParams();

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
  const [rgFront, setRgFront] = useState<File | null>(null);
  const [rgBack, setRgBack] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);

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
  const phoneVerified = Boolean((profile as any)?.phone_verified_at);
  const requestedPhoneVerification = searchParams.get("verify") === "phone";
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
      window.dispatchEvent(new Event("zxmax:profile-updated"));
      toast.success(avatarFile ? "Perfil e foto atualizados!" : "Dados salvos!");
    } catch {
      toast.error("Não foi possível salvar o perfil. Tente novamente.");
    }
    setSaving(false);
  };

  const startPhoneVerification = async () => {
    if (!user) return;
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) return toast.error("Informe um celular válido com DDD.");
    setPhoneBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-verification", {
        body: { action: "start", phone: form.phone },
      });
      if (error || data?.error) throw new Error(data?.error || "Não foi possível enviar o SMS.");
      setPhoneSent(true);
      toast.success("Código enviado por SMS.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível enviar o SMS.");
    } finally {
      setPhoneBusy(false);
    }
  };

  const confirmPhoneVerification = async () => {
    if (!user) return;
    if (!/^\d{4,10}$/.test(phoneCode.replace(/\D/g, ""))) return toast.error("Digite o código recebido por SMS.");
    setPhoneBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-verification", {
        body: { action: "check", phone: form.phone, code: phoneCode },
      });
      if (error || data?.error || !data?.verified) throw new Error(data?.error || "Código inválido.");
      await refreshProfile();
      window.dispatchEvent(new Event("zxmax:profile-updated"));
      setPhoneSent(false);
      setPhoneCode("");
      toast.success("Número verificado. Você já pode criar anúncios.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível validar o código.");
    } finally {
      setPhoneBusy(false);
    }
  };

  const handleSubmitVerification = async () => {
    const err = validate(true);
    if (err) return toast.error(err);
    if (!phoneVerified) return toast.error("Verifique seu número por SMS antes de enviar os documentos.");
    if (!rgFront || !rgBack || !selfie) return toast.error("Envie RG frente, RG verso e sua selfie.");
    const files = [rgFront, rgBack, selfie];
    if (files.some((file) => !file.type.startsWith("image/"))) return toast.error("Envie apenas imagens dos documentos.");
    if (files.some((file) => file.size > 5 * 1024 * 1024)) return toast.error("Cada imagem pode ter no máximo 5 MB.");
    if (!user) return;

    setSending(true);
    try {
      const stamp = Date.now();
      const safeName = (name: string) => name.replace(/[^\w.-]/g, "_");
      const paths = {
        front: `${user.id}/rg_frente_${stamp}_${safeName(rgFront.name)}`,
        back: `${user.id}/rg_verso_${stamp}_${safeName(rgBack.name)}`,
        selfie: `${user.id}/selfie_${stamp}_${safeName(selfie.name)}`,
      };

      for (const [key, file] of [["front", rgFront], ["back", rgBack], ["selfie", selfie]] as const) {
        const target = paths[key];
        const { error: uploadError } = await supabase.storage.from("documents").upload(target, file, {
          upsert: false,
          contentType: file.type,
        });
        if (uploadError) throw uploadError;
      }

      const now = new Date().toISOString();
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
          verification_rg_front_path: paths.front,
          verification_rg_back_path: paths.back,
          verification_selfie_path: paths.selfie,
          verification_status: "pending",
          verification_submitted_at: now,
        } as any)
        .eq("user_id", user.id);
      if (profErr) throw profErr;

      const { error: docErr } = await supabase.from("seller_documents").insert([
        { user_id: user.id, file_path: paths.front, file_name: rgFront.name, document_type: "rg_frente", status: "pending" },
        { user_id: user.id, file_path: paths.back, file_name: rgBack.name, document_type: "rg_verso", status: "pending" },
        { user_id: user.id, file_path: paths.selfie, file_name: selfie.name, document_type: "selfie", status: "pending" },
      ] as any);
      if (docErr) throw docErr;

      setSelfie(null);
      setRgFront(null);
      setRgBack(null);
      await refreshProfile();
      window.dispatchEvent(new Event("zxmax:profile-updated"));
      toast.success("Documentos enviados para análise.");
    } catch (error: any) {
      console.error("verification error", error);
      toast.error(error?.message || "Não foi possível enviar a verificação.");
    } finally {
      setSending(false);
    }
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

        {!phoneVerified && (
          <section className={`mb-5 rounded-2xl border p-5 sm:p-6 ${requestedPhoneVerification ? "border-[#168cff]/45 bg-[#168cff]/[0.08]" : "border-[#25252e] bg-[#15151a]"}`} aria-labelledby="phone-verification-title">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#168cff]/20 bg-[#168cff]/10 text-[#66b7ff]"><Phone className="h-5 w-5" /></span>
              <div>
                <h2 id="phone-verification-title" className="font-bold text-white">Verifique seu número para anunciar</h2>
                <p className="mt-1 text-xs leading-5 text-white/45">A criação de anúncios exige apenas confirmação do celular por SMS. Saques e compras com saldo continuam exigindo a verificação completa dos documentos.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input className={inputClass} value={form.phone} onChange={set("phone")} placeholder="(00) 00000-0000" inputMode="tel" />
              <button type="button" onClick={() => void startPhoneVerification()} disabled={phoneBusy} className="rounded-xl bg-[#168cff] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                {phoneBusy && !phoneSent ? "Enviando..." : phoneSent ? "Reenviar SMS" : "Enviar código"}
              </button>
            </div>
            {phoneSent && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="one-time-code" placeholder="Código SMS" className={inputClass + " pl-10"} />
                </div>
                <button type="button" onClick={() => void confirmPhoneVerification()} disabled={phoneBusy} className="rounded-xl border border-[#168cff]/35 bg-[#168cff]/10 px-4 py-3 text-sm font-bold text-[#7cc4ff] disabled:opacity-50">
                  {phoneBusy ? "Validando..." : "Confirmar código"}
                </button>
              </div>
            )}
          </section>
        )}

        {phoneVerified && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4 text-sm text-emerald-200">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> Número confirmado por SMS. Sua conta pode criar anúncios.
          </div>
        )}

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
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-white/65"><FileImage className="h-5 w-5" /></span>
            <div>
              <h2 className="font-bold text-white">Verificação de documentos</h2>
              <p className="mt-1 text-xs leading-5 text-white/40">Necessária para sacar dinheiro ou pagar com o saldo da carteira. CPF digitado, RG frente e verso e uma selfie são revisados pela moderação.</p>
            </div>
          </div>

          {status === "pending" ? (
            <p className="mt-5 text-sm text-[#66b7ff] font-bold">Documentos em análise. Você receberá uma notificação quando houver decisão.</p>
          ) : status === "approved" ? (
            <p className="mt-5 text-sm text-[#00c950] font-bold flex items-center gap-2"><Shield className="w-4 h-4" /> Documentos verificados.</p>
          ) : (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["RG — frente", rgFront, setRgFront],
                  ["RG — verso", rgBack, setRgBack],
                  ["Selfie", selfie, setSelfie],
                ].map(([label, file, setter]: any) => (
                  <label key={label} className="cursor-pointer rounded-xl border border-dashed border-white/[0.12] bg-[#0b0b0e] p-4 text-center transition hover:border-[#168cff]/50">
                    <Upload className="mx-auto h-5 w-5 text-[#66b7ff]" />
                    <span className="mt-2 block text-xs font-bold text-white">{label}</span>
                    <span className="mt-1 block truncate text-[10px] text-white/35">{file?.name || "JPG, PNG ou WebP"}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setter(event.target.files?.[0] || null)} />
                  </label>
                ))}
              </div>
              {!phoneVerified && <p className="mt-4 text-xs text-amber-300/75">Confirme seu número por SMS antes de enviar os documentos.</p>}
              <button onClick={handleSubmitVerification} disabled={sending || !phoneVerified} className="bg-[#0084ff] hover:bg-[#0066cc] text-white mt-5 px-5 py-3 rounded-xl font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50 transition">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {sending ? "Enviando..." : "Enviar documentos"}
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
