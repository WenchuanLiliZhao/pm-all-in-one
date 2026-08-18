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

test("renderInlineMarkdownFragment hides Escape backslash", () => {
  const html = renderInlineMarkdownFragment(
    '`"epic"` \\| `"task"` and \\*star\\*',
  );
  assert.match(html, /\|/);
  assert.doesNotMatch(html, /\\\|/);
  assert.match(html, /\*star\*/);
  assert.doesNotMatch(html, /\\\*/);
});

test("renderInlineMarkdownFragment renders $…$ via KaTeX", () => {
  const html = renderInlineMarkdownFragment("see $x^2$ here");
  assert.match(html, /katex/);
  assert.doesNotMatch(html, /\$x\^2\$/);
  assert.match(html, /see /);
  assert.match(html, / here/);
});

test("renderInlineMarkdownFragment leaves $ inside inline code", () => {
  const html = renderInlineMarkdownFragment("keep `$x^2$` literal");
  assert.doesNotMatch(html, /katex/);
  assert.match(html, /<code>/);
  assert.match(html, /\$x\^2\$/);
});

test("renderInlineMarkdownFragment plot title with unicode math", () => {
  const html = renderInlineMarkdownFragment(
    "Secant slope as $h → 0$ for $f(x) = x²$",
  );
  assert.match(html, /katex/);
  assert.doesNotMatch(html, /\$h/);
  assert.doesNotMatch(html, /\$f/);
});

test("renderInlineMarkdownFragment math inside strong", () => {
  const html = renderInlineMarkdownFragment("**$x$**");
  assert.match(html, /<strong>/);
  assert.match(html, /katex/);
});
