import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFile(join(process.cwd(), "supabase/functions/send-email/index.ts"), "utf8");

describe("e-mails transacionais seguros", () => {
  it("mantém layout acessível, alternativa de texto e CTA interno", async () => {
    const email = await source();
    expect(email).toContain('role="presentation"');
    expect(email).toContain('aria-label="${escapeHtml(cta)}"');
    expect(email).toContain("Para sua segurança, conclua qualquer ação somente dentro da plataforma.");
    expect(email).toContain('eq("key", "site_branding")');
    expect(email).toContain("branding.logoUrl");
    expect(email).toContain("branding.supportUrl");
    expect(email).toContain("{ from: EMAIL_FROM, to: [recipient], reply_to: EMAIL_REPLY_TO || undefined, subject, html, text }");
  });

  it("cobre o ciclo completo de compra, entrega e disputa", async () => {
    const email = await source();
    for (const type of [
      "purchase_created",
      "purchase_confirmed",
      "new_sale",
      "delivery_marked",
      "receipt_confirmed_buyer",
      "receipt_confirmed_seller",
      "refund_buyer",
      "refund_seller",
      "dispute_opened_buyer",
      "dispute_opened_seller",
      "dispute_resolved_buyer",
      "dispute_resolved_seller",
      "chat_message",
      "new_review",
    ]) expect(email).toContain(type);
  });

  it("continua autorizando e evitando duplicação antes de acessar o provedor", async () => {
    const email = await source();
    expect(email).toContain('if (type !== "new_question" && type !== "chat_message" && !internalCall)');
    expect(email).toContain("Este tipo de notificação é processado pelo servidor.");
    expect(email).toContain("if (!internalCall && actorId !== question.author_id)");
    expect(email).toContain('.eq("status", "sent")');
    expect(email).toContain("if (previous) return json({ already_sent: true });");
    expect(email).toContain('"Idempotency-Key": `zxmax-${type}-${logId}-${idempotencyKey || "v1"}`');
    expect(email).toContain('status: "skipped_config"');
    expect(email).toContain('email_provider_not_configured');
    expect(email).toContain('email_sender_not_configured');
    expect(email).toContain('EMAIL_REPLY_TO');
    expect(email).not.toContain('"ZXMAX <noreply@zxmax.com.br>"');
  });
});
