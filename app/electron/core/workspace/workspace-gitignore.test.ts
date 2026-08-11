import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureLocalJsonGitignore } from "./workspace-gitignore.js";

const sourceTemplate = path.resolve(process.cwd(), "electron/workspace-template");

function withSourceTemplate<T>(fn: () => T): T {
  const prev = process.env.LOCAL_PM_WORKSPACE_TEMPLATE;
  process.env.LOCAL_PM_WORKSPACE_TEMPLATE = sourceTemplate;
  try {
    return fn();
  } finally {
    if (prev === undefined) {
      delete process.env.LOCAL_PM_WORKSPACE_TEMPLATE;
    } else {
      process.env.LOCAL_PM_WORKSPACE_TEMPLATE = prev;
    }
  }
}

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pm-gitignore-"));
}

test("ensureLocalJsonGitignore copies template when .gitignore missing", () => {
  withSourceTemplate(() => {
    const root = tmpRoot();
    try {
      ensureLocalJsonGitignore(root);
      const body = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
      assert.ok(body.includes(".pm/local.json"));
      assert.ok(body.includes(".pm/local.md"));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

test("ensureLocalJsonGitignore appends missing local.md when only local.json present", () => {
  withSourceTemplate(() => {
    const root = tmpRoot();
    try {
      fs.writeFileSync(
        path.join(root, ".gitignore"),
        ".pm/index.json\n.pm/local.json\n",
        "utf8",
      );
      ensureLocalJsonGitignore(root);
      const body = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
      assert.ok(body.includes(".pm/local.json"));
      assert.ok(body.includes(".pm/local.md"));
      assert.equal(
        body.split(/\r?\n/).filter((l) => l.trim() === ".pm/local.json").length,
        1,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

test("ensureLocalJsonGitignore is a no-op when both lines present", () => {
  withSourceTemplate(() => {
    const root = tmpRoot();
    try {
      const before = ".pm/local.json\n.pm/local.md\n";
      fs.writeFileSync(path.join(root, ".gitignore"), before, "utf8");
      ensureLocalJsonGitignore(root);
      assert.equal(fs.readFileSync(path.join(root, ".gitignore"), "utf8"), before);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
