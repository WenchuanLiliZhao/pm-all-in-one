import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { scaffoldWorkspace } from "./scaffold-workspace.js";
import {
  ensureWorkspaceMeta,
  readWorkspaceMeta,
  updateWorkspaceMeta,
  workspacePropsPath,
  workspaceReadmePath,
} from "./workspace-meta.js";

async function withTempRoot(
  body: (root: string) => Promise<void>,
): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-ws-meta-"));
  try {
    await body(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("scaffold seeds workspace.ts + README.md", async () => {
  await withTempRoot(async (parent) => {
    const root = path.join(parent, "my-ws");
    scaffoldWorkspace(root);
    assert.equal(fs.existsSync(workspacePropsPath(root)), true);
    assert.equal(fs.existsSync(workspaceReadmePath(root)), true);
    assert.equal(fs.existsSync(path.join(root, "AGENTS.md")), true);
    const meta = await readWorkspaceMeta(root);
    assert.equal(meta.title, "my-ws");
    assert.match(meta.createdDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(meta.description, "");
  });
});

test("scaffold uses explicit title independent of folder name", async () => {
  await withTempRoot(async (parent) => {
    const root = path.join(parent, "my-workspace");
    scaffoldWorkspace(root, { title: "My Workspace" });
    const meta = await readWorkspaceMeta(root);
    assert.equal(meta.title, "My Workspace");
  });
});

test("ensureWorkspaceMeta seeds missing files on an existing workspace", async () => {
  await withTempRoot(async (parent) => {
    const root = path.join(parent, "legacy");
    fs.mkdirSync(path.join(root, ".pm"), { recursive: true });
    fs.mkdirSync(path.join(root, "issue-hierarchy"), { recursive: true });
    const meta = await ensureWorkspaceMeta(root);
    assert.equal(meta.title, "legacy");
    assert.equal(fs.existsSync(workspacePropsPath(root)), true);
    assert.equal(fs.existsSync(workspaceReadmePath(root)), true);
  });
});

test("updateWorkspaceMeta rewrites props and README", async () => {
  await withTempRoot(async (parent) => {
    const root = path.join(parent, "edit-me");
    scaffoldWorkspace(root);
    const before = await readWorkspaceMeta(root);
    const next = await updateWorkspaceMeta(root, {
      title: "Renamed",
      description: "# Hello\n",
    });
    assert.equal(next.title, "Renamed");
    assert.equal(next.createdDate, before.createdDate);
    assert.equal(next.description, "# Hello\n");
    assert.equal(
      fs.readFileSync(workspaceReadmePath(root), "utf8"),
      "# Hello\n",
    );
  });
});

test("updateWorkspaceMeta ignores attempts to change createdDate", async () => {
  await withTempRoot(async (parent) => {
    const root = path.join(parent, "immutable-date");
    scaffoldWorkspace(root);
    const before = await readWorkspaceMeta(root);
    const next = await updateWorkspaceMeta(root, {
      title: before.title,
      // Cast: API must ignore even if a caller smuggles the field.
      ...({ createdDate: "1999-01-01" } as object),
    });
    assert.equal(next.createdDate, before.createdDate);
    assert.notEqual(next.createdDate, "1999-01-01");
  });
});
