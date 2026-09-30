import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("PWA navigation isolation", () => {
  it("keeps seller/support actions inside the installed management app", async () => {
    const app = await readFile(join(process.cwd(), "src/pages/AppDashboard.tsx"), "utf8");
    const support = await readFile(join(process.cwd(), "src/components/SupportView.tsx"), "utf8");
    const inventory = await readFile(join(process.cwd(), "src/components/InventoryView.tsx"), "utf8");

    expect(app).toContain("onCompleteListingRequirements={completeListingRequirements}");
    expect(app).toContain("requestNewProduct={newProductRequest}");
    expect(support).toContain("onCompleteListingRequirements");
    expect(support).toContain("onOpenOrders");
    expect(support).toContain("onOpenProducts");
    expect(inventory).toContain("requestNewProduct = 0");
  });

  it("opens legal pages as public-site views instead of resetting to gateway home", async () => {
    const app = await readFile(join(process.cwd(), "src/pages/AppDashboard.tsx"), "utf8");
    const main = await readFile(join(process.cwd(), "src/main.tsx"), "utf8");
    expect(app).toContain('url.searchParams.set("external", "1")');
    expect(app).toContain('rel="external noopener noreferrer"');
    expect(main).toContain('if (params.get("external") === "1") return;');
  });

  it("bumps the installed-app cache after navigation fixes", async () => {
    const sw = await readFile(join(process.cwd(), "public/sw.js"), "utf8");
    expect(sw).toContain('zxmax-shell-v3');
  });
});
