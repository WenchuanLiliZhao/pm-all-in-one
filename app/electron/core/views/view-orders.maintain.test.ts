import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  appendIssueToStoredViewOrders,
  ISSUE_TREE_VIEW_KEYS,
  pruneIssueKeysFromStoredViewOrders,
  reparentIssueInStoredViewOrders,
  viewOrderParentKey,
  type ViewOrdersFile,
} from "./view-orders.js";

const P = "aaaaaaaaaaaaaaaaaaaa1";
const TASK = `${P}::bbbbbbbbbbbbbbbbbbb01`;
const OTHER = `${P}::bbbbbbbbbbbbbbbbbbb02`;
const A = `${P}::ccccccccccccccccccc01`;
const B = `${P}::ccccccccccccccccccc02`;
const C = `${P}::ccccccccccccccccccc03`;

function withPmDir(body: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-vo-"));
  try {
    body(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function readOrders(root: string): ViewOrdersFile {
  return JSON.parse(
    fs.readFileSync(path.join(root, ".pm", "view-orders.json"), "utf8"),
  ) as ViewOrdersFile;
}

test("viewOrderParentKey uses project id or issueRefKey", () => {
  assert.equal(viewOrderParentKey(P, null), P);
  assert.equal(viewOrderParentKey(P, "bbbbbbbbbbbbbbbbbbb01"), TASK);
});

test("append seeds roadmap and table and keeps a custom stored view", () => {
  withPmDir((root) => {
    appendIssueToStoredViewOrders(root, TASK, A, [A]);
    const seeded = readOrders(root);
    for (const view of ISSUE_TREE_VIEW_KEYS) {
      assert.deepEqual(seeded[view]?.children[TASK], [A]);
    }
    assert.equal(seeded.home, undefined);

    fs.writeFileSync(
      path.join(root, ".pm", "view-orders.json"),
      `${JSON.stringify(
        {
          ...seeded,
          board: { roots: [], children: { [TASK]: [A] } },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    appendIssueToStoredViewOrders(root, TASK, B, [A, B]);
    const next = readOrders(root);
    for (const view of [...ISSUE_TREE_VIEW_KEYS, "board"]) {
      assert.deepEqual(next[view]?.children[TASK], [A, B]);
    }
  });
});

test("reparent removes from the old list and appends on the new parent", () => {
  withPmDir((root) => {
    appendIssueToStoredViewOrders(root, TASK, A, [A]);
    appendIssueToStoredViewOrders(root, TASK, B, [A, B]);
    reparentIssueInStoredViewOrders(root, B, TASK, OTHER, [B]);
    const next = readOrders(root);
    for (const view of ISSUE_TREE_VIEW_KEYS) {
      assert.deepEqual(next[view]?.children[TASK], [A]);
      assert.deepEqual(next[view]?.children[OTHER], [B]);
    }
  });
});

test("prune drops the key from every stored view", () => {
  withPmDir((root) => {
    appendIssueToStoredViewOrders(root, TASK, A, [A]);
    appendIssueToStoredViewOrders(root, TASK, B, [A, B]);
    appendIssueToStoredViewOrders(root, TASK, C, [A, B, C]);
    pruneIssueKeysFromStoredViewOrders(root, [B]);
    const next = readOrders(root);
    for (const view of ISSUE_TREE_VIEW_KEYS) {
      assert.deepEqual(next[view]?.children[TASK], [A, C]);
    }
  });
});
