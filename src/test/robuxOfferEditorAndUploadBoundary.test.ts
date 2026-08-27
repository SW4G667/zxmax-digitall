import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFile(join(process.cwd(), path), "utf8");

describe("formulário, upload e checkout de Robux", () => {
  it("mantém Robux em uma única configuração sem nome, descrição ou variação editáveis", async () => {
    const inventory = await source("src/components/InventoryView.tsx");
    const migration = await source("supabase/migrations/20260827070000_normalize_robux_offers_and_seller_identity.sql");

    expect(inventory).toContain('name: isRobuxCategory ? "Robux" : form.name');
    expect(inventory).toContain('description: isRobuxCategory ? "" : form.description');
    expect(inventory).toContain('finalVariations = [{');
    expect(inventory).not.toContain("Eldorado.gg");
    expect(inventory).toContain("Oferta de Robux");
    expect(migration).toContain("NEW.name := 'Robux'");
    expect(migration).toContain("NEW.description := ''");
    expect(migration).toContain("jsonb_array_length");
    expect(migration).toContain("NEW.min_quantity > NEW.stock");
  });

  it("higieniza a falha de upload e deixa imagens de anúncio no bucket público próprio", async () => {
    const inventory = await source("src/components/InventoryView.tsx");
    const storageMigration = await source("supabase/migrations/20260827071500_isolate_storage_policy_helpers.sql");

    expect(inventory).toContain('storage.from("product-images").upload');
    expect(inventory).toContain('storage.from("product-images").getPublicUrl');
    expect(inventory).toContain("Não foi possível enviar a imagem. Atualize a página e tente novamente.");
    expect(inventory).not.toContain('toast.error("Erro upload: " +');
    expect(storageMigration).toContain("is_current_order_attachment_party");
    expect(storageMigration).not.toContain("is_order_party((split_part(name");
  });

  it("não descarta estoque ou mínimo em uma falha de autorização", async () => {
    const store = await source("src/store/StoreContext.tsx");

    expect(store).toContain('const retriable = code === "42703" || code === "PGRST204"');
    expect(store).not.toContain('code === "42703" || code === "PGRST204" || code === "42501"');
    expect(store).toContain('if ((code === "42703" || code === "PGRST204") && ("stock" in dbPayload');
  });

  it("apresenta PIX uma única vez e não exibe fornecedor técnico ao comprador", async () => {
    const productPage = await source("src/pages/Produto.tsx");

    expect(productPage).toContain('if (loadingMethods) return id !== "vexopay_pix"');
    expect(productPage).toContain('{ id: "zennith_pix", label: "PIX"');
    expect(productPage).toContain('{ id: "vexopay_pix", label: "PIX"');
    expect(productPage).not.toContain("Pagar com PIX · Zennith");
    expect(productPage).not.toContain("Função de Crypto (VexoPay)");
  });
});
