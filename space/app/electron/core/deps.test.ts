import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertValidBlockedBy,
  buildDepAdjacency,
  depGraphHasCycle,
  normalizeBlockedBy,
  pruneDeletedFromBlockedBy,
} from "./deps.js";

const a = "aaaaaaaaaaaaaaaaaaaaa";
const b = "bbbbbbbbbbbbbbbbbbbbb";
const c = "ccccccccccccccccccccc";
const missing = "ddddddddddddddddddddd";

test("normalizeBlockedBy dedupes and defaults", () => {
  assert.deepEqual(normalizeBlockedBy(undefined), []);
  assert.deepEqual(normalizeBlockedBy(null), []);
  assert.deepEqual(normalizeBlockedBy([a, a, b]), [a, b]);
  assert.throws(() => normalizeBlockedBy("x"));
  assert.throws(() => normalizeBlockedBy(["short"]));
});

test("assertValidBlockedBy rejects self, missing, and cycles", () => {
  const rows = [
    { id: a, blockedBy: [] as string[] },
    { id: b, blockedBy: [] as string[] },
    { id: c, blockedBy: [] as string[] },
  ];
  assert.throws(() => assertValidBlockedBy(rows, a, [a]));
  assert.throws(() => assertValidBlockedBy(rows, a, [missing]));

  // a ← b ← c ← a
  assertValidBlockedBy(rows, b, [a]);
  const afterB = [
    { id: a, blockedBy: [] },
    { id: b, blockedBy: [a] },
    { id: c, blockedBy: [] },
  ];
  assertValidBlockedBy(afterB, c, [b]);
  const afterC = [
    { id: a, blockedBy: [] },
    { id: b, blockedBy: [a] },
    { id: c, blockedBy: [b] },
  ];
  assert.throws(() => assertValidBlockedBy(afterC, a, [c]));
});

test("depGraphHasCycle detects loops", () => {
  const rows = [
    { id: a, blockedBy: [c] },
    { id: b, blockedBy: [a] },
    { id: c, blockedBy: [b] },
  ];
  assert.equal(depGraphHasCycle(buildDepAdjacency(rows)), true);
  const acyclic = [
    { id: a, blockedBy: [] },
    { id: b, blockedBy: [a] },
    { id: c, blockedBy: [b] },
  ];
  assert.equal(depGraphHasCycle(buildDepAdjacency(acyclic)), false);
});

test("pruneDeletedFromBlockedBy drops doomed ids", () => {
  assert.deepEqual(
    pruneDeletedFromBlockedBy([a, b, c], new Set([b])),
    [a, c],
  );
});
