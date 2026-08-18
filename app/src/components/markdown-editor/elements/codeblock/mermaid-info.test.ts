import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { isMermaidLang } from "./mermaid-info.ts";

const dir = dirname(fileURLToPath(import.meta.url));

describe("isMermaidLang", () => {
  it("matches mermaid after trim, case-insensitive", () => {
    assert.equal(isMermaidLang("mermaid"), true);
    assert.equal(isMermaidLang("Mermaid"), true);
    assert.equal(isMermaidLang(" MERMAID "), true);
  });

  it("rejects aliases, other langs, and empty", () => {
    assert.equal(isMermaidLang("mermaid-js"), false);
    assert.equal(isMermaidLang("js"), false);
    assert.equal(isMermaidLang(""), false);
    assert.equal(isMermaidLang("   "), false);
    assert.equal(isMermaidLang(undefined), false);
    assert.equal(isMermaidLang(null), false);
  });

  it("rejects product figure fence langs (stay ordinary code chrome)", () => {
    // Live/Preview idle-replace only when this gate is true. Do not widen
    // it for plot/figure DSLs — a figure path belongs in Reading View.
    assert.equal(isMermaidLang("plot"), false);
    assert.equal(isMermaidLang("plot riemann"), false);
    assert.equal(isMermaidLang("Plot"), false);
    assert.equal(isMermaidLang("riemann"), false);
  });
});

describe("product figure fences have no dedicated projection", () => {
  it("live.ts idle-replace only via isMermaidLang; preview has no core plot widget", () => {
    const live = readFileSync(join(dir, "live.ts"), "utf8");
    const preview = readFileSync(join(dir, "preview.tsx"), "utf8");
    assert.match(live, /if \(isMermaidLang\(lang\) && hasHeader\)/);
    assert.match(preview, /if \(isMermaidLang\(lang\)\)/);
    assert.match(preview, /fences\?\.get\(/);
    assert.doesNotMatch(live, /\bisPlotLang\b|\bPlotWidget\b/);
    assert.doesNotMatch(preview, /\bisPlotLang\b|\bPlotFigure\b/);
  });
});
