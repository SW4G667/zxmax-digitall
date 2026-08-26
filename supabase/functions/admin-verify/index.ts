import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await anonClient.auth.getUser(token);
    if (!userData.user) throw new Error("Unauthorized");

    // Check admin role
    const { data: roleData } = await serviceClient.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleData) throw new Error("Acesso negado: só admin");

    const body = await req.json();
    const action = body.action;
    const userId = body.userId;
    const documentId = body.documentId;

    if (action === "verify_user") {
      if (!userId) throw new Error("userId obrigatório");
      const { error } = await serviceClient.from("profiles").update({
        is_verified_seller: true,
        verification_status: "approved",
        verification_notes: null,
      } as any).eq("user_id", userId);
      if (error) throw error;

      if (documentId) {
        await serviceClient.from("seller_documents").update({
          status: "approved",
          reviewed_by: userData.user.id,
          reviewed_at: new Date().toISOString(),
        }).eq("id", documentId);
      }

      await serviceClient.from("webhook_logs").insert({
        source: "admin",
        event_type: "VERIFY_USER",
        status: "approved",
        order_id: null,
        payload: { userId, documentId },
      });

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reject_user") {
      if (!userId) throw new Error("userId obrigatório");
      const notes = body.notes || "Documentos ilegíveis";
      const { error } = await serviceClient.from("profiles").update({
        is_verified_seller: false,
        verification_status: "rejected",
        verification_notes: notes,
      } as any).eq("user_id", userId);
      if (error) throw error;

      if (documentId) {
        await serviceClient.from("seller_documents").update({
          status: "rejected",
          reviewed_by: userData.user.id,
          reviewed_at: new Date().toISOString(),
        }).eq("id", documentId);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get_documents") {
      const { data, error } = await serviceClient.from("seller_documents").select("id, user_id, file_path, file_name, status, created_at").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      
      // Enrich with profile data
      const userIds = [...new Set((data || []).map((d: any) => d.user_id))];
      const { data: profiles } = await serviceClient.from("profiles").select("user_id, public_id, email, display_name").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      
      const enriched = (data || []).map((d: any) => ({
        ...d,
        userEmail: profileMap.get(d.user_id)?.email || "",
        userPublicId: profileMap.get(d.user_id)?.public_id || "",
        userName: profileMap.get(d.user_id)?.display_name || "Usuário",
      }));

      return new Response(JSON.stringify({ documents: enriched }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get_webhook_logs") {
      const { data, error } = await serviceClient
        .from("webhook_logs")
        .select("id, source, event_type, status, order_id, created_at, error")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const logs = (data || []).map((log: any) => ({
        id: log.id,
        source: log.source,
        event_type: log.event_type,
        status: log.status,
        order_id: log.order_id,
        created_at: log.created_at,
        has_error: Boolean(log.error),
      }));
      return new Response(JSON.stringify({ logs }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get_verifications") {
      const { data, error } = await serviceClient
        .from("profiles")
        .select("user_id, public_id, email, display_name, full_name, cpf, birth_date, phone, city, state, verification_selfie_path, verification_status, verification_notes, verification_submitted_at, is_verified_seller")
        .not("verification_status", "is", null)
        .neq("verification_status", "none")
        .order("verification_submitted_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return new Response(JSON.stringify({ verifications: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get_document_url") {
      const filePath = body.filePath;
      if (!filePath) throw new Error("filePath obrigatório");
      const { data, error } = await serviceClient.storage.from("documents").createSignedUrl(filePath, 60 * 10);
      if (error) throw error;
      return new Response(JSON.stringify({ url: data.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "approve_all_products") {
      const { error } = await serviceClient.from("products").update({ approved: true }).eq("approved", false);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Ação inválida");

  } catch (error: any) {
    console.error("admin-verify error", error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
