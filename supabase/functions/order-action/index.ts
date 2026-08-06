import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BodySchema = z.object({ orderId: z.number().int().positive(), action: z.enum(["confirm_delivery", "open_dispute", "approve", "revert"]), reason: z.string().trim().min(10).max(1000).optional() });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: auth, error: authError } = await userClient.auth.getUser(authHeader.slice(7));
    if (authError || !auth.user) return json({ error: "Unauthorized" }, 401);
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Dados inválidos", fields: parsed.error.flatten().fieldErrors }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: order } = await admin.from("purchases").select("id,buyer_id,seller_id,status,messages").eq("id", parsed.data.orderId).maybeSingle();
    if (!order) return json({ error: "Pedido não encontrado" }, 404);
    const { data: adminRole } = await admin.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
    const isAdmin = adminRole === true;
    const now = new Date().toISOString();
    let nextStatus = order.status;
    let messages = Array.isArray(order.messages) ? order.messages : [];
    if (parsed.data.action === "confirm_delivery") {
      if (auth.user.id !== order.buyer_id || order.status !== "paid") return json({ error: "Transição não permitida" }, 403);
      nextStatus = "delivered";
    } else if (parsed.data.action === "open_dispute") {
      if (auth.user.id !== order.buyer_id || !["paid", "delivered"].includes(order.status) || !parsed.data.reason) return json({ error: "Disputa não permitida" }, 403);
      nextStatus = "dispute";
      messages = [...messages, { from: "System", text: `⚠️ DISPUTA ABERTA: ${parsed.data.reason}`, date: now }];
    } else {
      if (!isAdmin) return json({ error: "Apenas administradores" }, 403);
      if (parsed.data.action === "approve" && !["paid", "dispute"].includes(order.status)) return json({ error: "Transição não permitida" }, 409);
      if (parsed.data.action === "revert" && order.status !== "dispute") return json({ error: "Transição não permitida" }, 409);
      nextStatus = parsed.data.action === "approve" ? "delivered" : "paid";
    }
    const { error } = await admin.from("purchases").update({ status: nextStatus, messages, updated_at: now }).eq("id", order.id).eq("status", order.status);
    if (error) throw error;
    return json({ success: true, status: nextStatus });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Erro inesperado" }, 400); }
});