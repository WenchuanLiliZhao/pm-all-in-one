import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createProject } from "./core/domain/store.js";
import { issueRefKey } from "./core/identity/types.js";
import { applyViewOrder } from "./core/views/view-order-apply.js";
import {
  ISSUE_TREE_VIEW_KEYS,
  type ViewOrdersFile,
} from "./core/views/view-orders.js";
import { buildTree } from "./core/workspace/rebuild-index.js";
import { scaffoldWorkspace } from "./core/workspace/scaffold-workspace.js";

const CLI_JS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "cli.js",
);

async function withTempWorkspace(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-cli-ivo-"));
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-ud-"));
  const prev = process.env.LOCAL_PM_USER_DATA;
  process.env.LOCAL_PM_USER_DATA = userData;
  try {
    scaffoldWorkspace(root, { title: "CLI view-orders" });
    await fn(root);
  } finally {
    if (prev === undefined) {
      delete process.env.LOCAL_PM_USER_DATA;
    } else {
      process.env.LOCAL_PM_USER_DATA = prev;
    }
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(userData, { recursive: true, force: true });
  }
}

function runIssue(
  root: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    [CLI_JS, "issue", ...args, "--workspace", root],
    {
      encoding: "utf8",
      env: process.env,
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function createJson(
  root: string,
  args: string[],
): { id: string; projectId: string; title: string; parentId: string | null } {
  const result = runIssue(root, [...args, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout) as {
    id: string;
    projectId: string;
    title: string;
    parentId: string | null;
  };
}

function readOrders(root: string): ViewOrdersFile {
  return JSON.parse(
    fs.readFileSync(path.join(root, ".pm", "view-orders.json"), "utf8"),
  ) as ViewOrdersFile;
}

function parentList(
  orders: ViewOrdersFile,
  view: string,
  parentKey: string,
): string[] {
  return orders[view]?.children[parentKey] ?? [];
}

test("cli issue create appends create-order to roadmap and table, not title-sort", async () => {
  await withTempWorkspace(async (root) => {
    const project = await createProject(root, { title: "P" });
    const epic = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      "root",
      "--title",
      "Epic",
    ]);
    const task = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      epic.id,
      "--title",
      "Task",
    ]);
    const zzz = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      task.id,
      "--title",
      "Zzz",
    ]);
    const aaa = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      task.id,
      "--title",
      "Aaa",
    ]);
    const mmm = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      task.id,
      "--title",
      "Mmm",
    ]);
    const parentKey = issueRefKey(project.id, task.id);
    const createOrder = [
      issueRefKey(project.id, zzz.id),
      issueRefKey(project.id, aaa.id),
      issueRefKey(project.id, mmm.id),
    ];
    const orders = readOrders(root);
    for (const view of ISSUE_TREE_VIEW_KEYS) {
      assert.deepEqual(parentList(orders, view, parentKey), createOrder);
    }

    const tree = await buildTree(root);
    const titleSort = tree.children[parentKey] ?? [];
    assert.deepEqual(
      titleSort.map((k) => tree.byId[k]?.title),
      ["Aaa", "Mmm", "Zzz"],
    );
    const applied = applyViewOrder(tree, orders.roadmap);
    assert.deepEqual(applied.children[parentKey], createOrder);
  });
});

test("cli issue move reparents the key in every stored view JSON", async () => {
  await withTempWorkspace(async (root) => {
    const project = await createProject(root, { title: "P" });
    const epic = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      "root",
      "--title",
      "Epic",
    ]);
    const task1 = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      epic.id,
      "--title",
      "Task One",
    ]);
    const task2 = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      epic.id,
      "--title",
      "Task Two",
    ]);
    const zzz = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      task1.id,
      "--title",
      "Zzz",
    ]);
    createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      task1.id,
      "--title",
      "Aaa",
    ]);
    const moved = runIssue(root, [
      "move",
      "--project",
      project.id,
      "--issue",
      zzz.id,
      "--parent",
      task2.id,
    ]);
    assert.equal(moved.status, 0, moved.stderr);

    const task1Key = issueRefKey(project.id, task1.id);
    const task2Key = issueRefKey(project.id, task2.id);
    const zzzKey = issueRefKey(project.id, zzz.id);
    const orders = readOrders(root);
    for (const view of ISSUE_TREE_VIEW_KEYS) {
      assert.equal(parentList(orders, view, task1Key).includes(zzzKey), false);
      assert.deepEqual(parentList(orders, view, task2Key), [zzzKey]);
    }
  });
});

test("cli issue delete prunes the key from roadmap and table", async () => {
  await withTempWorkspace(async (root) => {
    const project = await createProject(root, { title: "P" });
    const epic = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      "root",
      "--title",
      "Epic",
    ]);
    const task = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      epic.id,
      "--title",
      "Task",
    ]);
    const keep = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      task.id,
      "--title",
      "Keep",
    ]);
    const drop = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      task.id,
      "--title",
      "Drop",
    ]);
    const deleted = runIssue(root, [
      "delete",
      "--project",
      project.id,
      "--issue",
      drop.id,
    ]);
    assert.equal(deleted.status, 0, deleted.stderr);

    const parentKey = issueRefKey(project.id, task.id);
    const keepKey = issueRefKey(project.id, keep.id);
    const dropKey = issueRefKey(project.id, drop.id);
    const orders = readOrders(root);
    for (const view of ISSUE_TREE_VIEW_KEYS) {
      const list = parentList(orders, view, parentKey);
      assert.deepEqual(list, [keepKey]);
      assert.equal(list.includes(dropKey), false);
    }
  });
});

test("issue list prints parentId ancestry with status and drops leftover tree.md", async () => {
  await withTempWorkspace(async (root) => {
    const leftover = path.join(root, ".pm", "tree.md");
    fs.writeFileSync(leftover, "stale leftover map\n", "utf8");
    const project = await createProject(root, { title: "P" });
    const epic = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      "root",
      "--title",
      "Epic",
    ]);
    const task = createJson(root, [
      "create",
      "--project",
      project.id,
      "--parent",
      epic.id,
      "--title",
      "Task",
    ]);
    const listed = runIssue(root, ["list", "--project", project.id]);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(
      listed.stdout,
      new RegExp(`^@issue-${project.id}\\tproject\\tP$`, "m"),
    );
    assert.match(
      listed.stdout,
      new RegExp(
        `^  @issue-${project.id}::${epic.id}\\tepic\\tdraft\\tEpic$`,
        "m",
      ),
    );
    assert.match(
      listed.stdout,
      new RegExp(
        `^    @issue-${project.id}::${task.id}\\ttask\\tdraft\\tTask$`,
        "m",
      ),
    );
    assert.equal(fs.existsSync(leftover), false);
  });
});
