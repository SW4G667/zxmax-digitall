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
    expect(email).toContain("{ from: EMAIL_FROM, to: [recipient], subject, html, text }");
  });

  it("continua autorizando e evitando duplicação antes de acessar o provedor", async () => {
    const email = await source();
    expect(email).toContain('if ((type === "purchase_confirmed" || type === "new_sale" || type === "product_approved" || type === "product_rejected" || type === "product_removed") && !internalCall)');
    expect(email).toContain("Este tipo de notificação é processado pelo servidor.");
    expect(email).toContain("if (!internalCall && actorId !== question.author_id)");
    expect(email).toContain('.eq("status", "sent")');
    expect(email).toContain("if (previous) return json({ already_sent: true });");
    expect(email).toContain('if (!RESEND_API_KEY) return json({ skipped: true, reason: "email_provider_not_configured" }, 202);');
    expect(email).toContain('if (!EMAIL_FROM) return json({ skipped: true, reason: "email_sender_not_configured" }, 202);');
    expect(email).not.toContain('"ZXMAX <noreply@zxmax.com.br>"');
  });
});
