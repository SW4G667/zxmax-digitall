import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const allowed = new Set(["auth.login", "auth.recovery", "auth.discord", "admin.access"]);
const outcomes = new Set(["success", "failure", "blocked"]);

async function hashOrigin(req: Request) {
  const value = `${req.headers.get("x-forwarded-for") || "unknown"}|${req.headers.get("user-agent") || "unknown"}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const eventType = String(body.eventType || "");
    const outcome = String(body.outcome || "");
    if (!allowed.has(eventType) || !outcomes.has(outcome)) return json({ error: "Evento inválido" }, 400);
    const auth = req.headers.get("Authorization");
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData } = auth?.startsWith("Bearer ") ? await userClient.auth.getUser(auth.slice(7)) : { data: { user: null } };
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.rpc("record_security_event", {
      _actor_id: userData.user?.id || null,
      _event_type: eventType,
      _outcome: outcome,
      _context: { source_hash: await hashOrigin(req), route: "client" },
    });
    if (error) throw error;
    return json({ recorded: true });
  } catch (error: any) {
    console.error("security-event", error?.message || error);
    return json({ recorded: false }, 202);
  }
});
