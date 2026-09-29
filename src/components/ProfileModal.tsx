import React, { useState, useRef } from "react";
import { useStore } from "@/store/StoreContext";
import { useAuth } from "@/hooks/useAuth";
import { MoneyEmoji, DoorEmoji } from "@/components/CustomEmojis";
import { X, Edit, Upload, Shield, Camera, Loader2, Wallet, BadgeCheck, ChevronRight, KeyRound, FileCheck2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import TwoFactorPanel from "@/components/TwoFactorPanel";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: Props) {
  const { state, requestWithdraw, logout, updatePixKey, submitSellerDocument } = useStore();
  const { user: authUser, profile, isAdmin, updateProfile: updateAuthProfile, refreshProfile } = useAuth();
  const storeUser = state.currentUser;
  const [editName, setEditName] = useState(profile?.display_name || storeUser?.name || "");
  const [editing, setEditing] = useState(false);
  const [pixKey, setPixKey] = useState(profile?.pix_key || storeUser?.pixKey || "");
  const [editingPix, setEditingPix] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  if (!open || !storeUser || !authUser) return null;

  const handleSave = async () => {
    if (editName.trim()) {
      await updateAuthProfile({ display_name: editName.trim() });
      toast.success("Perfil atualizado!");
    }
    setEditing(false);
  };

  const handleSavePix = async () => {
    if (pixKey.trim()) {
      await updateAuthProfile({ pix_key: pixKey.trim() });
      updatePixKey(pixKey.trim());
      toast.success("Chave Pix salva!");
    }
    setEditingPix(false);
  };

  const handleWithdraw = (method: "normal" | "flex") => {
    if (!storeUser.documentVerified) return toast.error("Você precisa ter RG, CPF e selfie aprovados antes de sacar.");
    if (storeUser.balance < state.config.withdrawMin) return toast.error(`Saldo mínimo para saque normal é R$ ${state.config.withdrawMin.toFixed(2).replace(".", ",")}.`);
    if (!profile?.pix_key && !storeUser.pixKey) return toast.error("Cadastre sua chave Pix antes de solicitar saque.");
    requestWithdraw(method);
    toast.success("Saque solicitado para análise.");
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 5MB.");
      return;
    }

    setUploading(true);
    try {
      const filePath = `${authUser.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (error) throw error;
      submitSellerDocument(filePath, file.name);
      await updateAuthProfile({ document_type: "rg_ou_certidao" });
      toast.success("Documento enviado com sucesso! Aguarde verificação.");
    } catch (err: any) {
      toast.error("Erro ao enviar documento: " + (err.message || "Tente novamente."));
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const compressImage = (file: File, max = 256): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas não suportado"));
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem.");
      return;
    }
    setAvatarUploading(true);
    try {
      const dataUrl = await compressImage(file, 256);
      await updateAuthProfile({ avatar_url: dataUrl });
      await refreshProfile();
      window.dispatchEvent(new Event("zxmax:profile-updated"));
      toast.success("Foto de perfil atualizada!");
    } catch (err: any) {
      toast.error("Erro ao atualizar foto: " + (err?.message || "Tente novamente."));
    }
    setAvatarUploading(false);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const displayName = profile?.display_name || storeUser.name;
  const publicId = profile?.public_id ?? storeUser.publicId;
  const verifiedSeller = profile?.is_verified_seller ?? storeUser.isVerified;
  const pixValue = profile?.pix_key || storeUser.pixKey || "";
  const verificationReady = Boolean(storeUser.documentVerified);
  const emailReady = Boolean(storeUser.emailConfirmed);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-[28px] border border-white/[0.09] bg-[#0d0d11] shadow-[0_30px_100px_rgba(0,0,0,0.65)] animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0d0d11]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#63b7ff]">Conta ZXMAX</p>
            <h3 className="mt-1 text-xl font-black text-white">Meu perfil</h3>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-white/45 transition hover:bg-white/[0.08] hover:text-white" aria-label="Fechar perfil">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <section className="relative overflow-hidden rounded-[24px] border border-[#168cff]/20 bg-[linear-gradient(135deg,rgba(22,140,255,0.12),rgba(255,255,255,0.025)_48%,rgba(255,255,255,0.015))] p-5">
            <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#168cff]/10 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="relative shrink-0">
                <img src={profile?.avatar_url || storeUser.avatar} className="h-20 w-20 rounded-2xl border border-white/[0.12] bg-[#15151b] object-cover shadow-xl sm:h-24 sm:w-24" alt="Foto do perfil" />
                <input type="file" ref={avatarInputRef} accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-xl border border-[#168cff]/35 bg-[#168cff] text-white shadow-lg transition hover:bg-[#0875e6] disabled:opacity-60"
                  aria-label="Alterar foto de perfil"
                >
                  {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
              </div>

              <div className="min-w-0 flex-1">
                {editing ? (
                  <div className="flex gap-2">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-black/25 px-3 py-2 text-sm font-bold text-white outline-none focus:border-[#168cff]/60" autoFocus />
                    <button onClick={handleSave} className="rounded-xl bg-[#168cff] px-3 py-2 text-xs font-black text-white">Salvar</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="truncate text-lg font-black text-white sm:text-xl">{displayName}</p>
                    <button type="button" onClick={() => { setEditName(displayName); setEditing(true); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white" aria-label="Editar nome">
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <p className="mt-1 font-mono text-[11px] text-white/40">ID público · {publicId}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {verifiedSeller && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-bold text-emerald-300"><BadgeCheck className="h-3.5 w-3.5" /> Vendedor verificado</span>}
                  {emailReady && <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white/60"><MailCheck className="h-3.5 w-3.5" /> E-mail confirmado</span>}
                  {verificationReady && <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white/60"><FileCheck2 className="h-3.5 w-3.5" /> Identidade aprovada</span>}
                </div>
              </div>
            </div>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#168cff]/15 bg-[#168cff]/[0.055] p-4">
              <div className="flex items-center gap-2 text-[#72c0ff]"><Wallet className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-wide">Saldo disponível</p></div>
              <p className="mt-2 text-2xl font-black tracking-tight text-white">R$ {storeUser.balance.toFixed(2)}</p>
              <p className="mt-1 text-[10px] text-white/35">Valor liberado para saque.</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.035] p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300/80">Ganhos totais</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-white">R$ {storeUser.earnings.toFixed(2)}</p>
              <p className="mt-1 text-[10px] text-white/35">Histórico acumulado de vendas.</p>
            </div>
          </div>

          <section className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-white/45"><KeyRound className="h-4 w-4 text-[#69baff]" /> Chave PIX para saque</p>
                {!editingPix && <p className={`mt-2 truncate text-sm font-semibold ${pixValue ? "text-white" : "text-white/35"}`}>{pixValue || "Nenhuma chave cadastrada"}</p>}
              </div>
              {!editingPix && (
                <button type="button" onClick={() => { setPixKey(pixValue); setEditingPix(true); }} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-black text-[#69baff] hover:bg-[#168cff]/10">
                  {pixValue ? "Editar" : "Cadastrar"}
                </button>
              )}
            </div>
            {editingPix && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" className="min-w-0 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-[#168cff]/50" autoFocus />
                <button onClick={handleSavePix} className="rounded-xl bg-[#168cff] px-4 py-2.5 text-xs font-black text-white">Salvar</button>
                <button onClick={() => setEditingPix(false)} className="rounded-xl border border-white/[0.08] px-3 py-2.5 text-xs font-bold text-white/50">Cancelar</button>
              </div>
            )}
          </section>

          <button onClick={() => handleWithdraw("normal")} className="mt-4 flex w-full items-center justify-between rounded-2xl bg-white px-4 py-4 text-left text-sm font-black text-black transition hover:bg-white/90">
            <span className="flex items-center gap-3"><MoneyEmoji className="h-5 w-5" /> Solicitar saque</span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-black/45">5 a 7 dias úteis <ChevronRight className="h-4 w-4" /></span>
          </button>

          <div className="mt-3 grid gap-2">
            <input type="file" ref={fileInputRef} accept="image/*,.pdf" onChange={handleDocumentUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex w-full items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-left transition hover:bg-white/[0.05] disabled:opacity-50">
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-white/55">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</span>
                <span><span className="block text-sm font-bold text-white">{uploading ? "Enviando documento…" : "Enviar documentos"}</span><span className="block text-[10px] text-white/35">RG, certidão ou arquivo de verificação · até 5 MB</span></span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
            </button>

            <a href="/perfil" onClick={onClose} className="flex w-full items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-left transition hover:bg-white/[0.05]">
              <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.05] text-white/55"><Shield className="h-4 w-4" /></span><span><span className="block text-sm font-bold text-white">Dados pessoais e verificação</span><span className="block text-[10px] text-white/35">Segurança, identidade e situação da conta</span></span></span>
              <ChevronRight className="h-4 w-4 text-white/25" />
            </a>
          </div>

          {isAdmin && <div className="mt-4"><TwoFactorPanel /></div>}

          <button onClick={() => { onClose(); logout(); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-red-400 transition hover:bg-red-500/[0.06]">
            <DoorEmoji className="h-5 w-5" /> Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
