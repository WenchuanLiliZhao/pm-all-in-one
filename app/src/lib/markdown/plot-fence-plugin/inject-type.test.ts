import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { injectPlotFenceType } from "./inject-type.ts";

describe("injectPlotFenceType", () => {
  it("injects type from the info-string second token", () => {
    const src = ["```plot riemann", "f: x^2", "n: 8", "```"].join("\n");
    assert.equal(
      injectPlotFenceType(src),
      ["```plot", "type: riemann", "f: x^2", "n: 8", "```"].join("\n"),
    );
  });

  it("replaces an existing unindented type line", () => {
    const src = ["```plot extrema", "type: function", "f: x", "```"].join("\n");
    assert.equal(
      injectPlotFenceType(src),
      ["```plot", "type: extrema", "f: x", "```"].join("\n"),
    );
  });

  it("leaves non-plot fences and plot-without-type alone", () => {
    const src = [
      "```js",
      "plot riemann",
      "```",
      "",
      "```plot",
      "type: riemann",
      "f: x",
      "```",
    ].join("\n");
    assert.equal(injectPlotFenceType(src), src);
  });
});
