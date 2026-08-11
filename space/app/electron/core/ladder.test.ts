import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canReparentPreservingLevel,
  descendantsOf,
  levelAtDepth,
  nextLevel,
  planMove,
  subtreeHeight,
  validateLadder,
  type LadderRow,
} from "./ladder.js";

/** epic 1 > task 2 > subtask 3, plus a second epic 4. */
function healthy(): LadderRow[] {
  return [
    { key: "1", level: "epic", parentKey: null },
    { key: "2", level: "task", parentKey: "1" },
    { key: "3", level: "subtask", parentKey: "2" },
    { key: "4", level: "epic", parentKey: null },
  ];
}

function kinds(rows: LadderRow[], key: string): string[] {
  return (validateLadder(rows).get(key) ?? []).map((v) => v.kind);
}

test("levels step one at a time and stop at subtask", () => {
  assert.equal(nextLevel("epic"), "task");
  assert.equal(nextLevel("task"), "subtask");
  assert.equal(nextLevel("subtask"), null);
  assert.equal(levelAtDepth(0), "epic");
  assert.equal(levelAtDepth(3), null);
});

test("a healthy tree reports nothing", () => {
  assert.equal(validateLadder(healthy()).size, 0);
});

test("a top-level issue must be an epic", () => {
  const rows = healthy();
  rows[0] = { key: "1", level: "task", parentKey: null };
  assert.deepEqual(kinds(rows, "1"), ["root-not-epic"]);
  const violation = validateLadder(rows).get("1")![0]!;
  assert.equal(violation.expectedLevel, "epic");
});

test("a task parented to a task is a ladder break, not a silent subtask", () => {
  const rows: LadderRow[] = [
    { key: "1", level: "epic", parentKey: null },
    { key: "2", level: "task", parentKey: "1" },
    { key: "5", level: "task", parentKey: "2" },
  ];
  assert.deepEqual(kinds(rows, "5"), ["ladder-break"]);
  assert.equal(validateLadder(rows).get("5")![0]!.expectedLevel, "subtask");
});

test("a subtask cannot have children", () => {
  const rows = healthy();
  rows.push({ key: "5", level: "subtask", parentKey: "3" });
  assert.deepEqual(kinds(rows, "5"), ["ladder-break"]);
  assert.equal(validateLadder(rows).get("5")![0]!.expectedLevel, null);
});

test("a dangling parent is reported on the child", () => {
  const rows = healthy();
  rows.push({ key: "9", level: "task", parentKey: "404" });
  assert.deepEqual(kinds(rows, "9"), ["missing-parent"]);
});

test("self-parent is reported before anything else", () => {
  const rows = healthy();
  rows.push({ key: "9", level: "task", parentKey: "9" });
  assert.deepEqual(kinds(rows, "9"), ["self-parent"]);
});

test("every node on a parent cycle is reported", () => {
  const rows: LadderRow[] = [
    { key: "1", level: "epic", parentKey: "3" },
    { key: "2", level: "task", parentKey: "1" },
    { key: "3", level: "subtask", parentKey: "2" },
  ];
  const report = validateLadder(rows);
  assert.deepEqual([...report.keys()].sort(), ["1", "2", "3"]);
  for (const key of ["1", "2", "3"]) {
    assert.deepEqual(kinds(rows, key), ["cycle"]);
  }
});

test("subtree helpers walk descendants", () => {
  const rows = healthy();
  assert.deepEqual(descendantsOf(rows, "1"), ["2", "3"]);
  assert.deepEqual(descendantsOf(rows, "3"), []);
  assert.equal(subtreeHeight(rows, "1"), 2);
  assert.equal(subtreeHeight(rows, "3"), 0);
});

test("promoting a task to the root promotes its subtree with it", () => {
  const changes = planMove(healthy(), "2", null);
  assert.deepEqual(changes, [
    { key: "2", from: "task", to: "epic" },
    { key: "3", from: "subtask", to: "task" },
  ]);
});

test("moving to the parent it already has is a no-op", () => {
  assert.deepEqual(planMove(healthy(), "2", "1"), []);
});

test("moving to a new parent at the same depth changes no levels", () => {
  const changes = planMove(healthy(), "2", "4");
  assert.deepEqual(changes, []);
});

test("a subtree that would not fit is rejected", () => {
  // Epic 1 already has task 2 > subtask 3; nesting it under epic 4 would push
  // subtask 3 one level past the bottom of the ladder.
  assert.throws(
    () => planMove(healthy(), "1", "4"),
    /past subtask|exceeds/,
  );
});

test("a subtask cannot be given children by a move", () => {
  assert.throws(() => planMove(healthy(), "4", "3"), /subtasks cannot have children/);
});

test("moving into your own subtree is rejected", () => {
  assert.throws(() => planMove(healthy(), "1", "3"), /own subtree/);
});

test("an issue cannot parent itself via a move", () => {
  assert.throws(() => planMove(healthy(), "1", "1"), /its own parent/);
});

test("an unknown target is rejected", () => {
  assert.throws(() => planMove(healthy(), "2", "404"), /Unknown parent/);
});

test("a broken chain must be repaired before moving", () => {
  const rows: LadderRow[] = [
    { key: "1", level: "epic", parentKey: "2" },
    { key: "2", level: "task", parentKey: "1" },
    { key: "4", level: "epic", parentKey: null },
  ];
  assert.throws(() => planMove(rows, "1", "4"), /parent chain is broken/);
});

test("canReparentPreservingLevel allows same-depth reparent", () => {
  assert.equal(canReparentPreservingLevel(healthy(), "2", "4"), true);
  assert.equal(canReparentPreservingLevel(healthy(), "2", "1"), true);
});

test("canReparentPreservingLevel rejects promote/demote and illegal targets", () => {
  assert.equal(canReparentPreservingLevel(healthy(), "2", null), false);
  assert.equal(canReparentPreservingLevel(healthy(), "1", "4"), false);
  assert.equal(canReparentPreservingLevel(healthy(), "4", "3"), false);
  assert.equal(canReparentPreservingLevel(healthy(), "2", "404"), false);
});
