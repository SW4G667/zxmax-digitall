import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = async (path: string) => readFile(join(process.cwd(), path), "utf8");

describe("fronteira de autorização comercial", () => {
  it("revoga RPCs financeiras legadas e serializa saque contra o saldo entregue", async () => {
    const migration = await source("supabase/migrations/20260826080100_harden_withdrawal_and_refund_rpcs.sql");
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text, text, bigint)");
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.withdrawable_balance(uuid, bigint)");
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.seller_refund_order(bigint, text)");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("status = 'delivered'");
    expect(migration).toContain("Saldo disponível insuficiente para este saque");
  });

  it("não marca reembolso ou libera pedidos globalmente sem autorização e confirmação de provedor", async () => {
    const action = await source("supabase/functions/order-action/index.ts");
    expect(action).toContain("payment_provider");
    expect(action).toContain("exige endpoint oficial, confirmação verificável do provedor e conciliação");
    expect(action).toContain("Apenas administradores podem executar a liberação automática manualmente.");
    expect(action).not.toContain('status: "refunded"');
  });
});
