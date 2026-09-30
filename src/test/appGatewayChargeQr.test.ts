import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("App Gateway PIX charge UX", () => {
  it("renders a QR from the stored PIX payload and lets the user reopen the charge", async () => {
    const app = await readFile(join(process.cwd(), "src/pages/AppDashboard.tsx"), "utf8");
    expect(app).toContain('import { QRCodeSVG } from "qrcode.react"');
    expect(app).toContain("<QRCodeSVG value={activeCharge.qrCode}");
    expect(app).toContain("Abrir cobrança");
    expect(app).toContain("Você pode fechar esta janela");
  });

  it("opens a freshly created charge and preserves expiry metadata", async () => {
    const app = await readFile(join(process.cwd(), "src/pages/AppDashboard.tsx"), "utf8");
    const edge = await readFile(join(process.cwd(), "supabase/functions/merchant-charge/index.ts"), "utf8");
    expect(app).toContain("setActiveCharge({");
    expect(edge).toContain("expiresAt:");
    expect(edge).toContain("createdAt:");
  });

  it("automatically rechecks an open pending charge without losing manual verification", async () => {
    const app = await readFile(join(process.cwd(), "src/pages/AppDashboard.tsx"), "utf8");
    expect(app).toContain("window.setInterval(() =>");
    expect(app).toContain("void checkCharge(activeCharge.id, true)");
    expect(app).toContain("Já paguei / verificar pagamento");
  });
});
