import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("mobile account navigation", () => {
  it("does not render the old fixed bottom shortcut bar from AppShell", async () => {
    const source = await readFile(new URL("../components/AppShell.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("BottomNav");
    expect(source).not.toContain("<BottomNav");
  });
});
