import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { GITKEEP_NAME, ensureDirWithGitkeep } from "../identity/ids.js";
import { scaffoldWorkspace } from "./scaffold-workspace.js";
import {
  customSkillsDir,
  ensureStructuralGitkeeps,
} from "./workspace-gitkeep.js";

const sourceTemplate = path.resolve(
  process.cwd(),
  "electron/workspace-template",
);
const sourceProjectTemplate = path.resolve(
  process.cwd(),
  "electron/project-template",
);

function withSourceTemplates<T>(fn: () => T): T {
  const prevWs = process.env.LOCAL_PM_WORKSPACE_TEMPLATE;
  const prevProj = process.env.LOCAL_PM_PROJECT_TEMPLATE;
  process.env.LOCAL_PM_WORKSPACE_TEMPLATE = sourceTemplate;
  process.env.LOCAL_PM_PROJECT_TEMPLATE = sourceProjectTemplate;
  try {
    return fn();
  } finally {
    if (prevWs === undefined) {
      delete process.env.LOCAL_PM_WORKSPACE_TEMPLATE;
    } else {
      process.env.LOCAL_PM_WORKSPACE_TEMPLATE = prevWs;
    }
    if (prevProj === undefined) {
      delete process.env.LOCAL_PM_PROJECT_TEMPLATE;
    } else {
      process.env.LOCAL_PM_PROJECT_TEMPLATE = prevProj;
    }
  }
}

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pm-gitkeep-"));
}

test("ensureDirWithGitkeep creates dir and placeholder", () => {
  const root = tmpRoot();
  try {
    const dir = path.join(root, "empty");
    ensureDirWithGitkeep(dir);
    assert.ok(fs.statSync(dir).isDirectory());
    assert.ok(fs.existsSync(path.join(dir, GITKEEP_NAME)));
    ensureDirWithGitkeep(dir);
    assert.equal(fs.readFileSync(path.join(dir, GITKEEP_NAME), "utf8"), "");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ensureStructuralGitkeeps repairs missing required dirs", () => {
  const root = tmpRoot();
  try {
    ensureStructuralGitkeeps(root);
    for (const rel of [
      "members",
      "handoffs",
      "issue-hierarchy",
      path.join(".agents", "skills", "custom"),
    ]) {
      const keep = path.join(root, rel, GITKEEP_NAME);
      assert.ok(fs.existsSync(keep), keep);
    }
    assert.equal(customSkillsDir(root), path.join(root, ".agents", "skills", "custom"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ensureStructuralGitkeeps keeps .gitkeep when the dir already has children", () => {
  const root = tmpRoot();
  try {
    const members = path.join(root, "members");
    fs.mkdirSync(path.join(members, "V1StGXR8_Z5jdHi6B-myT"), { recursive: true });
    ensureStructuralGitkeeps(root);
    assert.ok(fs.existsSync(path.join(members, GITKEEP_NAME)));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scaffold copies .gitkeep into required empty dirs", () => {
  withSourceTemplates(() => {
    const root = tmpRoot();
    try {
      scaffoldWorkspace(root, { title: "Gitkeep scaffold" });
      assert.ok(fs.existsSync(path.join(root, "members", GITKEEP_NAME)));
      assert.ok(fs.existsSync(path.join(root, "handoffs", GITKEEP_NAME)));
      assert.ok(fs.existsSync(path.join(root, "issue-hierarchy", GITKEEP_NAME)));
      assert.ok(fs.existsSync(path.join(customSkillsDir(root), GITKEEP_NAME)));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
