import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyViewOrder,
  materializeSiblingOrder,
  reorderSiblingInOrder,
  reparentInOrder,
  emptyViewOrder,
  type ViewOrder,
} from "./view-order-apply.js";
import type { IssueTree } from "./types.js";

const P1 = "aaaaaaaaaaaaaaaaaaaa1";
const P2 = "aaaaaaaaaaaaaaaaaaaa2";
const I1 = "bbbbbbbbbbbbbbbbbbb01";
const I2 = "bbbbbbbbbbbbbbbbbbb02";
const I3 = "bbbbbbbbbbbbbbbbbbb03";
const STALE_P = "cccccccccccccccccccc9";
const STALE_I = "ddddddddddddddddddd99";

function sampleTree(): IssueTree {
  return {
    byId: {
      [P1]: { kind: "project", key: P1, projectId: P1, title: "Alpha" },
      [P2]: { kind: "project", key: P2, projectId: P2, title: "Beta" },
      [`${P1}::${I1}`]: {
        kind: "issue",
        key: `${P1}::${I1}`,
        projectId: P1,
        issueId: I1,
        level: "epic",
        title: "E1",
      },
      [`${P1}::${I2}`]: {
        kind: "issue",
        key: `${P1}::${I2}`,
        projectId: P1,
        issueId: I2,
        level: "epic",
        title: "E2",
      },
      [`${P1}::${I3}`]: {
        kind: "issue",
        key: `${P1}::${I3}`,
        projectId: P1,
        issueId: I3,
        level: "task",
        title: "T1",
      },
    },
    roots: [P1, P2],
    children: {
      [P1]: [`${P1}::${I1}`, `${P1}::${I2}`],
      [`${P1}::${I1}`]: [`${P1}::${I3}`],
      [`${P1}::${I2}`]: [],
      [P2]: [],
      [`${P1}::${I3}`]: [],
    },
  };
}

test("empty order leaves the title-sorted tree unchanged", () => {
  const tree = sampleTree();
  const applied = applyViewOrder(tree, emptyViewOrder());
  assert.deepEqual(applied.roots, tree.roots);
  assert.deepEqual(applied.children[P1], [`${P1}::${I1}`, `${P1}::${I2}`]);
});

test("preferred order wins; missing siblings append in tree order", () => {
  const tree = sampleTree();
  const order: ViewOrder = {
    roots: [P2],
    children: { [P1]: [`${P1}::${I2}`] },
  };
  const applied = applyViewOrder(tree, order);
  assert.deepEqual(applied.roots, [P2, P1]);
  assert.deepEqual(applied.children[P1], [`${P1}::${I2}`, `${P1}::${I1}`]);
});

test("stale keys in order are ignored", () => {
  const tree = sampleTree();
  const order: ViewOrder = {
    roots: [STALE_P, P1, P2],
    children: { [P1]: [`${P1}::${STALE_I}`, `${P1}::${I1}`, `${P1}::${I2}`] },
  };
  const applied = applyViewOrder(tree, order);
  assert.deepEqual(applied.roots, [P1, P2]);
  assert.deepEqual(applied.children[P1], [`${P1}::${I1}`, `${P1}::${I2}`]);
});

test("reorderSiblingInOrder swaps within a parent list", () => {
  const order: ViewOrder = {
    roots: [P1, P2],
    children: { [P1]: [`${P1}::${I1}`, `${P1}::${I2}`] },
  };
  const next = reorderSiblingInOrder(order, P1, `${P1}::${I2}`, `${P1}::${I1}`);
  assert.deepEqual(next.children[P1], [`${P1}::${I2}`, `${P1}::${I1}`]);
  assert.deepEqual(next.roots, [P1, P2]);
});

test("reparentInOrder moves a key between parent buckets", () => {
  const order: ViewOrder = {
    roots: [P1],
    children: {
      [P1]: [`${P1}::${I1}`, `${P1}::${I2}`],
      [`${P1}::${I1}`]: [`${P1}::${I3}`],
      [`${P1}::${I2}`]: [],
    },
  };
  const next = reparentInOrder(
    order,
    `${P1}::${I3}`,
    `${P1}::${I1}`,
    `${P1}::${I2}`,
    null,
  );
  assert.deepEqual(next.children[`${P1}::${I1}`] ?? [], []);
  assert.deepEqual(next.children[`${P1}::${I2}`], [`${P1}::${I3}`]);
});

test("materializeSiblingOrder fills sparse roots from the live tree", () => {
  const tree = sampleTree();
  const order: ViewOrder = { roots: [P2], children: {} };
  const next = materializeSiblingOrder(tree, order, null);
  assert.deepEqual(next.roots, [P2, P1]);
});
