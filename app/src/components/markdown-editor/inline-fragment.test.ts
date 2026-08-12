import assert from "node:assert/strict";
import test from "node:test";
import { renderInlineMarkdownFragment } from "./inline-fragment.ts";

test("renderInlineMarkdownFragment styles strong / em / code / link", () => {
  const html = renderInlineMarkdownFragment(
    "**bold** and *em* and `code` and [docs](https://example.com)",
  );
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>em<\/em>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<a href="https:\/\/example\.com">docs<\/a>/);
});

test("renderInlineMarkdownFragment empty / plain", () => {
  assert.equal(renderInlineMarkdownFragment(""), "");
  assert.equal(renderInlineMarkdownFragment("  hello  "), "hello");
});
