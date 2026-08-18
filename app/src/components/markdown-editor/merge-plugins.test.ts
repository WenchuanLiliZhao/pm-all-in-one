import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MarkdownPlugin } from "./types.ts";
import { mergeFenceRegistry } from "./merge-plugins.ts";

const Dummy = () => null;

describe("mergeFenceRegistry", () => {
  it("merges langs lowercased and returns an empty map when none claimed", () => {
    assert.equal(mergeFenceRegistry(undefined).size, 0);
    assert.equal(mergeFenceRegistry([]).size, 0);
    const map = mergeFenceRegistry([
      {
        fences: [{ lang: "Plot", component: Dummy, interactive: true }],
      },
    ]);
    assert.equal(map.size, 1);
    assert.equal(map.get("plot")?.lang, "plot");
    assert.equal(map.get("plot")?.interactive, true);
  });

  it("throws on duplicate lang across plugins", () => {
    const plugins: MarkdownPlugin[] = [
      { fences: [{ lang: "plot", component: Dummy }] },
      { fences: [{ lang: "PLOT", component: Dummy }] },
    ];
    assert.throws(
      () => mergeFenceRegistry(plugins),
      /Duplicate MarkdownPlugin fence lang: plot/,
    );
  });

  it("throws on empty lang", () => {
    assert.throws(
      () => mergeFenceRegistry([{ fences: [{ lang: "  ", component: Dummy }] }]),
      /fence lang must be non-empty/,
    );
  });
});
