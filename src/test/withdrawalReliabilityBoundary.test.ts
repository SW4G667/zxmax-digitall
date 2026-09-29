import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("withdrawal reliability", () => {
  it("loads provider transaction id and delegates payout to one idempotent server flow", async () => {
    const store = await readFile("src/store/StoreContext.tsx", "utf8");
    const worker = await readFile("supabase/functions/process-withdrawal/index.ts", "utf8");

    expect(store).toContain("provider_tx_id");
    expect(store).toContain('functions.invoke("process-withdrawal"');
    expect(worker).toContain('"X-Idempotency-Key": reference');
    expect(worker).toContain('rpc("approve_withdrawal"');
    expect(worker).toContain('withdrawal.status === "approved"');
  });
});
