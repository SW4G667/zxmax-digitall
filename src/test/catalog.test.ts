import { describe, expect, it } from "vitest";
import { mergeCatalog, storefrontProducts } from "@/lib/catalog";

describe("catalog resilience", () => {
  it("does not erase a previous catalog after a failed empty request", () => {
    const previous = [{ id: 7, approved: true, sellerId: "seller" }];
    expect(mergeCatalog([], previous, { failed: true })).toEqual(previous);
  });

  it("keeps optimistic Date.now listings while merging server rows", () => {
    const optimistic = { id: 1_700_000_000_001, approved: false, sellerId: "me" };
    const server = { id: 9, approved: true, sellerId: "other" };
    expect(mergeCatalog([server], [optimistic])).toEqual([optimistic, server]);
  });

  it("shows approved listings plus the current seller pending listings", () => {
    const products = [
      { id: 1, approved: true, sellerId: "other" },
      { id: 2, approved: false, sellerId: "me" },
      { id: 3, approved: false, sellerId: "other" },
    ];
    expect(storefrontProducts(products, "me").map((p) => p.id)).toEqual([1, 2]);
  });
});
