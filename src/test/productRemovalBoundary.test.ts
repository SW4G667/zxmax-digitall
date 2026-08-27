import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = (relativePath: string) => readFile(resolve(process.cwd(), relativePath), "utf8");

describe("remoção persistente de anúncios", () => {
  it("usa contrato server-side e só confirma sucesso após reidratar o catálogo", async () => {
    const store = await source("src/store/StoreContext.tsx");
    const inventory = await source("src/components/InventoryView.tsx");

    expect(store).toContain('rpc("remove_product", { _product_id: id })');
    expect(store).toContain('status !== "deleted" && status !== "paused"');
    expect(store).toContain("await loadCatalog();\n    return { ok: true");
    expect(store).not.toContain('.from("products").delete().eq("id", id)');
    expect(inventory).toContain("const { ok, paused } = await deleteProduct(id);");
    expect(inventory).toContain("if (!ok) return;");
  });

  it("limita a função do banco ao titular ou administrador e preserva histórico de compras", async () => {
    const migration = await source("supabase/migrations/20260827080000_secure_product_removal.sql");

    expect(migration).toContain("target_product.seller_id IS DISTINCT FROM auth.uid()");
    expect(migration).toContain("public.has_role(auth.uid(), 'admin'::app_role)");
    expect(migration).toContain("FROM public.purchases");
    expect(migration).toContain("'status', 'paused'");
    expect(migration).toContain("GET DIAGNOSTICS deleted_count = ROW_COUNT");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.remove_product(bigint) FROM PUBLIC, anon");
  });
});
