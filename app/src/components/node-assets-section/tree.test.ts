import assert from "node:assert/strict";
import test from "node:test";

import { buildAssetTree } from "./tree.ts";

test("buildAssetTree keeps empty folders", () => {
  const tree = buildAssetTree(["docs/", "docs/a.pdf", "docs/hollow/", "vacant/"]);
  assert.deepEqual(
    tree.map((n) => [n.name, n.kind, n.children.map((c) => c.name)]),
    [
      ["docs", "dir", ["hollow", "a.pdf"]],
      ["vacant", "dir", []],
    ],
  );
  const docs = tree[0]!;
  const hollow = docs.children.find((c) => c.name === "hollow");
  assert.equal(hollow?.kind, "dir");
  assert.deepEqual(hollow?.children, []);
});
