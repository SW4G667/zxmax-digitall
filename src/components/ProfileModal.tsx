import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { StarEmoji, MoneyEmoji, DoorEmoji, CameraEmoji, KeyEmoji } from "@/components/CustomEmojis";
import { X, CreditCard as Edit, Upload, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: Props) {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [editName, setEditName] = useState("");
  const [editing, setEditing] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [editingPix, setEditingPix] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditName(profile.display_name || "");
      setPixKey(profile.pix_key || "");
    }
  }, [profile]);

  if (!open || !profile || !user) return null;

  const displayName = profile.display_name || profile.email?.split("@")[0] || "Usuario";
  const avatarUrl = profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ display_name: editName.trim(), updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) throw error;
      await refreshProfile();
      toast.success("Perfil atualizado!");
    } catch (err) {
      toast.error("Erro ao atualizar perfil");
    }
    setSaving(false);
    setEditing(false);
  };

  const handleSavePix = async () => {
    if (!pixKey.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ pix_key: pixKey.trim(), updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) throw error;
      await refreshProfile();
      toast.success("Chave Pix salva!");
    } catch (err) {
      toast.error("Erro ao salvar chave Pix");
    }
    setSaving(false);
    setEditingPix(false);
  };

  const handleWithdraw = async () => {
    const balance = Number(profile.balance || 0);
    if (balance < 3.50) {
      toast.error("O saldo minimo para saque e de R$ 3,50.");
      return;
    }
    if (!profile.pix_key) {
      toast.error("Cadastre sua chave Pix antes de solicitar saque.");
      return;
    }

    try {
      const { error } = await supabase.from("withdrawals").insert({
        seller_id: user.id,
        amount: balance,
        pix_key: profile.pix_key,
        type: "normal",
        fee: 0,
      });

      if (error) throw error;

      // Deduct balance
      await supabase
        .from("users")
        .update({ balance: 0, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      await refreshProfile();
      toast.success(`Saque solicitado com sucesso!`);
    } catch (err) {
      toast.error("Erro ao solicitar saque");
    }
  };

  const copyUserId = async () => {
    await navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    toast.success("ID copiado!");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleLogout = async () => {
    await signOut();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-lg p-7 bg-card animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-bold text-foreground">Meu Perfil</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {/* User ID */}
        <div className="mb-4 p-3 bg-muted rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Seu ID</p>
              <p className="text-xs font-mono text-foreground break-all">{user.id}</p>
            </div>
            <button onClick={copyUserId} className="p-2 hover:bg-card rounded-lg transition">
              {copiedId ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-5 mb-6 p-5 bg-muted rounded-2xl">
          <div className="relative">
            <img src={avatarUrl} className="w-20 h-20 rounded-2xl object-cover shadow-lg" alt="Avatar" />
            <button className="absolute -bottom-2 -right-2 bg-card p-1.5 rounded-lg shadow-md border border-border">
              <CameraEmoji className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="flex gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-lg font-bold bg-card rounded-xl px-3 py-1 border border-border text-foreground flex-1 outline-none focus:ring-2 ring-primary"
                  autoFocus
                  disabled={saving}
                />
                <button onClick={handleSave} disabled={saving} className="btn-gradient px-3 py-1 text-xs disabled:opacity-50">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-foreground">{displayName}</p>
                <button onClick={() => setEditing(true)}><Edit className="w-4 h-4 text-muted-foreground" /></button>
              </div>
            )}
            <p className="text-muted-foreground text-sm mt-0.5">{profile.email}</p>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((s) => <StarEmoji key={s} className="w-4 h-4" />)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 bg-primary/5 rounded-2xl">
            <p className="text-[10px] font-bold text-primary uppercase">Saldo Disponivel</p>
            <p className="text-2xl font-black text-primary">R$ {Number(profile.balance || 0).toFixed(2)}</p>
          </div>
          <div className="p-4 bg-success/5 rounded-2xl">
            <p className="text-[10px] font-bold text-success uppercase">Ganhos Totais</p>
            <p className="text-2xl font-black text-success">R$ {Number(profile.earnings || 0).toFixed(2)}</p>
          </div>
        </div>

        {/* Pix Key */}
        <div className="mb-4 p-4 bg-muted rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <KeyEmoji className="w-4 h-4" /> Dados para Saque (Pix)
            </p>
            {!editingPix && (
              <button onClick={() => setEditingPix(true)} className="text-primary text-xs font-bold">{profile.pix_key ? "Editar" : "Cadastrar"}</button>
            )}
          </div>
          {editingPix ? (
            <div className="flex gap-2">
              <input
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CPF, email, telefone ou chave aleatoria"
                className="flex-1 p-2.5 rounded-xl bg-card text-foreground text-sm border border-border outline-none focus:ring-2 ring-primary"
                autoFocus
                disabled={saving}
              />
              <button onClick={handleSavePix} disabled={saving} className="btn-gradient px-3 py-1 text-xs disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => setEditingPix(false)} className="text-xs text-muted-foreground">Cancelar</button>
            </div>
          ) : (
            <p className="text-sm text-foreground">{profile.pix_key || <span className="text-muted-foreground italic">Nenhuma chave cadastrada</span>}</p>
          )}
        </div>

        <div className="space-y-2">
          {Number(profile.balance || 0) >= 3.50 && (
            <button
              onClick={handleWithdraw}
              className="w-full flex items-center justify-between p-4 btn-gradient rounded-xl font-bold text-sm hover:opacity-90 transition"
            >
              <div className="flex items-center gap-2">
                <MoneyEmoji className="w-5 h-5" />
                <span>Solicitar Saque (R$ 3,50+)</span>
              </div>
            </button>
          )}
          <button className="w-full flex items-center justify-center gap-2 p-3 border border-border rounded-xl text-muted-foreground font-semibold text-sm hover:bg-muted transition">
            <Upload className="w-4 h-4" /> Enviar Documentos (RG ou Certidao)
          </button>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 text-destructive font-bold text-sm hover:bg-destructive/5 rounded-xl transition">
            <DoorEmoji className="w-5 h-5" /> Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}
