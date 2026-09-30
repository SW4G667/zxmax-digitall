import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const DEFAULTS = {
  siteName: "ZXMAX",
  logoUrl: "",
  faviconUrl: "",
  appIconUrl: "",
  heroTitle: "Compre e venda produtos digitais",
  heroSubtitle: "Encontre ofertas, acompanhe seus pedidos e anuncie com um fluxo simples e seguro.",
  heroBannerUrl: "",
  socialPreviewUrl: "",
  robuxBannerUrl: "",
  promoBanner1Url: "",
  promoBanner2Url: "",
  promoBanner3Url: "",
  accentColor: "#168cff",
  supportUrl: "",
  discordInviteUrl: "",
  discordGuildId: "",
  discordGuildName: "",
};

const UPLOAD_SLOTS: Record<string, { field: keyof typeof DEFAULTS; maxBytes: number }> = {
  logo: { field: "logoUrl", maxBytes: 2 * 1024 * 1024 },
  favicon: { field: "faviconUrl", maxBytes: 2 * 1024 * 1024 },
  appIcon: { field: "appIconUrl", maxBytes: 3 * 1024 * 1024 },
  heroBanner: { field: "heroBannerUrl", maxBytes: 5 * 1024 * 1024 },
  socialPreview: { field: "socialPreviewUrl", maxBytes: 5 * 1024 * 1024 },
  robuxBanner: { field: "robuxBannerUrl", maxBytes: 5 * 1024 * 1024 },
  promoBanner1: { field: "promoBanner1Url", maxBytes: 5 * 1024 * 1024 },
  promoBanner2: { field: "promoBanner2Url", maxBytes: 5 * 1024 * 1024 },
  promoBanner3: { field: "promoBanner3Url", maxBytes: 5 * 1024 * 1024 },
};

const safeText = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const safeUrl = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.toString() : "";
  } catch { return ""; }
};
const safeColor = (value: unknown) => {
  const raw = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : DEFAULTS.accentColor;
};

const safeDiscordInvite = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (host === "discord.gg") {
      const code = url.pathname.split("/").filter(Boolean)[0];
      return code ? `https://discord.gg/${code}` : "";
    }
    if (host === "discord.com" || host === "www.discord.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      const index = parts.findIndex((part) => part === "invite");
      const code = index >= 0 ? parts[index + 1] : "";
      return code ? `https://discord.gg/${code}` : "";
    }
  } catch {
    return "";
  }
  return "";
};

async function resolveDiscordGuild(inviteUrl: string) {
  const code = inviteUrl.split("/").filter(Boolean).at(-1);
  if (!code) return null;
  try {
    const response = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=false&with_expiration=false`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    const id = payload?.guild?.id ? String(payload.guild.id) : "";
    if (!id) return null;
    return {
      id,
      name: safeText(payload?.guild?.name, 100) || "Servidor do Discord",
    };
  } catch {
    return null;
  }
}

async function requireAdmin(req: Request, admin: any) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await userClient.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  const { data: allowed } = await admin.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  return allowed ? data.user : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row } = await admin.from("app_settings").select("value").eq("key", "site_branding").maybeSingle();
  const current = { ...DEFAULTS, ...(row?.value || {}) };

  if (req.method === "GET") {
    const requestUrl = new URL(req.url);
    const asset = requestUrl.searchParams.get("asset");
    if (asset === "favicon" || asset === "socialPreview" || asset === "appIcon") {
      const configured = asset === "favicon"
        ? safeUrl(current.faviconUrl)
        : asset === "appIcon"
          ? safeUrl(current.appIconUrl) || safeUrl(current.logoUrl) || safeUrl(current.faviconUrl)
          : safeUrl(current.socialPreviewUrl) || safeUrl(current.logoUrl);
      const fallback = "https://zxmax.vercel.app/favicon.ico";
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": configured || fallback,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }
    return json({ branding: current });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "get") return json({ branding: current });

    const user = await requireAdmin(req, admin);
    if (!user) return json({ error: "Apenas administradores." }, 403);

    if (body.action === "upload") {
      const slot = String(body.slot || "");
      const config = UPLOAD_SLOTS[slot];
      if (!config) return json({ error: "Tipo de imagem inválido." }, 400);

      const dataUrl = String(body.dataUrl || "");
      const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|x-icon|gif));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return json({ error: "Use PNG, JPG, WEBP, GIF ou ICO." }, 400);

      const mime = match[1];
      const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      if (bytes.byteLength > config.maxBytes) {
        return json({ error: `A imagem deve ter no máximo ${Math.round(config.maxBytes / 1024 / 1024)} MB.` }, 413);
      }

      const ext = mime === "image/jpeg" ? "jpg" : mime === "image/x-icon" ? "ico" : mime.split("/")[1];
      const storagePath = `branding/${slot}.${ext}`;
      const { error: uploadError } = await admin.storage.from("site-assets").upload(storagePath, bytes, {
        contentType: mime,
        cacheControl: "3600",
        upsert: true,
      });
      if (uploadError) return json({ error: "Falha ao enviar a imagem." }, 400);

      const { data: publicData } = admin.storage.from("site-assets").getPublicUrl(storagePath);
      const next = { ...current, [config.field]: `${publicData.publicUrl}?v=${Date.now()}` };
      const { error } = await admin.from("app_settings").upsert({ key: "site_branding", value: next }, { onConflict: "key" });
      if (error) return json({ error: "Falha ao salvar a identidade visual." }, 400);

      await admin.from("admin_audit_log").insert({
        actor_id: user.id,
        action: "site.branding_upload",
        target_table: "app_settings",
        target_id: "site_branding",
        metadata: { slot, field: config.field },
      }).catch(() => {});

      return json({ branding: next });
    }

    if (body.action === "save") {
      const values = body.values || {};
      const discordInviteUrl = values.discordInviteUrl === undefined
        ? safeDiscordInvite(current.discordInviteUrl)
        : safeDiscordInvite(values.discordInviteUrl);
      if (!discordInviteUrl) {
        return json({ error: "Configure um convite válido do Discord (discord.gg/...). Ele é obrigatório para liberar anúncios." }, 400);
      }

      let discordGuildId = String(current.discordGuildId || "");
      let discordGuildName = String(current.discordGuildName || "");
      if (!discordGuildId || discordInviteUrl !== safeDiscordInvite(current.discordInviteUrl)) {
        const guild = await resolveDiscordGuild(discordInviteUrl);
        if (!guild?.id) {
          return json({ error: "Não consegui validar esse convite no Discord. Gere um convite ativo e tente novamente." }, 400);
        }
        discordGuildId = guild.id;
        discordGuildName = guild.name;
      }

      const next = {
        siteName: safeText(values.siteName ?? current.siteName, 40) || DEFAULTS.siteName,
        logoUrl: values.logoUrl === undefined ? current.logoUrl : safeUrl(values.logoUrl),
        faviconUrl: values.faviconUrl === undefined ? current.faviconUrl : safeUrl(values.faviconUrl),
        appIconUrl: values.appIconUrl === undefined ? current.appIconUrl : safeUrl(values.appIconUrl),
        heroTitle: safeText(values.heroTitle ?? current.heroTitle, 100) || DEFAULTS.heroTitle,
        heroSubtitle: safeText(values.heroSubtitle ?? current.heroSubtitle, 220) || DEFAULTS.heroSubtitle,
        heroBannerUrl: values.heroBannerUrl === undefined ? current.heroBannerUrl : safeUrl(values.heroBannerUrl),
        socialPreviewUrl: values.socialPreviewUrl === undefined ? current.socialPreviewUrl : safeUrl(values.socialPreviewUrl),
        robuxBannerUrl: values.robuxBannerUrl === undefined ? current.robuxBannerUrl : safeUrl(values.robuxBannerUrl),
        promoBanner1Url: values.promoBanner1Url === undefined ? current.promoBanner1Url : safeUrl(values.promoBanner1Url),
        promoBanner2Url: values.promoBanner2Url === undefined ? current.promoBanner2Url : safeUrl(values.promoBanner2Url),
        promoBanner3Url: values.promoBanner3Url === undefined ? current.promoBanner3Url : safeUrl(values.promoBanner3Url),
        accentColor: safeColor(values.accentColor ?? current.accentColor),
        supportUrl: values.supportUrl === undefined ? current.supportUrl : safeUrl(values.supportUrl),
        discordInviteUrl,
        discordGuildId,
        discordGuildName,
      };

      const { error } = await admin.from("app_settings").upsert({ key: "site_branding", value: next }, { onConflict: "key" });
      if (error) return json({ error: "Falha ao salvar a identidade visual." }, 400);

      await admin.from("admin_audit_log").insert({
        actor_id: user.id,
        action: "site.branding_updated",
        target_table: "app_settings",
        target_id: "site_branding",
        metadata: { fields: Object.keys(values).filter((k) => !k.toLowerCase().includes("secret")) },
      }).catch(() => {});

      return json({ branding: next });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("site-config", error instanceof Error ? error.message : error);
    return json({ error: "Erro inesperado." }, 500);
  }
});
