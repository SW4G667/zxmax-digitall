import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = async (path: string) => readFile(join(process.cwd(), path), "utf8");

describe("fronteira de privacidade de participantes", () => {
  it("não envia e-mail de vendedor ao criar anúncio e usa o ID autenticado para autogestão", async () => {
    const store = await source("src/store/StoreContext.tsx");
    const inventory = await source("src/components/InventoryView.tsx");

    expect(store).not.toContain("seller_email: state.currentUser.email");
    expect(store).toContain("existing.sellerId !== actorId");
    expect(store).toContain("product.sellerId !== actorId");
    expect(inventory).toContain("p.sellerId === state.currentUser?.id");
    expect(inventory).not.toContain("p.sellerEmail === state.currentUser?.email");
  });

  it("delimita notificações, suporte e chat pelo ID do participante", async () => {
    const notifications = await source("src/components/NotificationBell.tsx");
    const support = await source("src/components/SupportView.tsx");
    const chat = await source("src/components/OrderChat.tsx");

    expect(notifications).toContain("p.sellerId === userId");
    expect(notifications).toContain("p.buyerId === userId");
    expect(notifications).toContain("t.userId === userId");
    expect(notifications).not.toContain("p.sellerEmail === email");
    expect(notifications).not.toContain("p.buyerEmail === email");
    expect(support).toContain("t.userId === state.currentUser?.id");
    expect(chat).toContain("purchase?.sellerId === me");
    expect(chat).toContain("purchase?.buyerId === me");
    expect(chat).not.toContain("purchase?.sellerEmail === state.currentUser?.email");
  });

  it("deixa a confirmação financeira e os e-mails pós-pagamento exclusivamente no servidor", async () => {
    const modal = await source("src/components/PixPaymentModal.tsx");
    const purchases = await source("src/components/MyPurchasesView.tsx");
    const webhook = await source("supabase/functions/vexopay-webhook/index.ts");

    expect(modal).not.toContain('functions.invoke("send-email"');
    expect(purchases).not.toContain('functions.invoke("send-email"');
    expect(webhook).toContain("functions/v1/send-email");
  });
});
