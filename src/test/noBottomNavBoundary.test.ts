import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("mobile account navigation", () => {
  it("does not render the old fixed bottom shortcut bar from AppShell", async () => {
    const source = await readFile("src/components/AppShell.tsx", "utf8");
    expect(source).not.toContain("BottomNav");
    expect(source).not.toContain("<BottomNav");
  });
});
