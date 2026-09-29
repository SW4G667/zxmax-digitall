import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("PIX paid-state loop regression", () => {
  it("does not reset paid state because a parent callback changed identity", async () => {
    const modal = await readFile("src/components/PixPaymentModal.tsx", "utf8");
    const purchases = await readFile("src/components/MyPurchasesView.tsx", "utf8");
    const product = await readFile("src/pages/Produto.tsx", "utf8");

    expect(modal).toContain("const onPaidRef = useRef(onPaid)");
    expect(modal).toContain("onPaidRef.current = onPaid");
    expect(modal).toContain("zxmax:settled-pix:");
    expect(modal).toContain('window.sessionStorage.setItem(settledStorageKey, "1")');
    expect(modal).toContain("}, [chargeKey]);");
    expect(purchases).toContain('if (purchase.status !== "pending")');
    expect(purchases).toContain("window.location.replace");
    expect(purchases).toContain('params.set("payment", "confirmed")');
    expect(product).toContain("window.location.replace");
    expect(product).toContain("setCheckoutOpen(false);");
  });
});
