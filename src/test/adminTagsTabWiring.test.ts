import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("aba administrativa de Tags", () => {
  it("expõe a aba e monta o painel persistente no AdminView", async () => {
    const source = await readFile(join(process.cwd(), "src/components/AdminView.tsx"), "utf8");
    expect(source).toContain('import { AdminTagsPanel } from "@/components/AdminMorePanels"');
    expect(source).toContain('{ id: "tags", label: "Tags", icon: Tag }');
    expect(source).toContain('{tab === "tags" && <AdminTagsPanel />}');
  });
});
