import { Ban, FileCheck2, LockKeyhole, PackageCheck, ShieldAlert, Tag, Webhook } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Capability = "moderate_catalog" | "review_identity" | "manage_user_safety" | "manage_tags" | "view_sanitized_webhooks";

const cards: Array<{ capability: Capability; title: string; description: string; tab?: string; icon: typeof Ban }> = [
  { capability: "moderate_catalog", title: "Moderação de anúncios", description: "Aprovar ou pausar itens pelo contrato auditado.", tab: "products", icon: PackageCheck },
  { capability: "review_identity", title: "Verificações de vendedor", description: "Consultar e revisar documentos ou cadastros pendentes.", tab: "verifications", icon: FileCheck2 },
  { capability: "manage_user_safety", title: "Segurança de usuários", description: "Aplicar ou remover bloqueios com motivo obrigatório.", icon: Ban },
  { capability: "manage_tags", title: "Tags de usuários", description: "Criar e vincular identificadores por ID público.", tab: "tags", icon: Tag },
  { capability: "view_sanitized_webhooks", title: "Eventos técnicos", description: "Ler registros sanitizados de integrações.", tab: "webhooks", icon: Webhook },
];

function operationError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/permission|permissão|aal2|unauthorized|authentication/i.test(message)) return "Você não tem a permissão necessária para esta ação.";
  return fallback;
}

export default function OperatorConsole({ capabilities, onOpenTab }: { capabilities: string[]; onOpenTab: (tab: any) => void }) {
  const [publicId, setPublicId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const allowed = new Set(capabilities);

  const changeSafetyStatus = async (action: "ban_user" | "unban_user") => {
    const identifier = publicId.trim();
    if (!identifier) return toast.error("Informe o ID público da conta.");
    if (action === "ban_user" && reason.trim().length < 3) return toast.error("Informe um motivo de pelo menos 3 caracteres.");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-verify", {
      body: { action, identifier, ...(action === "ban_user" ? { reason: reason.trim() } : {}) },
    });
    setBusy(false);
    if (error || data?.error) {
      toast.error(operationError(data?.error || error, "A atualização de segurança não foi confirmada."));
      return;
    }
    toast.success(action === "ban_user" ? "Bloqueio registrado com auditoria." : "Bloqueio removido com auditoria.");
    setPublicId("");
    setReason("");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
        <div className="flex gap-3"><div className="p-2.5 rounded-xl bg-[#0084ff]/10 text-[#4ca3ff] h-fit"><ShieldAlert className="w-5 h-5" /></div><div><h2 className="font-black text-white">Console de operações</h2><p className="text-sm text-white/55 mt-1">As opções abaixo vêm das permissões confirmadas para a sua conta. Ações não liberadas não são exibidas e o servidor confere cada solicitação novamente.</p></div></div>
      </section>

      <section className="grid md:grid-cols-2 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const canUse = allowed.has(card.capability);
          return <button key={card.capability} onClick={() => { if (!canUse) { toast.error("Você não tem a permissão necessária para esta ação."); return; } if (card.tab) onOpenTab(card.tab); }} aria-disabled={!canUse || !card.tab} className={`text-left rounded-2xl border p-5 transition-colors ${canUse && card.tab ? "border-[#253149] bg-[#0d1420] hover:border-[#0084ff]" : "border-[#25252e] bg-[#111116] opacity-70 cursor-not-allowed"}`}><div className="flex gap-3"><Icon className={`w-5 h-5 mt-0.5 ${canUse ? "text-[#4ca3ff]" : "text-white/35"}`} /><div><p className="font-bold text-white">{card.title}</p><p className="text-xs text-white/45 mt-1 leading-relaxed">{card.description}</p><p className={`text-[11px] mt-3 font-medium ${canUse ? "text-emerald-300" : "text-white/35"}`}>{canUse ? (card.tab ? "Abrir área permitida" : "Ação disponível abaixo") : "Você não tem esta permissão"}</p></div></div></button>;
        })}
      </section>

      {allowed.has("manage_user_safety") && <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6 space-y-4"><div><h3 className="font-bold text-white">Proteção de conta</h3><p className="text-xs text-white/45 mt-1">Use o ID público e um motivo claro. Não é possível bloquear administradores nem a própria conta.</p></div><input value={publicId} onChange={(event) => setPublicId(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="ID público da conta" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm focus:border-[#0084ff] outline-none" /><textarea value={reason} onChange={(event) => setReason(event.target.value.slice(0, 500))} placeholder="Motivo do bloqueio" className="w-full min-h-24 p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm focus:border-[#0084ff] outline-none" /><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void changeSafetyStatus("ban_user")} className="bg-red-500/15 text-red-200 border border-red-500/30 px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">Bloquear conta</button><button disabled={busy} onClick={() => void changeSafetyStatus("unban_user")} className="bg-white/5 text-white border border-white/10 px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">Remover bloqueio</button></div></section>}

      <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5"><div className="flex gap-3"><LockKeyhole className="w-5 h-5 text-amber-300 mt-0.5" /><div><p className="font-bold text-amber-100">Controles reservados</p><p className="text-sm text-amber-100/70 mt-1">Manutenção, credenciais, pagamentos, saques, integrações e cargos continuam restritos ao administrador principal e não podem ser liberados por esta tela.</p></div></div></section>
    </div>
  );
}
