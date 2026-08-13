import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unescapeMarkdownEscape } from "./markdown-escape.ts";

describe("unescapeMarkdownEscape", () => {
  it("drops the backslash, keeps the escaped char", () => {
    assert.equal(unescapeMarkdownEscape("\\|"), "|");
    assert.equal(unescapeMarkdownEscape("\\*"), "*");
    assert.equal(unescapeMarkdownEscape("\\."), ".");
    assert.equal(unescapeMarkdownEscape("\\\\"), "\\");
  });

  it("passes through strings that are not escapes", () => {
    assert.equal(unescapeMarkdownEscape("|"), "|");
    assert.equal(unescapeMarkdownEscape(""), "");
  });
});
