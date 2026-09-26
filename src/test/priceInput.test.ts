import { describe, expect, it } from "vitest";
import { MIN_PRODUCT_PRICE, normalizeProductPrice, parsePriceInput } from "@/lib/catalog";

describe("parsePriceInput", () => {
  it("accepts dot decimals", () => expect(parsePriceInput("2.00")).toBe(2));
  it("accepts pt-BR comma decimals", () => expect(parsePriceInput("2,00")).toBe(2));
  it("keeps pt-BR thousands separators", () => expect(parsePriceInput("1.234,56")).toBe(1234.56));
  it("strips currency text and symbols", () => expect(parsePriceInput("R$ 19,90")).toBe(19.9));
  it("returns zero for empty or invalid input", () => {
    expect(parsePriceInput("")).toBe(0); expect(parsePriceInput("abc")).toBe(0);
    expect(parsePriceInput(null)).toBe(0); expect(parsePriceInput(undefined)).toBe(0);
  });
  it("passes finite numbers through", () => { expect(parsePriceInput(2)).toBe(2); expect(parsePriceInput(0.5)).toBe(0.5); });
  it("supports the platform minimum", () => { expect(parsePriceInput("2,00")).toBeGreaterThanOrEqual(MIN_PRODUCT_PRICE); expect(parsePriceInput("1,99")).toBeLessThan(MIN_PRODUCT_PRICE); });
});

describe("normalizeProductPrice", () => {
  it("returns normal prices unchanged", () => expect(normalizeProductPrice({ price: 19.9, category: "Contas" })).toBe(19.9));
  it("heals legacy per-unit Robux prices", () => expect(normalizeProductPrice({ price: 0.002, category: "Robux e Gift Cards", variations: [{ price: 2 }] })).toBe(2));
  it("does not invent non-Robux prices", () => expect(normalizeProductPrice({ price: 0.002, category: "Contas" })).toBe(0.002));
  it("keeps a low price without a package variation", () => expect(normalizeProductPrice({ price: 0.002, category: "Robux e Gift Cards", variations: [] })).toBe(0.002));
});
