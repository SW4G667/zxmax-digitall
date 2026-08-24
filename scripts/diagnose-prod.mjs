/**
 * Diagnóstico read-only do ambiente de PRODUÇÃO ZXMAX.
 *
 * Usa apenas dados públicos: o HTML/JS servido em https://zxmax.vercel.app e a
 * publishable (anon) key que já roda no navegador de qualquer visitante.
 * Nada de service role, nada de secrets. Nenhum valor sensível é impresso.
 */
const PROD = "https://zxmax.vercel.app";

const out = {};
const log = (k, v) => { out[k] = v; console.log(`${k}: ${v}`); };

function redact(url) {
  // mostra só o host do projeto (ref), que não é secreto
  try { return new URL(url).host; } catch { return "(inválida)"; }
}

// 1) Baixa o HTML e acha o bundle principal
const html = await (await fetch(PROD)).text();
const scripts = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
log("html.bundles", scripts.join(",") || "nenhum");

let supabaseUrl = null;
let anonKey = null;

for (const s of scripts) {
  const js = await (await fetch(PROD + s)).text();
  const urlMatch = js.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
  // publishable/anon key: JWT-like string ao lado do host, no createClient
  const keyMatch = js.match(/[\"']([A-Za-z0-9_-]{100,})[\"']/);
  if (urlMatch && !supabaseUrl) supabaseUrl = urlMatch[0];
  if (keyMatch && !anonKey) anonKey = keyMatch[1];
}
log("bundle.supabaseHost", supabaseUrl ? redact(supabaseUrl) : "não encontrado");
log("bundle.anonKeyPresente", anonKey ? "sim (não exibida)" : "não");
if (!supabaseUrl || !anonKey) process.exit(0);

const rest = supabaseUrl + "/rest/v1";
const fn = supabaseUrl + "/functions/v1";
const h = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" };

// 2) A RPC ask_product_question existe no schema cache?
try {
  const r = await fetch(`${rest}/rpc/ask_product_question`, { method: "POST", headers: h, body: "{}" });
  const b = await r.json();
  const msg = typeof b.message === "string" ? b.message.slice(0, 140) : JSON.stringify(b).slice(0, 140);
  log("rpc.ask_product_question", `HTTP ${r.status} :: ${msg}`);
  log("rpc.ask_product_question.existe", !(b.code === "PGRST202"));
} catch (e) { log("rpc.ask_product_question", `falha: ${e.message}`); }

// 3) A tabela product_questions existe?
try {
  const r = await fetch(`${rest}/product_questions?select=id&limit=1`, { headers: h });
  const b = await r.json();
  const msg = b.message ? String(b.message).slice(0, 140) : Array.isArray(b) ? `ok, ${b.length} linha(s) visível(is) para anon` : JSON.stringify(b).slice(0, 140);
  log("tabela.product_questions", `HTTP ${r.status} :: ${msg}`);
  log("tabela.product_questions.existe", !(b.code === "PGRST205" || b.code === "PGRST202"));
} catch (e) { log("tabela.product_questions", `falha: ${e.message}`); }

// 4) products_public existe (migrations de agosto aplicadas)?
try {
  const r = await fetch(`${rest}/products_public?select=id&limit=1`, { headers: h });
  const b = await r.json();
  const code = b.code || "ok";
  log("view.products_public", `HTTP ${r.status} :: ${code}${b.message ? " :: " + String(b.message).slice(0, 100) : ""}`);
} catch (e) { log("view.products_public", `falha: ${e.message}`); }

// 5) Edge Function integrations-config publicada? (401 = publicada e exigindo auth)
try {
  const r = await fetch(`${fn}/integrations-config`, { method: "POST", headers: h, body: JSON.stringify({ action: "payment_methods" }) });
  const b = await r.json().catch(() => ({}));
  log("edge.integrations-config", `HTTP ${r.status} :: ${String(b.error || b.message || "").slice(0, 120)}`);
} catch (e) { log("edge.integrations-config", `falha: ${e.message}`); }

// 6) Outras funções críticas publicadas?
for (const name of ["public-products", "create-evopay-pix"]) {
  try {
    const r = await fetch(`${fn}/${name}`, { method: "POST", headers: h, body: "{}" });
    log(`edge.${name}`, `HTTP ${r.status}`);
  } catch (e) { log(`edge.${name}`, `falha: ${e.message}`); }
}
