import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Shield, Upload, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import TwoFactorPanel from "@/components/TwoFactorPanel";
import LoadingScreen from "@/components/LoadingScreen";
import AppShell from "@/components/AppShell";

const STATUS_META: Record<string, { label: string; className: string; icon: any }> = {
  none: { label: "Não verificado", className: "bg-muted text-muted-foreground", icon: Shield },
  pending: { label: "Em análise", className: "bg-primary/10 text-primary", icon: Clock },
  approved: { label: "Verificado", className: "bg-success/10 text-success", icon: CheckCircle2 },
  rejected: { label: "Recusado", className: "bg-destructive/10 text-destructive", icon: XCircle },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full p-3 rounded-xl bg-muted border border-border/40 text-sm text-foreground outline-none focus:ring-2 ring-primary";

function PerfilInner() {
  const { user, profile, loading, refreshProfile } = useAuth();

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

  const handleSave = async () => {
    const err = validate(false);
    if (err) return toast.error(err);
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
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
      } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) return toast.error("Não foi possível salvar: " + error.message);
    await refreshProfile();
    toast.success("Dados salvos com sucesso!");
  };

  const handleSubmitVerification = async () => {
    const err = validate(true);
    if (err) return toast.error(err);
    if (!selfie) return toast.error("Envie a foto segurando o documento e o papel escrito ZXMAX.");
    if (!selfie.type.startsWith("image/")) return toast.error("A verificação aceita apenas imagens.");
    if (selfie.size > 5 * 1024 * 1024) return toast.error("Imagem muito grande. Máximo: 5MB.");
    if (!user) return;

    setSending(true);
    try {
      const path = `${user.id}/verificacao_${Date.now()}_${selfie.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, selfie);
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

      await supabase.from("seller_documents").insert({
        user_id: user.id,
        file_path: path,
        file_name: selfie.name,
        document_type: "verificacao_identidade",
        status: "pending",
      } as any);

      setSelfie(null);
      await refreshProfile();
      toast.success("Verificação enviada! Nossa equipe vai analisar em breve.");
    } catch (e: any) {
      toast.error("Erro ao enviar verificação: " + (e?.message || "tente novamente."));
    }
    setSending(false);
  };

  if (loading) {
    return <LoadingScreen message="Carregando perfil..." />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-page p-6 text-center">
        <h1 className="text-2xl font-black text-foreground">Entre para acessar seu perfil</h1>
        <a href="/" className="btn-gradient px-5 py-3 rounded-xl font-bold text-sm">Voltar para a loja</a>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <a href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar para a loja
        </a>

        <div className="glass-card p-6 mb-5">
          <div className="flex items-center gap-4">
            <img src={profile?.avatar_url || ""} alt="Avatar" className="w-16 h-16 rounded-2xl object-cover bg-primary/10" />
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-foreground truncate">{profile?.display_name || "Meu perfil"}</h1>
              <p className="text-[11px] text-muted-foreground font-mono">ID: {profile?.public_id ?? "—"}</p>
            </div>
            <span className={`ml-auto shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${meta.className}`}>
              <StatusIcon className="w-3 h-3" /> {meta.label}
            </span>
          </div>
          {status === "rejected" && (profile as any)?.verification_notes && (
            <p className="mt-4 text-xs text-destructive bg-destructive/5 p-3 rounded-xl">
              Motivo da recusa: {(profile as any).verification_notes}
            </p>
          )}
        </div>

        <div className="glass-card p-6 mb-5">
          <h2 className="font-bold text-foreground mb-1">Dados pessoais</h2>
          <p className="text-xs text-muted-foreground mb-5">Esses dados são privados e visíveis apenas para você e para a moderação.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome de exibição"><input className={inputClass} value={form.display_name} onChange={set("display_name")} /></Field>
            <Field label="Nome completo"><input className={inputClass} value={form.full_name} onChange={set("full_name")} placeholder="Como no documento" /></Field>
            <Field label="CPF"><input className={inputClass} value={form.cpf} onChange={set("cpf")} inputMode="numeric" placeholder="000.000.000-00" /></Field>
            <Field label="Data de nascimento"><input type="date" className={inputClass} value={form.birth_date} onChange={set("birth_date")} /></Field>
            <Field label="Telefone"><input className={inputClass} value={form.phone} onChange={set("phone")} placeholder="(00) 00000-0000" /></Field>
            <Field label="Cidade"><input className={inputClass} value={form.city} onChange={set("city")} /></Field>
            <Field label="Estado (UF)"><input className={inputClass} maxLength={2} value={form.state} onChange={set("state")} placeholder="SP" /></Field>
            <Field label="Chave Pix (para saques)"><input className={inputClass} value={form.pix_key} onChange={set("pix_key")} placeholder="CPF, email, telefone ou aleatória" /></Field>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-gradient mt-6 px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar dados"}
          </button>
        </div>

        <div className="mb-5">
          <TwoFactorPanel />
        </div>

        <div className="glass-card p-6">
          <h2 className="font-bold text-foreground mb-1">Verificação de identidade</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Para vender e sacar com segurança, envie uma foto sua segurando o seu documento (RG ou CNH) e um papel escrito
            <strong className="text-foreground"> ZXMAX</strong> com a data de hoje. O rosto, o documento e o papel precisam estar legíveis.
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 mb-5 list-disc pl-5">
            <li>Boa iluminação, sem filtros e sem cortes na imagem.</li>
            <li>Os dados do documento devem bater com o nome completo e CPF informados acima.</li>
            <li>Sua foto é armazenada de forma privada e usada apenas para verificação.</li>
          </ul>

          {status === "pending" ? (
            <p className="text-sm text-primary font-semibold">Sua verificação está em análise. Você será avisado quando concluída.</p>
          ) : status === "approved" ? (
            <p className="text-sm text-success font-semibold flex items-center gap-2"><Shield className="w-4 h-4" /> Conta verificada.</p>
          ) : (
            <>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelfie(e.target.files?.[0] || null)}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-muted file:text-foreground"
              />
              <button
                onClick={handleSubmitVerification}
                disabled={sending}
                className="btn-gradient mt-5 px-5 py-3 rounded-xl font-bold text-sm inline-flex items-center gap-2 disabled:opacity-60"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {sending ? "Enviando..." : "Enviar verificação"}
              </button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function Perfil() {
  return <PerfilInner />;
}
