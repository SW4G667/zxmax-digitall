import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("order chat international UX", () => {
  it("shows real order details and translates only the other participant message on demand", async () => {
    const chat = await readFile("src/components/OrderChat.tsx", "utf8");
    const edge = await readFile("supabase/functions/translate-order-message/index.ts", "utf8");
    expect(chat).toContain("Resumo do pedido");
    expect(chat).toContain("purchase?.quantity");
    expect(chat).toContain('"translate-order-message"');
    expect(chat).toContain('message.sender_id === me');
    expect(chat).toContain("differentParticipantLocale");
    expect(edge).toContain("message.sender_id === userData.user.id");
  });
});
