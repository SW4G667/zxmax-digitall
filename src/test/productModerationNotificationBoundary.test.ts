import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = (relativePath: string) => readFile(resolve(process.cwd(), relativePath), "utf8");

describe("notificações de moderação", () => {
  it("encadeia decisão autorizada e notificação somente pelo servidor", async () => {
    const edge = await source("supabase/functions/moderate-product/index.ts");
    const email = await source("supabase/functions/send-email/index.ts");
    const store = await source("src/store/StoreContext.tsx");

    expect(edge).toContain('authClient.rpc("moderate_product"');
    expect(edge).toContain('type: approved ? "product_approved" : "product_rejected"');
    expect(edge).toContain('Authorization: `Bearer ${serviceRoleKey}`');
    expect(email).toContain('"product_approved" | "product_rejected"');
    expect(email).toContain("processado pelo servidor");
    expect(email).toContain("Motivo informado pela moderação");
    expect(email).toContain("escapeHtml(reason)");
    expect(store).toContain('functions.invoke("moderate-product"');
    expect(store).not.toContain('rpc("moderate_product", { _product_id: id');
  });

  it("mantém retorno de e-mail não bloqueante e idempotente por decisão", async () => {
    const edge = await source("supabase/functions/moderate-product/index.ts");
    const email = await source("supabase/functions/send-email/index.ts");

    expect(edge).toContain('notification = "skipped"');
    expect(edge).toContain("decisão no banco já foi auditada");
    expect(email).toContain("let idempotencyKey: string | null = null");
    expect(email).toContain("previousQuery = previousQuery.eq(\"charge_id\", idempotencyKey)");
    expect(email).toContain("charge_id: idempotencyKey || result.id || null");
  });

  it("não expõe erros brutos de armazenamento ao enviar anexo no chat", async () => {
    const chat = await source("src/components/OrderChat.tsx");

    expect(chat).toContain("Não foi possível enviar a imagem. Atualize a página e tente novamente.");
    expect(chat).not.toContain('toast.error("Erro ao enviar imagem: " + (err?.message');
  });

  it("remove tokens de imagem assinada legada na projeção pública de catálogo", async () => {
    const catalog = await source("supabase/functions/public-products/index.ts");

    expect(catalog).toContain("function publicProductImage");
    expect(catalog).toContain('"/storage/v1/object/sign/product-images/"');
    expect(catalog).toContain("parsed.origin !== new URL(supabaseUrl).origin");
    expect(catalog).toContain("/storage/v1/object/public/product-images/${objectPath}");
    expect(catalog).toContain("image: publicProductImage(product.image, supabaseUrl)");
    expect(catalog).toContain("banner: publicProductImage(product.banner, supabaseUrl)");
  });
});
