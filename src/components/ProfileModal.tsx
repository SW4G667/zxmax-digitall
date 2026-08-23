import React, { useState, useRef } from "react";
import { useStore } from "@/store/StoreContext";
import { useAuth } from "@/hooks/useAuth";
import { StarEmoji, MoneyEmoji, DoorEmoji, CameraEmoji, KeyEmoji } from "@/components/CustomEmojis";
import { X, Edit, Upload, Shield } from "lucide-react";
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

  const handleWithdraw = (method: "normal" | "instant") => {
    if (!storeUser.isVerified) return toast.error("Você precisa ter seus documentos aprovados pelo admin para sacar.");
    if (storeUser.balance < 3.50) return toast.error("Saldo mínimo para saque é R$ 3,50.");
    if (!profile?.pix_key && !storeUser.pixKey) return toast.error("Cadastre sua chave Pix antes de solicitar saque.");
    requestWithdraw(method);
    toast.success("Saque solicitado! Após aprovação do admin, o valor cai em 5 a 7 dias úteis.");
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
      toast.success("Foto de perfil atualizada!");
    } catch (err: any) {
      toast.error("Erro ao atualizar foto: " + (err?.message || "Tente novamente."));
    }
    setAvatarUploading(false);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const displayName = profile?.display_name || storeUser.name;


  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-lg p-7 bg-card animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-bold text-foreground">Meu Perfil</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="flex items-center gap-5 mb-6 p-5 bg-muted rounded-2xl">
          <div className="relative">
            <img src={profile?.avatar_url || storeUser.avatar} className="w-20 h-20 rounded-2xl object-cover shadow-lg" alt="Avatar" />
            <input type="file" ref={avatarInputRef} accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} className="absolute -bottom-2 -right-2 bg-card p-1.5 rounded-lg shadow-md border border-border hover:bg-muted transition disabled:opacity-50">
              <CameraEmoji className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="flex gap-2">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-lg font-bold bg-card rounded-xl px-3 py-1 border border-border text-foreground flex-1" autoFocus />
                <button onClick={handleSave} className="btn-gradient px-3 py-1 text-xs">Salvar</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-foreground">{displayName}</p>
                <button onClick={() => setEditing(true)}><Edit className="w-4 h-4 text-muted-foreground" /></button>
              </div>
            )}
            <p className="text-muted-foreground text-xs mt-0.5 font-mono break-all">ID: {storeUser.publicId}</p>
            {storeUser.isVerified && (
              <p className="text-success text-sm mt-0.5 font-semibold flex items-center gap-1">
                <Shield className="w-3 h-3" /> Vendedor Verificado
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 bg-primary/5 rounded-2xl">
            <p className="text-[10px] font-bold text-primary uppercase">Saldo Disponível</p>
            <p className="text-2xl font-black text-primary">R$ {storeUser.balance.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-success/5 rounded-2xl">
            <p className="text-[10px] font-bold text-success uppercase">Ganhos Totais</p>
            <p className="text-2xl font-black text-success">R$ {storeUser.earnings.toFixed(2)}</p>
          </div>
        </div>

        {/* Pix Key */}
        <div className="mb-4 p-4 bg-muted rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <KeyEmoji className="w-4 h-4" /> Dados para Saque (Pix)
            </p>
            {!editingPix && (
              <button onClick={() => setEditingPix(true)} className="text-primary text-xs font-bold">{profile?.pix_key || storeUser.pixKey ? "Editar" : "Cadastrar"}</button>
            )}
          </div>
          {editingPix ? (
            <div className="flex gap-2">
              <input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CPF, email, telefone ou chave aleatória"
                className="flex-1 p-2.5 rounded-xl bg-card text-foreground text-sm border border-border outline-none focus:ring-2 ring-primary"
                autoFocus
              />
              <button onClick={handleSavePix} className="btn-gradient px-3 py-1 text-xs">Salvar</button>
              <button onClick={() => setEditingPix(false)} className="text-xs text-muted-foreground">Cancelar</button>
            </div>
          ) : (
            <p className="text-sm text-foreground">{profile?.pix_key || storeUser.pixKey || <span className="text-muted-foreground italic">Nenhuma chave cadastrada</span>}</p>
          )}
        </div>

        <div className="space-y-2">
          <button onClick={() => handleWithdraw("normal")} className="w-full flex items-center justify-between p-4 bg-foreground text-background rounded-xl font-bold text-sm hover:opacity-90 transition">
            <div className="flex items-center gap-2">
              <MoneyEmoji className="w-5 h-5" />
              <span>Solicitar Saque (5 a 7 dias úteis)</span>
            </div>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,.pdf"
            onChange={handleDocumentUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 p-3 border border-border rounded-xl text-muted-foreground font-semibold text-sm hover:bg-muted transition disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> {uploading ? "Enviando..." : "Enviar Documentos (RG / Certidão)"}
          </button>
          
          <a href="/perfil" className="w-full flex items-center justify-center gap-2 p-3 border border-border rounded-xl text-muted-foreground font-semibold text-sm hover:bg-muted transition">
            <Shield className="w-4 h-4" /> Dados pessoais e verificação
          </a>

          {isAdmin && <TwoFactorPanel />}

          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center justify-center gap-2 p-3 text-destructive font-bold text-sm hover:bg-destructive/5 rounded-xl transition"
          >
            <DoorEmoji className="w-5 h-5" /> Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}
