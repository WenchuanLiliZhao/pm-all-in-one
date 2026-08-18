import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findMathSpans, type ByteRange } from "./parse.ts";
import { renderMath } from "./render.ts";

function fenceRange(source: string): ByteRange {
  const start = source.indexOf("```");
  const end = source.lastIndexOf("```");
  const closeNl = source.indexOf("\n", end);
  return { from: start, to: closeNl === -1 ? source.length : closeNl + 1 };
}

describe("findMathSpans", () => {
  it("matches inline $…$ on one line", () => {
    const src = "see $x^2$ here";
    const [span] = findMathSpans(src);
    assert.deepEqual(span, { from: 4, to: 9, tex: "x^2", display: false });
  });

  it("matches display $$…$$ including the issue integral", () => {
    const tex = String.raw`\int_{0}^{2.5}\left(4 - \tfrac{x^2}{2}\right)dx`;
    const src = `area $${tex}$`;
    const [span] = findMathSpans(src);
    assert.equal(span?.display, false);
    assert.equal(span?.tex, tex);
  });

  it("matches multi-line display $$ before inline $", () => {
    const src = "$$\nE = mc^2\n$$\nand $x$";
    const spans = findMathSpans(src);
    assert.equal(spans.length, 2);
    assert.equal(spans[0]?.display, true);
    assert.equal(spans[0]?.tex, "\nE = mc^2\n");
    assert.equal(spans[1]?.display, false);
    assert.equal(spans[1]?.tex, "x");
  });

  it("matches single-line display $$ x $$", () => {
    const src = "$$ x $$";
    const [span] = findMathSpans(src);
    assert.equal(span?.display, true);
    assert.equal(span?.tex, " x ");
  });

  it("skips $ inside a fenced code range", () => {
    const src = "ok $a$\n\n```\n$x$\n```\n";
    const spans = findMathSpans(src, [fenceRange(src)]);
    assert.equal(spans.length, 1);
    assert.equal(spans[0]?.tex, "a");
  });

  it("skips escaped \\$", () => {
    assert.deepEqual(findMathSpans(String.raw`cost is \$5`), []);
    assert.deepEqual(findMathSpans(String.raw`\$a$`), []);
  });

  it("does not open on whitespace after $ or close on whitespace before $", () => {
    assert.deepEqual(findMathSpans("$ foo$"), []);
    assert.deepEqual(findMathSpans("$foo $"), []);
  });

  it("does not emit a span for unclosed $", () => {
    assert.deepEqual(findMathSpans("see $foo"), []);
    assert.deepEqual(findMathSpans("$$\nno close"), []);
  });

  it("keeps escaped dollar inside inline tex", () => {
    const src = String.raw`$a\$b$`;
    const [span] = findMathSpans(src);
    assert.equal(span?.tex, String.raw`a\$b`);
  });

  it("does not treat empty $ or $$ pairs as math", () => {
    assert.deepEqual(findMathSpans("$$$$"), []);
    assert.deepEqual(findMathSpans("$$\n$$"), []);
    assert.deepEqual(findMathSpans("$$ $$"), []);
  });

  it("does not let a typed $$ swallow formulas below", () => {
    const src = "draft $$\n\nsee $x^2$\n\n$$\nE = mc^2\n$$";
    const spans = findMathSpans(src);
    assert.equal(spans.length, 2);
    assert.equal(spans[0]?.tex, "x^2");
    assert.equal(spans[0]?.display, false);
    assert.equal(spans[1]?.display, true);
    assert.match(spans[1]?.tex ?? "", /E = mc\^2/);
  });

  it("does not let a line-only $$ swallow inline then display below", () => {
    const src = "$$\n\nsee $x^2$\n\n$$\nE = mc^2\n$$";
    const spans = findMathSpans(src);
    assert.equal(spans.length, 2);
    assert.equal(spans[0]?.tex, "x^2");
    assert.equal(spans[1]?.display, true);
    assert.match(spans[1]?.tex ?? "", /E = mc\^2/);
  });

  it("does not emit a span for a lone $$", () => {
    assert.deepEqual(findMathSpans("$$"), []);
    assert.deepEqual(findMathSpans("hello $$"), []);
  });
});

describe("renderMath", () => {
  it("renders a simple expression", () => {
    const r = renderMath("x^2", false);
    assert.equal(r.ok, true);
    if (r.ok) assert.match(r.html, /katex/);
  });

  it("returns a bounded error for malformed TeX", () => {
    const r = renderMath(String.raw`\notARealCommand{`, false);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.length > 0);
  });
});
