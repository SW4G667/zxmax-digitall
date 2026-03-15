import React, { useState } from "react";
import { useStore } from "@/store/StoreContext";
import { StarEmoji, MoneyEmoji, DoorEmoji, CameraEmoji } from "@/components/CustomEmojis";
import { X, Edit, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: Props) {
  const { state, updateProfile, requestWithdraw, logout } = useStore();
  const user = state.currentUser;
  const [editName, setEditName] = useState(user?.name || "");
  const [editing, setEditing] = useState(false);

  if (!open || !user) return null;

  const handleSave = () => {
    if (editName.trim()) {
      updateProfile(editName.trim());
      toast.success("Perfil atualizado!");
    }
    setEditing(false);
  };

  const handleWithdraw = (method: "normal" | "instant") => {
    if (user.balance <= 0) return toast.error("Saldo insuficiente.");
    requestWithdraw(method);
    toast.success(`Saque ${method === "instant" ? "instantâneo" : "normal"} solicitado!`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-lg p-7 bg-card animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-bold text-foreground">Meu Perfil</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="flex items-center gap-5 mb-6 p-5 bg-muted rounded-2xl">
          <div className="relative">
            <img src={user.avatar} className="w-20 h-20 rounded-2xl object-cover shadow-lg" alt="Avatar" />
            <button className="absolute -bottom-2 -right-2 bg-card p-1.5 rounded-lg shadow-md border border-border">
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
                <p className="text-lg font-bold text-foreground">{user.name}</p>
                <button onClick={() => setEditing(true)}><Edit className="w-4 h-4 text-muted-foreground" /></button>
              </div>
            )}
            <p className="text-muted-foreground text-sm mt-0.5">Vendedor Verificado</p>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((s) => <StarEmoji key={s} className="w-4 h-4" />)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 bg-primary/5 rounded-2xl">
            <p className="text-[10px] font-bold text-primary uppercase">Saldo Disponível</p>
            <p className="text-2xl font-black text-primary">R$ {user.balance.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-success/5 rounded-2xl">
            <p className="text-[10px] font-bold text-success uppercase">Ganhos Totais</p>
            <p className="text-2xl font-black text-success">R$ {user.earnings.toFixed(2)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <button onClick={() => handleWithdraw("normal")} className="w-full flex items-center justify-between p-4 bg-foreground text-background rounded-xl font-bold text-sm hover:opacity-90 transition">
            <div className="flex items-center gap-2">
              <MoneyEmoji className="w-5 h-5" />
              <span>Saque Normal (5-7 dias)</span>
            </div>
          </button>
          <button onClick={() => handleWithdraw("instant")} className="w-full flex items-center justify-between p-4 btn-gradient text-sm">
            <div className="flex items-center gap-2">
              <MoneyEmoji className="w-5 h-5" />
              <span>Saque Instantâneo (taxa {state.config.instantFee}%)</span>
            </div>
          </button>
          <button className="w-full flex items-center justify-center gap-2 p-3 border border-border rounded-xl text-muted-foreground font-semibold text-sm hover:bg-muted transition">
            <Upload className="w-4 h-4" /> Enviar Documentos (RG/CPF)
          </button>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 p-3 text-destructive font-bold text-sm hover:bg-destructive/5 rounded-xl transition">
            <DoorEmoji className="w-5 h-5" /> Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}
