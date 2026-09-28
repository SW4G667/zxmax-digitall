import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: authData, error: authError } = await userClient.auth.getUser(auth.slice(7));
    if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);

    const { data: allowed, error: capError } = await userClient.rpc("has_capability", {
      _user_id: authData.user.id,
      _capability: "manage_tags",
    });
    if (capError || allowed !== true) return json({ error: "Sem permissão para gerenciar tags." }, 403);

    const body = await req.json().catch(() => ({}));
    const dataUrl = String(body.dataUrl || "");
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) return json({ error: "Envie uma imagem PNG, JPG ou WebP." }, 400);

    const mime = match[1];
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 1024 * 1024) return json({ error: "O ícone pode ter no máximo 1 MB." }, 413);

    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const safeId = crypto.randomUUID();
    const path = `tags/${authData.user.id}/${safeId}.${ext}`;
    const admin = createClient(url, service);

    const { error: uploadError } = await admin.storage.from("site-assets").upload(path, bytes, {
      contentType: mime,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: pub } = admin.storage.from("site-assets").getPublicUrl(path);
    if (!pub?.publicUrl) return json({ error: "Não foi possível obter a URL pública do ícone." }, 500);

    return json({ url: pub.publicUrl });
  } catch (error) {
    console.error("tag-icon-upload", error instanceof Error ? error.message : error);
    return json({ error: "Não foi possível enviar o ícone da tag." }, 500);
  }
});
