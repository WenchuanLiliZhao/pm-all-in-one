import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alignOf, parseSeparatorAligns } from "./pipe.ts";

describe("parseSeparatorAligns", () => {
  it("keeps segment text for each column", () => {
    assert.deepEqual(
      parseSeparatorAligns("| --- | :--- | :---: | ---: |", 4),
      ["---", ":---", ":---:", "---:"],
    );
  });

  it("pads missing segments with ---", () => {
    assert.deepEqual(parseSeparatorAligns("| --- | :--- |", 4), [
      "---",
      ":---",
      "---",
      "---",
    ]);
  });

  it("treats blank segments as ---", () => {
    assert.deepEqual(parseSeparatorAligns("| | |", 2), ["---", "---"]);
  });

  it("truncates extra segments to colCount", () => {
    assert.deepEqual(
      parseSeparatorAligns("| --- | :--- | :---: | ---: |", 2),
      ["---", ":---"],
    );
  });
});

describe("alignOf", () => {
  it("maps separator shapes to left/center/right", () => {
    assert.equal(alignOf("---"), "left");
    assert.equal(alignOf(":---"), "left");
    assert.equal(alignOf(":---:"), "center");
    assert.equal(alignOf("---:"), "right");
  });

  it("trims whitespace before checking colons", () => {
    assert.equal(alignOf("  ---:  "), "right");
  });
});
