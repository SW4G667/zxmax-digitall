import { ShieldCheck, Users, RefreshCw, LockKeyhole, BadgeCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "support" | "user";

interface StaffMember {
  public_id: number;
  display_name: string;
  role: Role;
  capabilities: string[];
}

const CAPABILITIES = [
  { id: "moderate_catalog", label: "Moderar anúncios", description: "Aprova ou pausa anúncios pelo contrato auditado." },
  { id: "review_identity", label: "Revisar identidade", description: "Lê e decide verificações e documentos no servidor." },
  { id: "manage_user_safety", label: "Segurança de usuários", description: "Aplica ou remove bloqueios com motivo e auditoria." },
  { id: "manage_tags", label: "Gerenciar tags", description: "Cria, remove e atribui tags por ID público." },
  { id: "view_sanitized_webhooks", label: "Ver eventos técnicos", description: "Consulta logs sanitizados, sem payloads ou segredos." },
] as const;

function describeError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/permission|permissão|admin_required|aal2|authentication|required/i.test(message)) {
    return "Você não tem a permissão necessária para esta ação.";
  }
  if (/user_not_found|usuário não encontrado/i.test(message)) return "Não foi encontrada uma conta com esse ID público.";
  if (/capabilities_require_support_role/i.test(message)) return "Capacidades só podem ser atribuídas a contas no cargo Suporte.";
  return fallback;
}

export default function AdminRolePermissionsPanel() {
  const [directory, setDirectory] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publicId, setPublicId] = useState("");
  const [targetRole, setTargetRole] = useState<Role>("support");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftCapabilities, setDraftCapabilities] = useState<string[]>([]);

  const selected = useMemo(
    () => directory.find((member) => member.public_id === selectedId) ?? null,
    [directory, selectedId],
  );

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_admin_capability_directory");
    setLoading(false);
    if (error) {
      toast.error(describeError(error, "Não foi possível carregar os cargos agora."));
      return;
    }
    const members = Array.isArray(data) ? data : [];
    setDirectory(members.map((member: any) => ({
      public_id: Number(member.public_id),
      display_name: String(member.display_name || "Conta sem nome público"),
      role: member.role === "admin" || member.role === "support" ? member.role : "user",
      capabilities: Array.isArray(member.capabilities) ? member.capabilities.map(String) : [],
    })));
  }, []);

  useEffect(() => { void loadDirectory(); }, [loadDirectory]);

  const selectMember = (member: StaffMember) => {
    setSelectedId(member.public_id);
    setDraftCapabilities(member.capabilities);
  };

  const assignRole = async () => {
    const normalized = Number(publicId);
    if (!Number.isSafeInteger(normalized) || normalized <= 0) {
      toast.error("Informe um ID público numérico válido.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("assign_user_role_by_public_id", {
      _public_id: normalized,
      _role: targetRole,
    });
    setSaving(false);
    if (error) {
      toast.error(describeError(error, "Não foi possível atualizar o cargo. Nenhuma permissão foi alterada."));
      return;
    }
    toast.success(targetRole === "support" ? "Cargo Suporte atribuído. Configure as capacidades abaixo." : "Cargo atualizado com auditoria.");
    setPublicId("");
    await loadDirectory();
    setSelectedId(normalized);
  };

  const toggleCapability = (capability: string) => {
    setDraftCapabilities((current) => current.includes(capability)
      ? current.filter((value) => value !== capability)
      : [...current, capability]);
  };

  const saveCapabilities = async () => {
    if (!selected || selected.role !== "support") return;
    setSaving(true);
    const { error } = await (supabase as any).rpc("update_user_capabilities", {
      _public_id: selected.public_id,
      _capabilities: draftCapabilities,
    });
    setSaving(false);
    if (error) {
      toast.error(describeError(error, "Não foi possível salvar as permissões. Nenhuma alteração foi confirmada."));
      return;
    }
    toast.success("Permissões atualizadas e registradas na auditoria.");
    await loadDirectory();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
        <div className="flex gap-3">
          <div className="p-2.5 rounded-xl bg-[#0084ff]/10 text-[#4ca3ff] h-fit"><ShieldCheck className="w-5 h-5" /></div>
          <div>
            <h3 className="font-black text-white">Cargos e permissões auditáveis</h3>
            <p className="text-sm text-white/55 mt-1 leading-relaxed">O cargo <strong className="text-white">Suporte</strong> não recebe poder por padrão. Cada capacidade é confirmada no servidor, exige 2FA e registra quem fez a alteração. Use somente ID público — e-mail não é necessário neste fluxo.</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-5 text-xs">
          <div className="rounded-xl border border-[#253149] bg-[#0d1420] p-3"><p className="font-bold text-white">Admin principal</p><p className="mt-1 text-white/50">Mantém operações de plataforma, pagamentos, integrações, manutenção e cargos.</p></div>
          <div className="rounded-xl border border-[#253149] bg-[#0d1420] p-3"><p className="font-bold text-white">Suporte</p><p className="mt-1 text-white/50">Recebe apenas capacidades marcadas abaixo, depois da confirmação por 2FA.</p></div>
          <div className="rounded-xl border border-[#253149] bg-[#0d1420] p-3"><p className="font-bold text-white">Usuário</p><p className="mt-1 text-white/50">Usa recursos próprios de compra, venda e atendimento.</p></div>
        </div>
      </section>

      <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6 space-y-4">
        <div><h4 className="font-bold text-white">Alterar cargo por ID público</h4><p className="text-xs text-white/45 mt-1">Ao trocar de Suporte para outro cargo, as capacidades delegadas são removidas no servidor.</p></div>
        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3">
          <input value={publicId} onChange={(event) => setPublicId(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="ID público do usuário" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm focus:border-[#0084ff] outline-none" />
          <select value={targetRole} onChange={(event) => setTargetRole(event.target.value as Role)} className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm focus:border-[#0084ff] outline-none">
            <option value="support">Suporte — configurar permissões</option>
            <option value="user">Usuário padrão</option>
            <option value="admin">Admin principal</option>
          </select>
          <button onClick={() => void assignRole()} disabled={saving} className="bg-[#0084ff] text-white px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-60">Atualizar cargo</button>
        </div>
      </section>

      <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
        <div className="flex items-center justify-between gap-3 mb-4"><div><h4 className="font-bold text-white">Operadores configurados</h4><p className="text-xs text-white/45 mt-1">Selecione uma conta de suporte para ativar ou desativar as permissões permitidas.</p></div><button onClick={() => void loadDirectory()} disabled={loading || saving} className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/5" aria-label="Atualizar lista de operadores"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button></div>
        {loading ? <p className="text-sm text-white/50 py-6">Carregando operadores autorizados…</p> : directory.length === 0 ? <p className="text-sm text-white/50 py-6">Nenhum administrador ou operador de suporte encontrado.</p> : <div className="grid gap-2">{directory.map((member) => <button key={member.public_id} onClick={() => selectMember(member)} className={`flex text-left justify-between items-center gap-3 p-3 rounded-xl border transition-colors ${selectedId === member.public_id ? "border-[#0084ff] bg-[#0084ff]/10" : "border-[#25252e] bg-[#0a0a0f] hover:border-[#33415c]"}`}><div><p className="text-sm font-bold text-white">{member.display_name}</p><p className="text-[11px] text-white/45 font-mono">ID público {member.public_id}</p></div><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${member.role === "admin" ? "bg-amber-400/10 text-amber-300" : "bg-blue-400/10 text-blue-300"}`}>{member.role === "admin" ? "Admin" : "Suporte"}</span></button>)}</div>}
      </section>

      {selected && (
        <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
          <div className="flex gap-3"><div className="p-2.5 rounded-xl bg-white/5 text-white/70 h-fit">{selected.role === "admin" ? <LockKeyhole className="w-5 h-5" /> : <BadgeCheck className="w-5 h-5" />}</div><div><h4 className="font-bold text-white">{selected.display_name} <span className="text-white/40 font-mono text-xs">#{selected.public_id}</span></h4><p className="text-xs text-white/50 mt-1">{selected.role === "admin" ? "Administrador principal: os poderes críticos não são geridos por estes toggles." : "Ative somente as funções que a pessoa realmente precisa executar."}</p></div></div>
          {selected.role === "support" ? <><div className="mt-5 space-y-2">{CAPABILITIES.map((capability) => { const checked = draftCapabilities.includes(capability.id); return <label key={capability.id} className="flex cursor-pointer items-start justify-between gap-4 p-4 rounded-xl border border-[#25252e] bg-[#0a0a0f] hover:border-[#33415c]"><span><span className="text-sm font-bold text-white block">{capability.label}</span><span className="text-xs text-white/45 block mt-1">{capability.description}</span></span><input type="checkbox" checked={checked} onChange={() => toggleCapability(capability.id)} className="mt-1 h-4 w-4 accent-[#0084ff]" aria-label={`Permitir ${capability.label}`} /></label>; })}</div><button onClick={() => void saveCapabilities()} disabled={saving} className="mt-5 bg-[#0084ff] text-white px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-60">Salvar permissões</button></> : <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100/80">Administração de plataforma, credenciais, manutenção, pagamentos e cargos não é delegada por esta tela. Esse isolamento evita remoção acidental do controle principal.</div>}
        </section>
      )}
    </div>
  );
}
