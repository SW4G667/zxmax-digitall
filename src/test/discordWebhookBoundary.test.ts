import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = (relativePath: string) => readFile(resolve(process.cwd(), relativePath), "utf8");

describe("integração Discord pessoal", () => {
  it("mantém URLs fora das respostas de listagem e exige JWT no gerenciamento", async () => {
    const edge = await source("supabase/functions/manage-discord-webhooks/index.ts");
    const migration = await source("supabase/migrations/20260828093000_secure_user_discord_webhooks.sql");
    const ui = await source("src/components/DiscordWebhookSettings.tsx");

    expect(edge).toContain('if (!token) return json({ error: "Autenticação obrigatória." }, 401)');
    expect(edge).toContain('.select("event_type,active,last_delivery_status,last_delivery_at,updated_at")');
    expect(edge).not.toContain('select("event_type,webhook_url');
    expect(migration).toContain("vault_secret_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("REVOKE ALL ON TABLE public.user_discord_webhooks FROM anon, authenticated");
    expect(ui).toContain("A URL é tratada como segredo");
    expect(ui).toContain('setDrafts((current) => ({ ...current, [eventType]: "" }))');
  });

  it("permite reutilizar a URL em eventos distintos sem permitir destino cruzado", async () => {
    const migration = await source("supabase/migrations/20260828093000_secure_user_discord_webhooks.sql");
    const edge = await source("supabase/functions/manage-discord-webhooks/index.ts");
    const ui = await source("src/components/DiscordWebhookSettings.tsx");

    expect(migration).toContain("UNIQUE (user_id, event_type)");
    expect(migration).not.toContain("UNIQUE (user_id, vault_secret_id)");
    expect(edge).toContain('.eq("user_id", authData.user.id)');
    expect(ui).toContain("Você pode repetir a mesma URL em mais de um cartão");
  });

  it("entrega somente depois de resolver evento real e registra idempotência sem conteúdo privado", async () => {
    const delivery = await source("supabase/functions/deliver-discord-webhook/index.ts");
    const notify = await source("supabase/functions/notify-product-event/index.ts");
    const stripe = await source("supabase/functions/stripe-webhook/index.ts");

    expect(delivery).toContain('if (!token || token !== serviceKey) return json({ error: "Unauthorized" }, 401)');
    expect(delivery).toContain('claim_user_discord_webhook_delivery');
    expect(delivery).toContain('allowed_mentions: { parse: [] }');
    expect(delivery).toContain('response.status === 404 ? "disabled_not_found" : response.status === 429 ? "rate_limited"');
    expect(delivery).toContain('"Conteúdo disponível somente dentro da ZXMAX."');
    expect(notify).toContain('data.author_id !== authData.user.id');
    expect(notify).toContain('data.buyer_id !== authData.user.id');
    expect(stripe).toContain('eventType: "sale_confirmed", eventId: purchaseId');
  });

  it("não oferece teste externo automático nem envia webhook pelo navegador", async () => {
    const ui = await source("src/components/DiscordWebhookSettings.tsx");
    const store = await source("src/store/StoreContext.tsx");
    const product = await source("src/pages/Produto.tsx");

    expect(ui).not.toContain('body: { action: "test"');
    expect(store).toContain('functions.invoke("notify-product-event"');
    expect(product).toContain('functions.invoke("notify-product-event"');
    expect(product).not.toContain('functions.invoke("send-email", { body: { type: "new_question"');
  });
});
