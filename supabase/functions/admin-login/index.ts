import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Admin 2FA is authenticator-code only (TOTP challenge/verify no client).
// O fluxo antigo por e-mail/link (/confirmar-login) e WebAuthn foi removido:
// era código morto. Esta função fica apenas com o reset de emergência abaixo.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    let userId: string | null = null;
    if (bearer) {
      const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data } = await anon.auth.getUser(bearer);
      userId = data.user?.id || null;
    }

    const requireAdmin = async () => {
      if (!userId) throw new Error("Unauthorized");
      const { data: role } = await service
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) throw new Error("Acesso negado: só admin");
      return userId!;
    };

    // Removes every MFA/TOTP factor of the calling admin using the service role.
    // O caminho normal é confirmar o código atual do app (isso eleva a sessão
    // para AAL2 e o unenroll funciona no client). Este endpoint é o último
    // recurso para quando o admin PERDEU o aplicativo autenticador: sem o
    // código não há como elevar a sessão, e o Supabase bloqueia remover um
    // fator verificado em sessão AAL1.
    if (action === "reset_mfa") {
      const adminId = await requireAdmin();

      const { data: userRes, error: getErr } = await service.auth.admin.getUserById(adminId);
      if (getErr) throw getErr;

      const factors = (userRes?.user as any)?.factors || [];
      let removed = 0;
      const failures: string[] = [];

      for (const f of factors) {
        const { error: delErr } = await (service.auth.admin as any).mfa.deleteFactor({
          id: f.id,
          userId: adminId,
        });
        if (delErr) failures.push(delErr.message || String(delErr));
        else removed++;
      }

      if (failures.length && removed === 0) {
        return json({ error: `Não foi possível remover o autenticador: ${failures[0]}` }, 400);
      }

      try {
        await service.from("webhook_logs").insert({
          source: "admin",
          event_type: "RESET_MFA",
          status: "ok",
          order_id: null,
          payload: { userId: adminId, removed },
        });
      } catch (_e) {
        // logging is best-effort
      }

      return json({ ok: true, removed });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error: any) {
    console.error("admin-login error", error.message || error);
    return json({ error: error.message || "Erro" }, 400);
  }
});
