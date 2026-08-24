#!/usr/bin/env node
/**
 * ZXMAX · Scanner técnico do repositório (Fase 3).
 *
 * Analisa SOMENTE este repositório: código, dependências e SQL. Não faz
 * requisição para nenhum site externo e não ataca nenhum endpoint.
 *
 *   node scripts/audit.mjs            # análise estática + npm audit
 *   node scripts/audit.mjs --full     # + tsc, build, lint e testes
 *   node scripts/audit.mjs --json     # saída legível por máquina
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const FULL = process.argv.includes("--full");
const AS_JSON = process.argv.includes("--json");

const SEVERITIES = ["CRITICO", "ALTO", "MEDIO", "BAIXO", "MELHORIA"];
const findings = [];
const add = (severity, area, title, impact, fix, test) =>
  findings.push({ severity, area, title, impact, fix, test });

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage", "build", ".vercel"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const read = (f) => { try { return readFileSync(f, "utf8"); } catch { return ""; } };
const rel = (f) => relative(ROOT, f);
const srcFiles = files.filter((f) => rel(f).startsWith("src/") && [".ts", ".tsx"].includes(extname(f)));
const sqlFiles = files.filter((f) => rel(f).startsWith("supabase/migrations") && f.endsWith(".sql"));
const edgeFiles = files.filter((f) => rel(f).startsWith("supabase/functions") && f.endsWith(".ts"));

// ---------------------------------------------------------------------------
// 1. Segredos e dados sensíveis no frontend
// ---------------------------------------------------------------------------
const SECRET_PATTERNS = [
  [/SUPABASE_SERVICE_ROLE_KEY/, "service role key"],
  [/\bsbp_[A-Za-z0-9]{20,}/, "Supabase personal access token"],
  [/\bsk_live_[A-Za-z0-9]{10,}/, "Stripe secret key"],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, "JWT embutido"],
  [/CLIENT_SECRET\s*[:=]\s*["'][^"']{8,}/i, "client secret embutido"],
];
for (const file of srcFiles) {
  const text = read(file);
  for (const [pattern, label] of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      add("CRITICO", rel(file), `Possível ${label} no bundle do navegador`,
        "Qualquer visitante consegue ler o segredo no JavaScript publicado e usar a API com privilégios totais.",
        "Mover o segredo para uma Edge Function/variável de servidor e rotacionar a credencial exposta.",
        "grep no bundle de produção não deve retornar o segredo");
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Variáveis de ambiente usadas sem validação
// ---------------------------------------------------------------------------
const envUsage = srcFiles.filter((f) => /import\.meta\.env\.VITE_/.test(read(f)));
const clientFile = join(ROOT, "src/integrations/supabase/client.ts");
const clientText = read(clientFile);
if (envUsage.length && !/if\s*\(!?\s*SUPABASE_URL|throw new Error|z\.string\(\)/.test(clientText)) {
  add("ALTO", "src/integrations/supabase/client.ts", "VITE_SUPABASE_URL/KEY usados sem validação",
    "Se a variável faltar na Vercel, o cliente é criado com `undefined` e todas as chamadas falham com erro genérico — exatamente o sintoma de 'loja vazia'.",
    "Validar as variáveis no boot e falhar com mensagem clara em vez de criar um cliente inválido.",
    "build com a variável ausente deve falhar de forma explícita");
}

// ---------------------------------------------------------------------------
// 3. Chamadas a localhost no código do navegador
// ---------------------------------------------------------------------------
for (const file of srcFiles) {
  const text = read(file);
  if (/https?:\/\/(localhost|127\.0\.0\.1)/.test(text)) {
    add("ALTO", rel(file), "URL localhost no código do navegador",
      "Em produção o navegador do usuário não alcança o localhost do servidor: a chamada falha silenciosamente.",
      "Usar caminho relativo ou a URL pública configurada por variável de ambiente.",
      "abrir a página em produção e confirmar que a chamada resolve");
  }
}

// ---------------------------------------------------------------------------
// 4. XSS
// ---------------------------------------------------------------------------
// `src/components/ui/` is vendored shadcn code; its innerHTML usage is a
// generated <style> block, not user content. Audited once, excluded here.
for (const file of srcFiles.filter((f) => !rel(f).startsWith("src/components/ui/"))) {
  const text = read(file);
  if (/dangerouslySetInnerHTML/.test(text)) {
    add("CRITICO", rel(file), "dangerouslySetInnerHTML em conteúdo potencialmente de usuário",
      "Descrição de produto, chat, pergunta ou avaliação com HTML permite roubo de sessão.",
      "Renderizar como texto ou sanitizar com uma allowlist antes de injetar.",
      "criar produto com <img src=x onerror=alert(1)> e confirmar que não executa");
  }
  if (/innerHTML\s*=/.test(text)) {
    add("ALTO", rel(file), "Atribuição direta a innerHTML",
      "Mesma superfície de XSS do item anterior.",
      "Trocar por textContent ou por renderização React.",
      "teste de regressão com payload de script");
  }
}

// ---------------------------------------------------------------------------
// 5. Erros silenciosos
// ---------------------------------------------------------------------------
for (const file of srcFiles) {
  const text = read(file);
  const silent = text.match(/catch\s*(\([^)]*\))?\s*\{\s*\}/g) || [];
  if (silent.length > 3) {
    add("MEDIO", rel(file), `${silent.length} blocos catch vazios`,
      "Falhas reais do Supabase somem sem log, o que transforma um erro de permissão em 'tela vazia'.",
      "Registrar o erro com logProductError (ou equivalente) mesmo quando a UI seguir adiante.",
      "forçar erro de rede e conferir o console");
  }
}

// ---------------------------------------------------------------------------
// 6. Autorização só no frontend
// ---------------------------------------------------------------------------
for (const file of srcFiles) {
  const text = read(file);
  if (/isAdmin/.test(text) && /\.from\(["'](app_settings|user_roles|bans|withdrawals)["']\)/.test(text)) {
    add("MEDIO", rel(file), "Acesso administrativo condicionado por estado do React",
      "Se a RLS não repetir a mesma regra, basta alterar o estado no navegador para ler dados administrativos.",
      "Garantir que a policy no banco use has_role(auth.uid(),'admin') para as mesmas tabelas.",
      "chamar a tabela com uma conta comum e esperar 401/403");
  }
}

// ---------------------------------------------------------------------------
// 7. SQL: RLS, grants e views
// ---------------------------------------------------------------------------
const allSql = sqlFiles.map((f) => ({ file: rel(f), text: read(f) }));
const sqlText = allSql.map((s) => s.text).join("\n");

for (const { file, text } of allSql) {
  if (/GRANT\s+ALL\s+ON\s+[\w.]+\s+TO\s+[^;]*\b(anon|authenticated|public)\b/i.test(text)) {
    add("CRITICO", file, "GRANT ALL para anon/authenticated",
      "Concede INSERT/UPDATE/DELETE amplo a qualquer visitante ou usuário logado.",
      "Trocar por grants por coluna e por operação, mantendo GRANT ALL apenas para service_role.",
      "information_schema.role_table_grants não deve listar DELETE para anon");
  }
  const createdTables = [...text.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?public\.(\w+)/gi)].map((m) => m[1]);
  for (const table of createdTables) {
    const enabled = new RegExp(`ALTER TABLE (public\\.)?${table}[\\s\\S]*?ENABLE ROW LEVEL SECURITY`, "i").test(sqlText);
    if (!enabled) {
      add("CRITICO", file, `Tabela public.${table} criada sem ENABLE ROW LEVEL SECURITY`,
        "Sem RLS, qualquer chave anônima lê e escreve a tabela inteira.",
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY; e criar policies explícitas.`,
        "pg_class.relrowsecurity deve ser true");
    }
  }
  for (const view of [...text.matchAll(/CREATE (?:OR REPLACE )?VIEW public\.(\w+)/gi)]) {
    const name = view[1];
    const rest = text.slice(view.index);
    const block = rest.slice(0, rest.indexOf(";") + 1 || 1200);
    if (!/security_invoker/i.test(block)) {
      add("ALTO", file, `View public.${name} sem security_invoker`,
        "A view roda com os privilégios do dono e ignora a RLS da tabela base, podendo expor linhas privadas.",
        "Recriar com WITH (security_invoker = true).",
        "consultar a view como anon e conferir que só retorna linhas permitidas");
    }
    if (/seller_email|\bemail\b|\bcpf\b|\bphone\b|delivery_content/i.test(block) && /GRANT SELECT[^;]*anon/i.test(text)) {
      add("ALTO", file, `View pública public.${name} pode expor dado pessoal`,
        "E-mail, CPF, telefone ou conteúdo de entrega ficam legíveis por visitantes anônimos.",
        "Remover a coluna sensível da view pública.",
        "SELECT anônimo na view não deve trazer a coluna");
    }
  }
}

// Preço mínimo divergente entre trigger, constraint e UI.
const triggerMin = [...sqlText.matchAll(/NEW\.price\s*<\s*(\d+)/g)].map((m) => Number(m[1]));
const catalogText = read(join(ROOT, "src/lib/catalog.ts"));
const uiMin = Number((catalogText.match(/MIN_PRODUCT_PRICE\s*=\s*(\d+)/) || [])[1] ?? NaN);
const latestTriggerMin = triggerMin.at(-1);
if (Number.isFinite(uiMin) && latestTriggerMin !== undefined && latestTriggerMin !== uiMin) {
  add("CRITICO", "supabase/migrations", `Preço mínimo divergente: trigger=${latestTriggerMin}, UI=${uiMin}`,
    "A interface aceita um preço que o banco rejeita, e a criação de produto falha com erro genérico.",
    "Alinhar validate_product_price(), a constraint CHECK e MIN_PRODUCT_PRICE no mesmo valor.",
    "criar anúncio no valor mínimo exato e confirmar sucesso");
}

// Colunas exigidas pelo frontend que nunca foram criadas.
const productColumns = new Set(
  [...sqlText.matchAll(/ALTER TABLE public\.products ADD COLUMN (?:IF NOT EXISTS )?(\w+)/gi)].map((m) => m[1]),
);
for (const m of sqlText.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?public\.products\s*\(([\s\S]*?)\n\);/gi)) {
  for (const line of m[1].split("\n")) {
    const col = line.trim().match(/^(\w+)\s+/);
    if (col) productColumns.add(col[1]);
  }
}
const requiredByUi = (catalogText.match(/SAFE_PRODUCT_COLUMNS\s*=\s*"([^"]+)"/) || [])[1]?.split(",") ?? [];
for (const col of requiredByUi) {
  if (col && !productColumns.has(col)) {
    add("ALTO", "src/lib/catalog.ts", `Frontend seleciona products.${col}, que nenhuma migration cria`,
      "Um único nome de coluna inexistente faz o PostgREST rejeitar o SELECT inteiro e a loja mostra 0 produtos.",
      "Criar a coluna por migration ou remover o nome da lista de colunas seguras.",
      "SELECT da lista completa deve retornar 200");
  }
}

// ---------------------------------------------------------------------------
// 8. Edge Functions: CORS, vazamento e autorização
// ---------------------------------------------------------------------------
const config = read(join(ROOT, "supabase/config.toml"));
for (const file of edgeFiles) {
  const text = read(file);
  const name = rel(file).split("/")[2];
  const publicFn = new RegExp(`\\[functions\\.${name}\\][\\s\\S]*?verify_jwt\\s*=\\s*false`).test(config);

  if (/Access-Control-Allow-Origin["']?\s*[:=]\s*["']\*/.test(text) && /SERVICE_ROLE/.test(text) && publicFn) {
    add("ALTO", rel(file), "Função com service_role, verify_jwt=false e CORS '*'",
      "Qualquer site pode chamar a função em nome do visitante, com privilégios totais no banco.",
      "Restringir Access-Control-Allow-Origin ao domínio da ZXMAX e exigir JWT ou assinatura do provedor.",
      "chamar a função de outra origem e esperar bloqueio");
  }
  // Only a *listing* query is dangerous. Looking a single product up by id
  // during a purchase is legitimate and must not be flagged.
  const listsProducts = /from\(["']products["']\)/.test(text)
    && !/\.eq\(\s*["'](id|product_id)["']/.test(text);
  if (/SERVICE_ROLE/.test(text) && listsProducts && !/\.eq\(\s*["']approved["']\s*,\s*true\s*\)/.test(text)) {
    add("CRITICO", rel(file), "Listagem de products com service_role sem filtro de aprovação",
      "O service_role ignora a RLS: sem o filtro, anúncios pendentes de terceiros vazam para visitantes.",
      "Aplicar .eq('approved', true) como fronteira de autorização explícita.",
      "endpoint público não pode retornar produto pendente");
  }
  if (/JSON\.stringify\(\{[^}]*error:\s*(error|e)\.message/.test(text)) {
    add("MEDIO", rel(file), "Mensagem de erro do servidor devolvida ao cliente",
      "Detalhe interno (SQL, nome de coluna, provedor) chega ao navegador.",
      "Logar no servidor e devolver um código/flag genérico.",
      "forçar erro e inspecionar a resposta");
  }
  if (/(withdraw|purchase|pix|checkout|login)/i.test(rel(file)) && !/rate|throttle|limit/i.test(text)) {
    add("MEDIO", rel(file), "Fluxo sensível sem rate limiting aparente",
      "Permite força bruta, criação de pedidos em massa e abuso de gateway.",
      "Aplicar limite por usuário/IP (tabela de contadores ou serviço de rate limit).",
      "disparar N chamadas seguidas e esperar 429");
  }
}

// ---------------------------------------------------------------------------
// 9. Rotas e imports quebrados
// ---------------------------------------------------------------------------
const appText = read(join(ROOT, "src/App.tsx"));
const definedRoutes = new Set([...appText.matchAll(/path="([^"]+)"/g)].map((m) => m[1]));
const linked = new Set();
for (const file of srcFiles) {
  for (const m of read(file).matchAll(/(?:to|href)=["'](\/[a-z0-9\-/]*)/gi)) linked.add(m[1].split("?")[0]);
}
for (const route of linked) {
  const known = [...definedRoutes].some((d) => d === route || (d.includes(":") && route.startsWith(d.split(":")[0])));
  if (!known && route !== "/") {
    add("MEDIO", "src/App.tsx", `Link para rota inexistente: ${route}`,
      "O usuário chega numa página 404 vinda de um botão do próprio site.",
      "Criar a rota com conteúdo real ou remover o link.",
      "clicar no link e confirmar que renderiza a página");
  }
}

const aliasFiles = new Set(srcFiles.map((f) => rel(f).replace(/^src\//, "").replace(/\.(tsx?|ts)$/, "")));
for (const file of srcFiles) {
  for (const m of read(file).matchAll(/from\s+["']@\/([^"']+)["']/g)) {
    const target = m[1].replace(/\.(tsx?|js)$/, "");
    if (!aliasFiles.has(target) && !aliasFiles.has(`${target}/index`)) {
      add("ALTO", rel(file), `Import quebrado: @/${m[1]}`,
        "Quebra o build ou gera chunk vazio em runtime.",
        "Corrigir o caminho do import.",
        "npx tsc -b deve passar");
    }
  }
}

// ---------------------------------------------------------------------------
// 10. Acessibilidade / responsividade (heurísticas)
// ---------------------------------------------------------------------------
for (const file of srcFiles.filter((f) => f.endsWith(".tsx"))) {
  const text = read(file);
  const imgs = text.match(/<img(?![^>]*\balt=)[^>]*>/g) || [];
  if (imgs.length) {
    add("BAIXO", rel(file), `${imgs.length} <img> sem atributo alt`,
      "Leitores de tela não descrevem a imagem.",
      'Adicionar alt="" para imagem decorativa ou um texto descritivo.',
      "auditoria Lighthouse de acessibilidade");
  }
  if (/\bw-\[\d{3,}px\]/.test(text)) {
    add("BAIXO", rel(file), "Largura fixa grande em px",
      "Pode gerar rolagem horizontal em telas pequenas.",
      "Usar largura relativa/max-width com breakpoints.",
      "abrir em viewport de 360px");
  }
}

// ---------------------------------------------------------------------------
// 11. Dependências vulneráveis
// ---------------------------------------------------------------------------
try {
  const out = execSync("npm audit --json", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString();
  const audit = JSON.parse(out);
  const v = audit.metadata?.vulnerabilities ?? {};
  const map = { critical: "CRITICO", high: "ALTO", moderate: "MEDIO", low: "BAIXO" };
  for (const [level, severity] of Object.entries(map)) {
    if (v[level]) {
      add(severity, "package.json", `${v[level]} dependência(s) com vulnerabilidade ${level}`,
        "Cadeia de suprimento: código de terceiros com falha conhecida no build ou em runtime.",
        "Rodar `npm audit fix`; para breaking changes, atualizar manualmente e testar.",
        "npm audit deve zerar o nível correspondente");
    }
  }
} catch (error) {
  const out = String(error.stdout ?? "");
  try {
    const audit = JSON.parse(out);
    const v = audit.metadata?.vulnerabilities ?? {};
    const map = { critical: "CRITICO", high: "ALTO", moderate: "MEDIO", low: "BAIXO" };
    for (const [level, severity] of Object.entries(map)) {
      if (v[level]) {
        add(severity, "package.json", `${v[level]} dependência(s) com vulnerabilidade ${level}`,
          "Cadeia de suprimento: código de terceiros com falha conhecida.",
          "Rodar `npm audit fix` e revisar breaking changes.",
          "npm audit deve zerar o nível correspondente");
      }
    }
  } catch {
    add("BAIXO", "package.json", "npm audit não pôde ser executado", "Sem visibilidade de CVEs.", "Rodar npm audit manualmente.", "-");
  }
}

// ---------------------------------------------------------------------------
// 12. Pipeline (--full)
// ---------------------------------------------------------------------------
const pipeline = [];
if (FULL) {
  const steps = [
    ["TypeScript", "npx tsc -b"],
    ["Build", "npm run build"],
    ["Lint", "npm run lint"],
    ["Testes", "npm test"],
  ];
  for (const [label, cmd] of steps) {
    try {
      execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
      pipeline.push({ label, cmd, status: "OK" });
    } catch (error) {
      pipeline.push({ label, cmd, status: "FALHOU", output: String(error.stdout ?? "").slice(-1500) });
      add(label === "Lint" ? "MEDIO" : "ALTO", "pipeline", `${label} falhou`,
        "Quebra o deploy ou libera regressão para produção.",
        `Corrigir os erros reportados por \`${cmd}\`.`, cmd);
    }
  }
}

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------
const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s)]));

if (AS_JSON) {
  writeFileSync(join(ROOT, "audit-report.json"), JSON.stringify({ pipeline, findings }, null, 2));
  console.log(JSON.stringify({ pipeline, summary: Object.fromEntries(SEVERITIES.map((s) => [s, bySeverity[s].length])) }, null, 2));
} else {
  const TITLES = { CRITICO: "Crítico", ALTO: "Alto", MEDIO: "Médio", BAIXO: "Baixo", MELHORIA: "Melhorias futuras" };
  console.log("# Scanner técnico ZXMAX\n");
  console.log(`Gerado em ${new Date().toISOString()}\n`);
  if (pipeline.length) {
    console.log("## Pipeline\n");
    for (const step of pipeline) console.log(`- ${step.status === "OK" ? "✅" : "❌"} ${step.label} (\`${step.cmd}\`)`);
    console.log("");
  }
  console.log("## Resumo\n");
  for (const s of SEVERITIES) console.log(`- ${TITLES[s]}: ${bySeverity[s].length}`);
  console.log("");
  for (const s of SEVERITIES) {
    if (!bySeverity[s].length) continue;
    console.log(`## ${TITLES[s]}\n`);
    for (const f of bySeverity[s]) {
      console.log(`### ${f.title}`);
      console.log(`- **Área:** \`${f.area}\``);
      console.log(`- **Impacto:** ${f.impact}`);
      console.log(`- **Correção segura:** ${f.fix}`);
      console.log(`- **Teste de regressão:** ${f.test}\n`);
    }
  }
}

// Só falha o processo por achado crítico ou por etapa de pipeline quebrada.
const blocking = bySeverity.CRITICO.length + pipeline.filter((p) => p.status === "FALHOU").length;
process.exit(blocking > 0 ? 1 : 0);
