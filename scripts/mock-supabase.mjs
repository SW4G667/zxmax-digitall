#!/usr/bin/env node
/**
 * Mock do Supabase para PREVIEW LOCAL/ARENA — não é produção.
 * ============================================================
 *
 * Serve o mesmo contrato (REST PostgREST-like + GoTrue-like + Functions) que o
 * app consome, com dados falsos, para validar em mobile o fluxo de perguntas e
 * de checkout SEM tocar no banco remoto.
 *
 * Cenários (POST /__scenario com {"scenario":"legacy"} ou {"scenario":"current"}):
 *  - current: perguntas funcionam, `integrations-config` devolve methods v2;
 *  - legacy : simula o banco desatualizado de hoje (tabela/função ausentes,
 *             Edge Function antiga que responde 403 a payment_methods).
 *
 * Nenhum valor real de segredo existe aqui — tudo é fictício.
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 54321);

// ---------------------------------------------------------------- estado ----
let scenario = "current";

const now = () => new Date().toISOString();

const products = [
  {
    id: 41, name: "Tetse", price: "5.00", category: "Bots Discord",
    seller_id: "seller-0001", seller_name: "Vendedor", seller_public_id: "100001",
    description: "Anúncio de teste para validação mobile.", image: "https://picsum.photos/seed/zxmax41/800/450",
    banner: null, approved: true, delivery_type: "manual", variations: [], stock: 12,
    min_quantity: 1, delivery_time: "Até 2 horas", sales: 0, rating: 0, created_at: "2026-08-24T03:00:00Z",
  },
  {
    id: 40, name: "Tetse (outro vendedor)", price: "5.00", category: "Bots Discord",
    seller_id: "seller-0002", seller_name: "OutroVendedor", seller_public_id: "100002",
    description: "Segundo anúncio.", image: "https://picsum.photos/seed/zxmax40/800/450",
    banner: null, approved: true, delivery_type: "auto", variations: [], stock: 3,
    min_quantity: 1, delivery_time: "Imediata", sales: 1, rating: 0, created_at: "2026-08-23T03:00:00Z",
  },
];

let questions = [
  { id: 1, product_id: 41, author_id: "buyer-0001", body: "Entrega em quanto tempo?", answer: null, answered_at: null, created_at: "2026-08-24T08:00:00Z" },
];
let nextQuestionId = 2;

const purchases = [];
let nextPurchaseId = 1;

/** tokens -> user. Usuários fictícios criados on-the-fly no login. */
const tokens = new Map();
const users = new Map([
  ["seller-0001", { id: "seller-0001", email: "vendedor@zxmax.dev", user_metadata: { display_name: "Vendedor" }, aud: "authenticated", role: "authenticated", app_metadata: {}, created_at: "2026-01-01T00:00:00Z" }],
]);

const profiles = [
  { user_id: "seller-0001", public_id: 100001, email: "vendedor@zxmax.dev", display_name: "Vendedor", avatar_url: "", is_verified_seller: true, cpf: null, pix_key: null },
  { user_id: "seller-0002", public_id: 100002, email: "", display_name: "OutroVendedor", avatar_url: "", is_verified_seller: false, cpf: null, pix_key: null },
];

const CONTACT_RE = /(https?:\/\/|www\.|\.com\b|\.gg\/|@[^\s]+\.[a-z]{2,})|(^|[^0-9])[0-9][0-9 .()_-]{7,}[0-9]([^0-9]|$)|\b(whats(app)?|discord|telegram|instagram|email|e-mail)\b/i;

// ------------------------------------------------------------- utilidades ----
const json = (res, body, status = 200) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  });
  res.end(body === null ? "" : JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });

const bearerUser = (req) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return tokens.get(auth.slice(7)) || null;
};

/** filtro `?col=eq.value` simples */
function applyEq(rows, searchParams) {
  let out = rows;
  for (const [key, value] of searchParams.entries()) {
    const m = /^eq\.(.*)$/.exec(value);
    if (m && key !== "select" && key !== "order" && key !== "limit") {
      const want = m[1];
      out = out.filter((r) => String(r[key]) === want);
    }
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    });
    return res.end();
  }

  // -------------------------------------------------- troca de cenário ----
  if (path === "/__scenario" && method === "POST") {
    const body = await readBody(req);
    scenario = body.scenario === "legacy" ? "legacy" : "current";
    console.log(`[mock] cenário: ${scenario}`);
    return json(res, { scenario });
  }
  if (path === "/__scenario" && method === "GET") return json(res, { scenario });

  // ------------------------------------------------------------- auth ----
  if (path === "/auth/v1/token" && method === "POST") {
    const body = await readBody(req);
    const grant = url.searchParams.get("grant_type");
    if (grant === "refresh_token") {
      const user = bearerUser(req) || users.get("seller-0001");
      const token = `tok-${user.id}-${Date.now()}`;
      tokens.set(token, user);
      return json(res, { access_token: token, refresh_token: "r-" + token, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
    }
    const email = String(body.email || "").toLowerCase();
    if (!email) return json(res, { error: "invalid_credentials", error_description: "E-mail obrigatório" }, 400);
    let user = [...users.values()].find((u) => u.email === email);
    if (!user) {
      user = {
        id: `user-${String(users.size + 1).padStart(4, "0")}`,
        email, user_metadata: { display_name: body.email?.split("@")[0] || "Usuário" },
        aud: "authenticated", role: "authenticated", app_metadata: {}, created_at: now(),
      };
      users.set(user.id, user);
      profiles.push({ user_id: user.id, public_id: 100000 + users.size, email, display_name: user.user_metadata.display_name, avatar_url: "", is_verified_seller: false, cpf: null, pix_key: null });
    }
    const token = `tok-${user.id}-${Date.now()}`;
    tokens.set(token, user);
    return json(res, {
      access_token: token, refresh_token: "r-" + token, token_type: "bearer",
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user,
    });
  }
  if (path === "/auth/v1/signup" && method === "POST") {
    const body = await readBody(req);
    return json(res, { id: "signup-pending", email: body.email || "", user_metadata: body.options?.data || {} });
  }
  if (path === "/auth/v1/user" && method === "GET") {
    const user = bearerUser(req);
    if (!user) return json(res, { code: 401, msg: "Invalid token" }, 401);
    return json(res, user);
  }
  if (path === "/auth/v1/logout" && method === "POST") return json(res, null, 204);
  if (path.startsWith("/auth/v1/mfa/factors")) return json(res, { factors: [] });

  // ------------------------------------------------------------- rest ----
  const isObject = (req.headers.accept || "").includes("vnd.pgrst.object+json");
  const single = (rows) => json(res, rows.length ? rows[0] : null);

  if (path.startsWith("/rest/v1/rpc/")) {
    const fn = path.split("/").pop();
    const body = await readBody(req);
    const user = bearerUser(req);

    if (scenario === "legacy") {
      return json(res, {
        code: "PGRST202",
        message: `Could not find the function public.${fn}(${Object.keys(body).map((k) => k).join(", ")}) in the schema cache`,
        details: null, hint: null,
      }, 404);
    }

    if (fn === "ask_product_question") {
      if (!user) return json(res, { code: "42501", message: "Faça login para enviar uma pergunta.", details: null, hint: null }, 400);
      const body_ = String(body._body || "");
      if (CONTACT_RE.test(body_)) {
        return json(res, { code: "22023", message: "Não é permitido enviar contatos externos (WhatsApp, Discord, e-mail, links ou telefone).", details: null, hint: null }, 400);
      }
      if (!products.some((p) => p.id === Number(body._product_id) && p.approved)) {
        return json(res, { code: "P0002", message: "Este anúncio não está disponível para perguntas.", details: null, hint: null }, 400);
      }
      const row = { id: nextQuestionId++, product_id: Number(body._product_id), author_id: user.id, body: body_.trim(), answer: null, answered_at: null, created_at: now() };
      questions.push(row);
      return json(res, row);
    }
    if (fn === "answer_product_question") {
      if (!user) return json(res, { code: "42501", message: "Faça login para responder.", details: null, hint: null }, 400);
      const q = questions.find((row) => row.id === Number(body._question_id));
      const product = q && products.find((p) => p.id === q.product_id);
      if (!q || !product || product.seller_id !== user.id) {
        return json(res, { code: "42501", message: "Você não tem permissão para responder esta pergunta.", details: null, hint: null }, 400);
      }
      if (CONTACT_RE.test(String(body._answer || ""))) {
        return json(res, { code: "22023", message: "Não é permitido enviar contatos externos (WhatsApp, Discord, e-mail, links ou telefone).", details: null, hint: null }, 400);
      }
      q.answer = String(body._answer).trim();
      q.answered_at = now();
      return json(res, q);
    }
    if (fn === "has_role") return json(res, false);
    return json(res, { code: "PGRST202", message: `function public.${fn} does not exist`, details: null, hint: null }, 404);
  }

  const table = path.replace("/rest/v1/", "");

  if (table === "product_questions") {
    if (scenario === "legacy") {
      return json(res, { code: "PGRST205", message: "Could not find the table 'product_questions' in the schema cache", details: null, hint: null }, 404);
    }
    if (method === "GET") {
      const rows = applyEq(questions.filter((q) => q.product_id === 41), url.searchParams);
      return isObject ? single(rows) : json(res, rows);
    }
  }

  if (table === "products_public" && method === "GET") return isObject ? single(products) : json(res, products);
  if (table === "products" && method === "GET") {
    const user = bearerUser(req);
    const rows = user ? products : products.filter((p) => p.approved);
    return isObject ? single(rows) : json(res, applyEq(rows, url.searchParams));
  }
  if ((table === "profiles" || table === "profiles_public") && method === "GET") {
    return isObject ? single(profiles) : json(res, applyEq(profiles, url.searchParams));
  }
  if (table === "user_roles") return json(res, []);
  if (table === "bans") return json(res, []);
  if (table === "seller_documents") return json(res, []);
  if (table === "app_settings" && method === "GET") {
    const rows = [
      { key: "evopay", value: { apiKey: "evp_mock", mode: "panel", webhookToken: "mocktoken" } },
      { key: "fees", value: { commission: 10, minWithdraw: 5, withdrawFee: 1.2 } },
    ];
    return isObject ? single(applyEq(rows, url.searchParams)) : json(res, applyEq(rows, url.searchParams));
  }
  if (table === "purchases" && method === "GET") {
    const user = bearerUser(req);
    return isObject ? single(purchases) : json(res, purchases.filter((p) => !user || p.buyer_id === user.id));
  }
  if (table === "product_delivery") return json(res, []);
  if (table === "webhook_logs" && method === "POST") { await readBody(req); return json(res, null, 201); }

  // ------------------------------------------------------- functions ----
  if (path.startsWith("/functions/v1/")) {
    const fn = path.split("/").pop();
    const body = await readBody(req);
    const user = bearerUser(req);

    if (fn === "integrations-config") {
      if (!user) return json(res, { error: "Unauthorized" }, 401);
      if (body.action === "payment_methods") {
        if (scenario === "legacy") return json(res, { error: "Apenas administradores." }, 403); // função antiga publicada
        // VexoPay mock configurada => PIX (primária) e Crypto ativos.
        return json(res, { v: 2, methods: { pix: true, crypto: true, card: false, boleto: false } });
      }
      return json(res, { error: "Apenas administradores." }, 403);
    }
    if (fn === "public-products") return json(res, { products });
    if (fn === "create-purchase") {
      if (!user) return json(res, { error: "Unauthorized" }, 401);
      const product = products.find((p) => p.id === Number(body.productId));
      const row = {
        id: nextPurchaseId++, product_id: product.id, buyer_id: user.id, buyer_email: user.email,
        buyer_public_id: 200001, seller_id: product.seller_id, seller_email: "vendedor@zxmax.dev",
        seller_public_id: product.seller_public_id, status: "pending", amount: String(product.price),
        messages: [], reviewed: false, review_stars: null, review_comment: null, variation_name: body.variationName || null,
        created_at: now(), updated_at: now(), evopay_charge_id: null, pix_qr_code: null, pix_expires_at: null,
      };
      purchases.push(row);
      return json(res, { purchase: row });
    }
    if (fn === "create-evopay-pix") {
      if (!user) return json(res, { error: "Unauthorized" }, 401);
      // VexoPay é o gateway primário do PIX: ids ganham o prefixo `vexo:`.
      const id = `vexo:mock-${Date.now()}`;
      return json(res, { id, status: "PENDING", amount: body.amount, qrCodeText: `00020126580014BR.GOV.BCB.PIX0136${id}520400005303986540${Number(body.amount).toFixed(2)}5802BR5907ZXMAX6009SAO PAULO62070503***6304ABCD`, expiresAt: new Date(Date.now() + 3600e3).toISOString(), qrCodeUrl: null });
    }
    if (fn === "check-evopay-status") return json(res, { status: "PENDING" });
    if (fn === "send-email") return json(res, { ok: true });
    return json(res, { error: `Function ${fn} não mockada` }, 404);
  }

  // GET padrão de tabela desconhecida: lista vazia (mantém o app estável)
  if (method === "GET") return isObject ? single([]) : json(res, []);
  return json(res, { error: "not found" }, 404);
});

server.listen(PORT, "0.0.0.0", () => console.log(`[mock] Supabase fake em http://0.0.0.0:${PORT} (cenário: ${scenario})`));
