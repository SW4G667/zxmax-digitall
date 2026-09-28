import React, { useEffect, useRef, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Image as ImageIcon, Loader2, Palette, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteBranding, useSiteBranding } from "@/context/SiteBrandingContext";
import AppShell from "@/components/AppShell";

const inputClass = "w-full rounded-xl border border-white/[0.09] bg-[#0d0d11] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[var(--zx-accent)]";

type UploadSlot =
  | "logo"
  | "favicon"
  | "heroBanner"
  | "socialPreview"
  | "robuxBanner"
  | "promoBanner1"
  | "promoBanner2"
  | "promoBanner3";

type ImageField =
  | "logoUrl"
  | "faviconUrl"
  | "heroBannerUrl"
  | "socialPreviewUrl"
  | "robuxBannerUrl"
  | "promoBanner1Url"
  | "promoBanner2Url"
  | "promoBanner3Url";

function AssetCard({
  label,
  hint,
  value,
  slot,
  busy,
  onUpload,
  onRemove,
  compact = false,
}: {
  label: string;
  hint: string;
  value: string;
  slot: UploadSlot;
  busy: string | null;
  onUpload: (slot: UploadSlot, file?: File) => void;
  onRemove: () => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const uploading = busy === slot;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#101013]">
      <div className={`relative overflow-hidden bg-[#0b0b0e] ${compact ? "h-24" : "aspect-[16/7]"}`}>
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-white/18">
            <ImageIcon className="h-7 w-7" />
          </div>
        )}
        {uploading ? (
          <div className="absolute inset-0 grid place-items-center bg-black/60"><Loader2 className="h-5 w-5 animate-spin text-white" /></div>
        ) : null}
      </div>
      <div className="p-3.5">
        <p className="text-xs font-bold text-white">{label}</p>
        <p className="mt-1 min-h-8 text-[10px] leading-4 text-white/34">{hint}</p>
        <div className="mt-3 flex gap-2">
          <input
            ref={ref}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
            className="hidden"
            onChange={(event) => onUpload(slot, event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={Boolean(busy)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.025] px-3 py-2 text-[10px] font-bold text-white/70 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-45"
          >
            <Upload className="h-3.5 w-3.5" /> {value ? "Trocar" : "Enviar"}
          </button>
          {value ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={Boolean(busy)}
              aria-label={`Remover ${label}`}
              className="grid h-8 w-8 place-items-center rounded-lg border border-red-400/10 text-red-300/65 transition hover:bg-red-500/[0.06] hover:text-red-200 disabled:opacity-45"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminBranding() {
  const { user, isAdmin, loading, adminRoleResolved, refreshAuthorization } = useAuth();
  const { branding, refreshBranding } = useSiteBranding();
  const [form, setForm] = useState<SiteBranding>(branding);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => setForm(branding), [branding]);
  useEffect(() => {
    if (user && !adminRoleResolved) void refreshAuthorization();
  }, [user, adminRoleResolved, refreshAuthorization]);

  if (loading || (user && !adminRoleResolved)) {
    return <div className="grid min-h-screen place-items-center bg-[#090a0d] text-white/45"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/loja?login=1" replace />;
  if (!isAdmin) return <Navigate to="/admin" replace />;

  const fieldForSlot: Record<UploadSlot, ImageField> = {
    logo: "logoUrl",
    favicon: "faviconUrl",
    heroBanner: "heroBannerUrl",
    socialPreview: "socialPreviewUrl",
    robuxBanner: "robuxBannerUrl",
    promoBanner1: "promoBanner1Url",
    promoBanner2: "promoBanner2Url",
    promoBanner3: "promoBanner3Url",
  };

  const upload = async (slot: UploadSlot, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Escolha uma imagem válida.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Máximo de 5 MB para banners e 2 MB para logo/ícone.");

    const reader = new FileReader();
    reader.onload = async () => {
      setUploading(slot);
      try {
        const { data, error } = await supabase.functions.invoke("site-config", {
          body: { action: "upload", slot, dataUrl: String(reader.result || "") },
        });
        if (error || data?.error) throw new Error(data?.error || "Falha ao enviar imagem.");
        if (data?.branding) setForm((current) => ({ ...current, ...data.branding }));
        await refreshBranding();
        toast.success("Imagem atualizada.");
      } catch (error: any) {
        toast.error(error?.message || "Não foi possível enviar a imagem.");
      } finally {
        setUploading(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("site-config", { body: { action: "save", values: form } });
      if (error || data?.error) throw new Error(data?.error || "Falha ao salvar.");
      if (data?.branding) setForm((current) => ({ ...current, ...data.branding }));
      await refreshBranding();
      toast.success("A aparência do site foi atualizada.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar a aparência.");
    } finally {
      setSaving(false);
    }
  };

  const setField = <K extends keyof SiteBranding>(field: K, value: SiteBranding[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const assets: Array<{ label: string; hint: string; slot: UploadSlot; field: ImageField; compact?: boolean }> = [
    { label: "Logo do cabeçalho", hint: "Use uma marca horizontal ou símbolo simples. O cabeçalho fica limpo no celular.", slot: "logo", field: "logoUrl", compact: true },
    { label: "Favicon", hint: "Ícone mostrado na aba do navegador.", slot: "favicon", field: "faviconUrl", compact: true },
    { label: "Capa principal", hint: "Banner da home. Se ficar vazio, a home usa o layout sem imagem.", slot: "heroBanner", field: "heroBannerUrl" },
    { label: "Imagem ao compartilhar o link", hint: "Esta imagem aparece fora do site em previews de Discord, WhatsApp e redes sociais.", slot: "socialPreview", field: "socialPreviewUrl" },
    { label: "Banner de Robux", hint: "Imagem usada para destacar o mercado de Robux.", slot: "robuxBanner", field: "robuxBannerUrl" },
    { label: "Banner promocional 1", hint: "Espaço opcional para campanha ou categoria.", slot: "promoBanner1", field: "promoBanner1Url" },
    { label: "Banner promocional 2", hint: "Segundo espaço promocional opcional.", slot: "promoBanner2", field: "promoBanner2Url" },
    { label: "Banner promocional 3", hint: "Terceiro espaço promocional opcional.", slot: "promoBanner3", field: "promoBanner3Url" },
  ];

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-[1100px] pb-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.07] pb-5">
          <div>
            <Link to="/admin" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/38 transition hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Admin
            </Link>
            <p className="mt-4 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--zx-accent)]">Aparência do site</p>
            <h1 className="mt-1.5 text-2xl font-extrabold tracking-[-0.04em] text-white sm:text-3xl">Identidade visual</h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-white/38">Altere textos, cor, logo e banners do site. A imagem de compartilhamento é separada e só aparece no preview do link fora da página.</p>
          </div>
          <button
            onClick={() => void save()}
            disabled={saving || Boolean(uploading)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--zx-accent)] px-4 py-2.5 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-45"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar alterações
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="space-y-5">
            <div className="rounded-xl border border-white/[0.08] bg-[#101013] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-[var(--zx-accent)]" />
                <h2 className="text-sm font-bold text-white">Marca e textos</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-white/52">Nome do marketplace
                  <input className={`${inputClass} mt-1.5`} value={form.siteName} onChange={(event) => setField("siteName", event.target.value)} maxLength={40} />
                </label>
                <label className="text-[11px] font-semibold text-white/52">Cor principal
                  <div className="mt-1.5 flex gap-2">
                    <input type="color" value={form.accentColor} onChange={(event) => setField("accentColor", event.target.value)} className="h-11 w-12 rounded-lg border border-white/[0.09] bg-[#0d0d11] p-1" />
                    <input className={inputClass} value={form.accentColor} onChange={(event) => setField("accentColor", event.target.value)} placeholder="#168cff" />
                  </div>
                </label>
              </div>
              <label className="mt-3 block text-[11px] font-semibold text-white/52">Título da home
                <input className={`${inputClass} mt-1.5`} value={form.heroTitle} onChange={(event) => setField("heroTitle", event.target.value)} maxLength={100} />
              </label>
              <label className="mt-3 block text-[11px] font-semibold text-white/52">Subtítulo
                <textarea className={`${inputClass} mt-1.5 min-h-24 resize-none`} value={form.heroSubtitle} onChange={(event) => setField("heroSubtitle", event.target.value)} maxLength={220} />
              </label>
              <div className="mt-4 rounded-xl border border-[#5865f2]/18 bg-[#5865f2]/[0.045] p-4">
                <p className="text-xs font-bold text-white">Comunidade e suporte</p>
                <p className="mt-1 text-[10px] leading-4 text-white/35">O convite oficial do Discord é usado no cabeçalho, na central de suporte e para confirmar a entrada de quem quer anunciar.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-[11px] font-semibold text-white/52">Convite oficial do Discord
                    <input className={`${inputClass} mt-1.5`} value={form.discordInviteUrl} onChange={(event) => setField("discordInviteUrl", event.target.value)} placeholder="https://discord.gg/seu-convite" />
                  </label>
                  <label className="text-[11px] font-semibold text-white/52">Link externo de suporte <span className="text-white/25">(opcional)</span>
                    <input className={`${inputClass} mt-1.5`} value={form.supportUrl} onChange={(event) => setField("supportUrl", event.target.value)} placeholder="https://..." />
                  </label>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3">
                <h2 className="text-sm font-bold text-white">Imagens do site</h2>
                <p className="mt-1 text-[11px] text-white/34">Você pode deixar qualquer banner vazio. Não é obrigatório usar imagem em todos os espaços.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {assets.map((asset) => (
                  <AssetCard
                    key={asset.slot}
                    label={asset.label}
                    hint={asset.hint}
                    value={form[asset.field]}
                    slot={asset.slot}
                    busy={uploading}
                    compact={asset.compact}
                    onUpload={(slot, file) => void upload(slot, file)}
                    onRemove={() => setField(asset.field, "")}
                  />
                ))}
              </div>
            </div>
          </section>

          <aside className="h-fit lg:sticky lg:top-20">
            <div className="rounded-xl border border-white/[0.08] bg-[#101013] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/28">Prévia da home</p>
                <Link to="/" target="_blank" className="inline-flex items-center gap-1 text-[10px] font-semibold text-white/38 hover:text-white">Abrir <ExternalLink className="h-3 w-3" /></Link>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.07] bg-[#090a0d]">
                {form.heroBannerUrl ? (
                  <div className="relative aspect-[16/7]">
                    <img src={form.heroBannerUrl} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                  </div>
                ) : null}
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    {form.logoUrl ? <img src={form.logoUrl} alt="" className="h-6 max-w-[105px] object-contain object-left" /> : <span className="font-black text-white">{form.siteName}</span>}
                  </div>
                  <h3 className="mt-4 text-xl font-extrabold leading-tight tracking-[-0.04em] text-white">{form.heroTitle}</h3>
                  <p className="mt-2 text-[10px] leading-4 text-white/38">{form.heroSubtitle}</p>
                  <div className="mt-4 h-9 rounded-lg bg-[var(--zx-accent)] text-center text-[10px] font-bold leading-9 text-white">Explorar anúncios</div>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-white/28">A prévia usa as alterações locais. Clique em “Salvar alterações” para publicar textos, cor e remoções de imagem.</p>
            </div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
