import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const migration = readFileSync(
  join(__dirname, "../../supabase/migrations/20260824150000_product_reviews.sql"),
  "utf-8",
);

describe("reviews migration (20260824150000)", () => {
  it("cria a tabela product_reviews com RLS e política de leitura pública", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.product_reviews");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain('CREATE POLICY "Anyone can read product reviews"');
  });

  it("mantém os agregados em products via trigger", () => {
    expect(migration).toContain("review_count integer NOT NULL DEFAULT 0");
    expect(migration).toContain("review_avg numeric(3,2) NOT NULL DEFAULT 0");
    expect(migration).toContain("review_positive integer NOT NULL DEFAULT 0");
    expect(migration).toContain("maintain_product_review_stats_trg");
  });

  it("exponha a RPC create_product_review com checagens de posse e bloqueio de contato", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_product_review");
    expect(migration).toContain("PERFORM public.reject_external_contact(clean_comment)");
    expect(migration).toContain("v_purchase.buyer_id <> auth.uid()");
    expect(migration).toContain("status NOT IN ('delivered', 'delivered_pending_confirmation')");
  });

  it("recria products_public incluindo os agregados de avaliação", () => {
    expect(migration).toContain("DROP VIEW IF EXISTS public.products_public");
    expect(migration).toContain("review_count,\n  review_avg,\n  review_positive");
  });
});

describe("positive percentage helper (espelho do StoreContext)", () => {
  const positivePct = (reviewPositive: number, reviewCount: number) =>
    reviewCount > 0 && reviewPositive ? Math.round((reviewPositive / reviewCount) * 100) : 0;

  it("retorna 0 sem avaliações (estado honesto)", () => {
    expect(positivePct(0, 0)).toBe(0);
  });

  it("calcula o percentual de positivas", () => {
    expect(positivePct(9, 10)).toBe(90);
    expect(positivePct(1, 4)).toBe(25);
  });
});
