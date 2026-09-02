import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EditorSelection, EditorState } from "@codemirror/state";
import { starPairTransaction } from "./auto-pair.ts";

function applyStar(doc: string, from: number, to = from): EditorState {
  const state = EditorState.create({
    doc,
    selection:
      from === to
        ? EditorSelection.cursor(from)
        : EditorSelection.range(from, to),
  });
  return state.update(starPairTransaction(state)).state;
}

describe("starPairTransaction", () => {
  it("wraps a selection with one star (italic), not two (bold)", () => {
    const next = applyStar("选中文字", 0, 4);
    assert.equal(next.doc.toString(), "*选中文字*");
    assert.equal(next.selection.main.from, 1);
    assert.equal(next.selection.main.to, 5);
  });

  it("a second star on the still-selected wrap upgrades to bold", () => {
    const italic = applyStar("选中文字", 0, 4);
    const bold = italic.update(starPairTransaction(italic)).state;
    assert.equal(bold.doc.toString(), "**选中文字**");
    assert.equal(bold.selection.main.from, 2);
    assert.equal(bold.selection.main.to, 6);
  });

  it("empty caret inserts *|*", () => {
    const next = applyStar("ab", 1);
    assert.equal(next.doc.toString(), "a**b");
    assert.equal(next.selection.main.from, 2);
    assert.equal(next.selection.main.empty, true);
  });

  it("second star at *|* becomes **|**", () => {
    const once = applyStar("", 0);
    assert.equal(once.doc.toString(), "**");
    assert.equal(once.selection.main.from, 1);
    const twice = once.update(starPairTransaction(once)).state;
    assert.equal(twice.doc.toString(), "****");
    assert.equal(twice.selection.main.from, 2);
  });
});
