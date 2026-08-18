import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePlotSpec } from "./normalize.ts";

describe("normalizePlotSpec", () => {
  it("aliases expression/steps/bounds onto f/n/range", () => {
    const spec = normalizePlotSpec({
      type: "riemann",
      expression: "4 - x^2 / 2",
      steps: 8,
      bounds: [0, 4],
    });
    assert.equal(spec.f, "4 - x^2 / 2");
    assert.equal(spec.n, 8);
    assert.deepEqual(spec.range, [0, 4]);
  });

  it("does not overwrite canonical keys", () => {
    const spec = normalizePlotSpec({
      type: "riemann",
      f: "x^2",
      expression: "ignored",
      n: 6,
      steps: 99,
    });
    assert.equal(spec.f, "x^2");
    assert.equal(spec.n, 6);
  });
});
