import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = async (path: string) => readFile(join(process.cwd(), path), "utf8");

describe("checkout PIX exclusivo e neutro", () => {
  it("mantém no máximo um PIX no cliente e no contrato do servidor", async () => {
    const methods = await source("src/lib/paymentMethods.ts");
    const integrations = await source("supabase/functions/integrations-config/index.ts");
    const purchase = await source("supabase/functions/create-purchase/index.ts");
    const panel = await source("src/components/IntegrationsPanel.tsx");
    expect(methods).toContain("vexopay_pix: raw.zennith_pix ? false : raw.vexopay_pix");
    expect(integrations).toContain("const selectedPix = zennithPixActive ? \"zennith_pix\" : vexopayPixActive ? \"vexopay_pix\" : null;");
    expect(purchase).toContain("paymentMethod !== selectedPix");
    expect(panel).toContain('if (key === "pixEnabled" && value === true)');
    expect(panel).toContain("Usar como PIX único");
  });

  it("não apresenta marca de gateway nem imagem externa para o QR PIX do comprador", async () => {
    const product = await source("src/pages/Produto.tsx");
    const pix = await source("src/components/PixPaymentModal.tsx");
    expect(product).toContain('{ id: "zennith_pix", label: "PIX"');
    expect(product).toContain('method === "zennith_pix" || method === "vexopay_pix" ? "Pagar com PIX"');
    expect(product).not.toContain('label: "PIX · Zennith"');
    expect(product).not.toContain('label: "PIX · Vexo"');
    expect(pix).toContain('import { QRCodeSVG } from "qrcode.react";');
    expect(pix).toContain('<QRCodeSVG value={charge.qrCodeText}');
    expect(pix).not.toContain("api.qrserver.com");
  });

  it("mostra apenas o identificador público do vendedor com fallback do diretório público", async () => {
    const product = await source("src/pages/Produto.tsx");
    expect(product).toContain("product.sellerPublicId || state.userDirectory?.[product.sellerId]?.publicId || null");
    expect(product).toContain("ID público:");
    expect(product).not.toContain("sellerEmail");
    expect(product).toContain("E-mail e telefone não são exibidos publicamente.");
    expect(product).not.toContain('[["E-mail", null], ["Telefone", null]');
  });

  it("apenas atualiza a leitura do pedido depois do status validado pelo servidor", async () => {
    const product = await source("src/pages/Produto.tsx");
    const purchases = await source("src/components/MyPurchasesView.tsx");
    const pixConfirmation = product.slice(product.indexOf("const handlePixPaid"), product.indexOf("const handleSendQuestion"));
    expect(pixConfirmation).not.toContain('functions.invoke("send-email"');
    expect(purchases).not.toContain("markPurchasePaid");
    expect(purchases).toContain("void refreshPurchases()");
  });

  it("não devolve detalhes ou marca do gateway em erros de geração PIX ao comprador", async () => {
    const zennith = await source("supabase/functions/create-zennith-pix/index.ts");
    const vexo = await source("supabase/functions/create-evopay-pix/index.ts");
    expect(zennith).toContain('code: "pix_provider_unavailable"');
    expect(zennith).not.toContain('error: `Não foi possível gerar o PIX: ${detail');
    expect(vexo).toContain('error: "PIX temporariamente indisponível."');
    expect(vexo).not.toContain('error: "Não foi possível gerar o PIX via VexoPay."');
  });
});
