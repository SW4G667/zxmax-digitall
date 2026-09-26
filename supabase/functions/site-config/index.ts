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
  heroTitle: "Compre e venda produtos digitais com segurança",
  heroSubtitle: "Marketplace para produtos, serviços e itens digitais.",
  supportUrl: "https://discord.gg/zxmax",
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

  if (req.method === "GET") return json({ branding: current });

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "get") return json({ branding: current });
    const user = await requireAdmin(req, admin);
    if (!user) return json({ error: "Apenas administradores." }, 403);

    if (body.action === "upload") {
      const slot = body.slot === "favicon" ? "favicon" : "logo";
      const dataUrl = String(body.dataUrl || "");
      const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|x-icon));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return json({ error: "Use PNG, JPG, WEBP ou ICO." }, 400);
      const mime = match[1];
      const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      if (bytes.byteLength > 2 * 1024 * 1024) return json({ error: "A imagem deve ter no máximo 2 MB." }, 413);
      const ext = mime === "image/jpeg" ? "jpg" : mime === "image/x-icon" ? "ico" : mime.split("/")[1];
      const path = `branding/${slot}.${ext}`;
      const { error: uploadError } = await admin.storage.from("site-assets").upload(path, bytes, {
        contentType: mime,
        cacheControl: "3600",
        upsert: true,
      });
      if (uploadError) return json({ error: "Falha ao enviar a imagem." }, 400);
      const { data: publicData } = admin.storage.from("site-assets").getPublicUrl(path);
      const field = slot === "favicon" ? "faviconUrl" : "logoUrl";
      const next = { ...current, [field]: `${publicData.publicUrl}?v=${Date.now()}` };
      const { error } = await admin.from("app_settings").upsert({ key: "site_branding", value: next }, { onConflict: "key" });
      if (error) return json({ error: "Falha ao salvar a identidade visual." }, 400);
      await admin.from("admin_audit_log").insert({
        actor_id: user.id, action: "site.branding_upload", target_table: "app_settings",
        target_id: "site_branding", metadata: { slot },
      }).catch(() => {});
      return json({ branding: next });
    }

    if (body.action === "save") {
      const values = body.values || {};
      const next = {
        siteName: safeText(values.siteName ?? current.siteName, 40) || DEFAULTS.siteName,
        logoUrl: values.logoUrl === undefined ? current.logoUrl : safeUrl(values.logoUrl),
        faviconUrl: values.faviconUrl === undefined ? current.faviconUrl : safeUrl(values.faviconUrl),
        heroTitle: safeText(values.heroTitle ?? current.heroTitle, 100) || DEFAULTS.heroTitle,
        heroSubtitle: safeText(values.heroSubtitle ?? current.heroSubtitle, 180) || DEFAULTS.heroSubtitle,
        supportUrl: values.supportUrl === undefined ? current.supportUrl : safeUrl(values.supportUrl),
      };
      const { error } = await admin.from("app_settings").upsert({ key: "site_branding", value: next }, { onConflict: "key" });
      if (error) return json({ error: "Falha ao salvar a identidade visual." }, 400);
      await admin.from("admin_audit_log").insert({
        actor_id: user.id, action: "site.branding_updated", target_table: "app_settings",
        target_id: "site_branding", metadata: { fields: Object.keys(values).filter((k) => !k.toLowerCase().includes("secret")) },
      }).catch(() => {});
      return json({ branding: next });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("site-config", error instanceof Error ? error.message : error);
    return json({ error: "Erro inesperado." }, 500);
  }
});
