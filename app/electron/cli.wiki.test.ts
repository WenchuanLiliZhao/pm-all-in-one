import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { isValidEntityId } from "./core/identity/dir-id.js";
import { wikiLinkSyntax } from "./core/identity/links.js";
import { requireReadableSidebar } from "./core/domain/wiki.js";
import { scaffoldWorkspace } from "./core/workspace/scaffold-workspace.js";

const CLI_JS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "cli.js",
);

async function withTempWorkspace(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-cli-wiki-"));
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-ud-"));
  const prev = process.env.LOCAL_PM_USER_DATA;
  process.env.LOCAL_PM_USER_DATA = userData;
  try {
    scaffoldWorkspace(root, { title: "CLI Wiki Test" });
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

function runWiki(
  root: string,
  sub: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    [CLI_JS, "wiki", sub, "--workspace", root, ...args],
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

function runWikiCreate(
  root: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  return runWiki(root, "create", args);
}

test("cli wiki create allocates id, writes disk, and enters Contents root", async () => {
  await withTempWorkspace(async (root) => {
    const result = runWikiCreate(root, [
      "--title",
      "CLI create test",
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as {
      id: string;
      title: string;
      ref: string;
      relPath: string;
    };
    assert.equal(isValidEntityId(payload.id), true);
    assert.equal(payload.title, "CLI create test");
    assert.equal(payload.ref, wikiLinkSyntax(payload.id));
    assert.equal(
      fs.existsSync(path.join(root, "wiki", payload.id, "props.ts")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(root, "wiki", payload.id, "README.md")),
      true,
    );
    const sidebar = await requireReadableSidebar(root);
    assert.equal(sidebar.length, 1);
    assert.equal(sidebar[0]?.type, "ref");
    if (sidebar[0]?.type === "ref") {
      assert.equal(sidebar[0].id, payload.id);
      assert.equal(sidebar[0].label, "CLI create test");
    }
  });
});

test("cli wiki create --parent nests under Contents parent", async () => {
  await withTempWorkspace(async (root) => {
    const parentResult = runWikiCreate(root, [
      "--title",
      "Parent",
      "--json",
    ]);
    assert.equal(parentResult.status, 0, parentResult.stderr);
    const parent = JSON.parse(parentResult.stdout) as { id: string };

    const childResult = runWikiCreate(root, [
      "--title",
      "Child",
      "--parent",
      parent.id,
      "--json",
    ]);
    assert.equal(childResult.status, 0, childResult.stderr);
    const child = JSON.parse(childResult.stdout) as {
      id: string;
      title: string;
      ref: string;
    };
    assert.equal(isValidEntityId(child.id), true);
    assert.equal(child.title, "Child");
    assert.equal(child.ref, wikiLinkSyntax(child.id));

    const sidebar = await requireReadableSidebar(root);
    assert.equal(sidebar.length, 1);
    assert.equal(sidebar[0]?.type, "ref");
    if (sidebar[0]?.type === "ref") {
      assert.equal(sidebar[0].id, parent.id);
      assert.equal(sidebar[0].children?.length, 1);
      assert.equal(sidebar[0].children?.[0]?.type, "ref");
      if (sidebar[0].children?.[0]?.type === "ref") {
        assert.equal(sidebar[0].children[0].id, child.id);
      }
    }
  });
});

test("cli wiki delete removes disk + Contents; promotes children", async () => {
  await withTempWorkspace(async (root) => {
    const parentResult = runWikiCreate(root, [
      "--title",
      "Parent",
      "--json",
    ]);
    assert.equal(parentResult.status, 0, parentResult.stderr);
    const parent = JSON.parse(parentResult.stdout) as { id: string };

    const childResult = runWikiCreate(root, [
      "--title",
      "Child",
      "--parent",
      parent.id,
      "--json",
    ]);
    assert.equal(childResult.status, 0, childResult.stderr);
    const child = JSON.parse(childResult.stdout) as { id: string };

    const del = runWiki(root, "delete", ["--id", parent.id, "--json"]);
    assert.equal(del.status, 0, del.stderr);
    const payload = JSON.parse(del.stdout) as {
      ok: boolean;
      id: string;
      ref: string;
      liftedChildren: number;
    };
    assert.equal(payload.ok, true);
    assert.equal(payload.id, parent.id);
    assert.equal(payload.ref, wikiLinkSyntax(parent.id));
    assert.equal(payload.liftedChildren, 1);
    assert.equal(
      fs.existsSync(path.join(root, "wiki", parent.id)),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(root, "wiki", child.id, "props.ts")),
      true,
    );
    const sidebar = await requireReadableSidebar(root);
    assert.equal(sidebar.length, 1);
    assert.equal(sidebar[0]?.type, "ref");
    if (sidebar[0]?.type === "ref") {
      assert.equal(sidebar[0].id, child.id);
    }
  });
});
