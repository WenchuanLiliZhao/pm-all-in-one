import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { ENTITY_ID_LENGTH, isValidEntityId } from "./dir-id.js";
import {
  allocateIssueId,
  allocateMemberId,
  allocateProjectId,
  allocateWikiNodeId,
  hierarchyRoot,
  membersRoot,
  wikiRoot,
} from "./ids.js";
import { scaffoldWorkspace } from "./scaffold-workspace.js";
import { createIssue, createProject, listIssues, listProjects } from "./store.js";
import { createWikiNode } from "./wiki.js";

function withEnvUserData<T>(fn: () => T): T {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-ud-"));
  const prev = process.env.LOCAL_PM_USER_DATA;
  process.env.LOCAL_PM_USER_DATA = userData;
  try {
    return fn();
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
    if (prev === undefined) delete process.env.LOCAL_PM_USER_DATA;
    else process.env.LOCAL_PM_USER_DATA = prev;
  }
}

test("allocateProjectId returns unique nanoid(21) under issue-hierarchy", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-alloc-"));
  try {
    fs.mkdirSync(path.join(root, "issue-hierarchy"), { recursive: true });
    const a = allocateProjectId(root);
    const b = allocateProjectId(root);
    assert.equal(isValidEntityId(a), true);
    assert.equal(isValidEntityId(b), true);
    assert.equal(a.length, ENTITY_ID_LENGTH);
    assert.notEqual(a, b);
    assert.equal(fs.existsSync(path.join(hierarchyRoot(root), a)), false);
    // No counter files
    const pm = path.join(root, ".pm");
    if (fs.existsSync(pm)) {
      for (const name of fs.readdirSync(pm)) {
        assert.equal(name.startsWith("next-"), false);
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("allocateIssueId / allocateWikiNodeId skip existing dirs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-alloc2-"));
  try {
    const projectDir = path.join(root, "issue-hierarchy", "proj");
    fs.mkdirSync(projectDir, { recursive: true });
    const existing = allocateIssueId(projectDir);
    fs.mkdirSync(path.join(projectDir, existing));
    const next = allocateIssueId(projectDir);
    assert.notEqual(next, existing);
    assert.equal(isValidEntityId(next), true);
    assert.equal(fs.existsSync(path.join(projectDir, next)), false);

    const wiki = wikiRoot(root);
    fs.mkdirSync(wiki, { recursive: true });
    const w1 = allocateWikiNodeId(root);
    fs.mkdirSync(path.join(wiki, w1));
    const w2 = allocateWikiNodeId(root);
    assert.notEqual(w1, w2);
    assert.equal(isValidEntityId(w2), true);

    const members = membersRoot(root);
    fs.mkdirSync(members, { recursive: true });
    const m1 = allocateMemberId(root);
    fs.mkdirSync(path.join(members, m1));
    const m2 = allocateMemberId(root);
    assert.notEqual(m1, m2);
    assert.equal(isValidEntityId(m2), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("create project / issue / wiki without handle yields distinct nanoids", async () => {
  await withEnvUserData(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-create-"));
    fs.rmSync(root, { recursive: true, force: true });
    try {
      scaffoldWorkspace(root, {});
      const project = await createProject(root, { title: "P" });
      assert.equal(isValidEntityId(project.id), true);

      const a = await createIssue(root, {
        projectId: project.id,
        parentIssueId: null,
        title: "A",
      });
      const b = await createIssue(root, {
        projectId: project.id,
        parentIssueId: null,
        title: "B",
      });
      assert.equal(isValidEntityId(a.id), true);
      assert.equal(isValidEntityId(b.id), true);
      assert.notEqual(a.id, b.id);

      const wiki = await createWikiNode(root, { title: "W" });
      assert.equal(isValidEntityId(wiki.id), true);

      const ids = new Set([project.id, a.id, b.id, wiki.id]);
      assert.equal(ids.size, 4);

      assert.equal((await listProjects(root)).length, 1);
      assert.equal((await listIssues(root)).length, 2);
      assert.ok(
        !fs.existsSync(path.join(root, ".pm", "handles.json")),
        "no handles.json",
      );
      for (const name of fs.readdirSync(path.join(root, ".pm"))) {
        assert.equal(name.startsWith("next-"), false);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
