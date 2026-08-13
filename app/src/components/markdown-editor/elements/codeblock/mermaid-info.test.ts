import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMermaidLang } from "./mermaid-info.ts";

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
});
