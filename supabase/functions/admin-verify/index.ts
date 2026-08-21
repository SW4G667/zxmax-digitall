import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await anonClient.auth.getUser(token);
    if (!userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) return json({ error: "Acesso negado: só admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const userId = body.userId;
    const documentId = body.documentId;

    if (action === "verify_user") {
      if (!userId) return json({ error: "userId obrigatório" }, 400);
      const { error } = await serviceClient
        .from("profiles")
        .update({
          is_verified_seller: true,
          verification_status: "approved",
          verification_notes: "",
        } as any)
        .eq("user_id", userId);
      if (error) throw error;

      if (documentId) {
        await serviceClient
          .from("seller_documents")
          .update({
            status: "approved",
            reviewed_by: userData.user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", documentId);
      } else {
        await serviceClient
          .from("seller_documents")
          .update({
            status: "approved",
            reviewed_by: userData.user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("status", "pending");
      }

      await serviceClient.from("webhook_logs").insert({
        source: "admin",
        event_type: "VERIFY_USER",
        status: "approved",
        order_id: null,
        payload: { userId, documentId },
      });

      return json({ success: true });
    }

    if (action === "reject_user") {
      if (!userId) return json({ error: "userId obrigatório" }, 400);
      const notes = (body.notes || "Documentos ilegíveis").toString().slice(0, 500);
      const { error } = await serviceClient
        .from("profiles")
        .update({
          is_verified_seller: false,
          verification_status: "rejected",
          verification_notes: notes,
        } as any)
        .eq("user_id", userId);
      if (error) throw error;

      if (documentId) {
        await serviceClient
          .from("seller_documents")
          .update({
            status: "rejected",
            reviewed_by: userData.user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", documentId);
      } else {
        await serviceClient
          .from("seller_documents")
          .update({
            status: "rejected",
            reviewed_by: userData.user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("status", "pending");
      }

      return json({ success: true });
    }

    if (action === "get_kyc") {
      const { data, error } = await serviceClient
        .from("profiles")
        .select(
          "user_id, public_id, email, display_name, full_name, cpf, birth_date, phone, city, state, verification_selfie_path, verification_status, verification_notes, verification_submitted_at, is_verified_seller",
        )
        .not("verification_status", "in", "(none,)")
        .order("verification_submitted_at", { ascending: false });
      if (error) throw error;
      return json({ kyc: data || [] });
    }

    if (action === "get_documents") {
      const { data, error } = await serviceClient
        .from("seller_documents")
        .select("id, user_id, file_path, file_name, status, created_at, document_type")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const userIds = [...new Set((data || []).map((d: any) => d.user_id))];
      const { data: profiles } = userIds.length
        ? await serviceClient.from("profiles").select("user_id, public_id, email, display_name").in("user_id", userIds)
        : { data: [] as any[] };
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      const enriched = (data || []).map((d: any) => ({
        ...d,
        userEmail: profileMap.get(d.user_id)?.email || "",
        userPublicId: profileMap.get(d.user_id)?.public_id || "",
        userName: profileMap.get(d.user_id)?.display_name || "Usuário",
      }));

      return json({ documents: enriched });
    }

    if (action === "get_document_url") {
      const filePath = body.filePath;
      if (!filePath) return json({ error: "filePath obrigatório" }, 400);
      const { data, error } = await serviceClient.storage.from("documents").createSignedUrl(filePath, 60 * 10);
      if (error) throw error;
      return json({ url: data.signedUrl });
    }

    if (action === "approve_product") {
      const productId = Number(body.productId);
      if (!productId) return json({ error: "productId obrigatório" }, 400);
      const { error } = await serviceClient.from("products").update({ approved: true }).eq("id", productId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "reject_product") {
      const productId = Number(body.productId);
      if (!productId) return json({ error: "productId obrigatório" }, 400);
      const { error } = await serviceClient.from("products").delete().eq("id", productId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "approve_all_products") {
      const { error } = await serviceClient.from("products").update({ approved: true }).eq("approved", false);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "pause_product") {
      const productId = Number(body.productId);
      if (!productId) return json({ error: "productId obrigatório" }, 400);
      const { error } = await serviceClient.from("products").update({ approved: false }).eq("id", productId);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error: any) {
    console.error("admin-verify error", error.message);
    return json({ error: error.message || "Erro interno" }, 400);
  }
});
