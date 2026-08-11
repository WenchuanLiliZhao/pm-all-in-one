import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { countDescendants } from "./delete-cost.js";
import { adoptStray, scanStrays } from "./doctor.js";
import { buildTree, rebuildIndex } from "./index.js";
import { scaffoldWorkspace } from "./scaffold-workspace.js";
import {
  createIssue,
  deleteIssue,
  getIssue,
  getProject,
  issueDirPath,
  listIssues,
  listProjects,
  moveIssue,
  updateIssue,
  updateProject,
} from "./store.js";

const MISSING_PARENT = "zzzzzzzzzzzzzzzzzzz99";

async function withWorkspace(
  body: (root: string, projectId: string) => Promise<void>,
): Promise<void> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-ud-"));
  const prevUd = process.env.LOCAL_PM_USER_DATA;
  process.env.LOCAL_PM_USER_DATA = userData;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-test-"));
  fs.rmSync(root, { recursive: true, force: true });
  scaffoldWorkspace(root, { seedProject: { title: "Test" } });
  const projects = await listProjects(root);
  assert.equal(projects.length, 1);
  const projectId = projects[0]!.id;
  try {
    await body(root, projectId);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(userData, { recursive: true, force: true });
    if (prevUd === undefined) delete process.env.LOCAL_PM_USER_DATA;
    else process.env.LOCAL_PM_USER_DATA = prevUd;
  }
}

/** epic > task > subtask in the seeded project. */
async function seedLadder(root: string, projectId: string) {
  const epic = await createIssue(root, {
    projectId,
    parentIssueId: null,
    title: "Epic A",
  });
  const task = await createIssue(root, {
    projectId,
    parentIssueId: epic.id,
    title: "Task A1",
  });
  const subtask = await createIssue(root, {
    projectId,
    parentIssueId: task.id,
    title: "Subtask A1a",
  });
  return { epic, task, subtask };
}

test("create derives level and parent from the parent issue", async () => {
  await withWorkspace(async (root, projectId) => {
    const { epic, task, subtask } = await seedLadder(root, projectId);
    assert.equal(epic.level, "epic");
    assert.equal(epic.parentId, null);
    assert.equal(epic.status, "draft");
    assert.equal(task.level, "task");
    assert.equal(task.parentId, epic.id);
    assert.equal(task.status, "draft");
    assert.equal(subtask.level, "subtask");
    assert.equal(subtask.parentId, task.id);
    assert.equal(subtask.status, "draft");
    await assert.rejects(
      () => createIssue(root, { projectId, parentIssueId: subtask.id }),
      /under subtask/,
    );
  });
});

test("a reference resolves to a path by arithmetic", async () => {
  await withWorkspace(async (root, projectId) => {
    const { subtask } = await seedLadder(root, projectId);
    assert.equal(
      subtask.path,
      path.join(root, "issue-hierarchy", projectId, String(subtask.id)),
    );
    assert.equal(subtask.path, issueDirPath(root, projectId, subtask.id));
  });
});

test("renaming an issue leaves its path alone", async () => {
  await withWorkspace(async (root, projectId) => {
    const { epic, task } = await seedLadder(root, projectId);
    const renamed = await updateIssue(root, projectId, task.id, {
      title: "Task A1 renamed",
      description: "body",
    });
    assert.equal(renamed.path, task.path);
    assert.equal(renamed.level, "task");
    assert.equal(renamed.parentId, epic.id);
    assert.equal(renamed.description, "body");
  });
});

test("empty title updates are rejected without rewriting props", async () => {
  await withWorkspace(async (root, projectId) => {
    const { epic } = await seedLadder(root, projectId);
    const issueBefore = fs.readFileSync(
      path.join(epic.path, "props.ts"),
      "utf8",
    );
    await assert.rejects(
      () => updateIssue(root, projectId, epic.id, { title: "   " }),
      /Issue title is required/,
    );
    assert.equal(
      fs.readFileSync(path.join(epic.path, "props.ts"), "utf8"),
      issueBefore,
    );

    const projectTs = path.join(root, "issue-hierarchy", projectId, "project.ts");
    const projectBefore = fs.readFileSync(projectTs, "utf8");
    await assert.rejects(
      () => updateProject(root, projectId, { title: "" }),
      /Project title is required/,
    );
    assert.equal(fs.readFileSync(projectTs, "utf8"), projectBefore);
  });
});

test("custom fields cannot overwrite level or parentId", async () => {
  await withWorkspace(async (root, projectId) => {
    const { epic, task } = await seedLadder(root, projectId);
    const patched = await updateIssue(root, projectId, task.id, {
      fields: { level: "epic", parentId: null, status: "done", note: "kept" },
    });
    assert.equal(patched.level, "task");
    assert.equal(patched.parentId, epic.id);
    assert.equal(patched.status, "draft");
    assert.equal(patched.fields.note, "kept");
    assert.equal(patched.fields.status, undefined);
  });
});

test("status patches and missing status defaults to draft", async () => {
  await withWorkspace(async (root, projectId) => {
    const { epic } = await seedLadder(root, projectId);
    const moved = await updateIssue(root, projectId, epic.id, {
      status: "in-progress",
    });
    assert.equal(moved.status, "in-progress");

    const propsPath = path.join(epic.path, "props.ts");
    const raw = fs.readFileSync(propsPath, "utf8");
    fs.writeFileSync(
      propsPath,
      raw.replace(/"status": "in-progress",?\n?/, ""),
      "utf8",
    );
    const reloaded = await getIssue(root, projectId, epic.id);
    assert.equal(reloaded.status, "draft");

    await assert.rejects(
      () =>
        updateIssue(root, projectId, epic.id, {
          status: "not-a-status" as "todo",
        }),
      /Invalid issue status/,
    );
  });
});

test("promoting an issue carries its subtree and moves no directories", async () => {
  await withWorkspace(async (root, projectId) => {
    const { task, subtask } = await seedLadder(root, projectId);
    const promoted = await moveIssue(root, {
      projectId,
      issueId: task.id,
      newParentIssueId: null,
    });
    assert.equal(promoted.level, "epic");
    assert.equal(promoted.parentId, null);
    assert.equal(promoted.path, task.path);

    const after = await listIssues(root);
    assert.equal(after.find((i) => i.id === subtask.id)!.level, "task");
    assert.equal(after.find((i) => i.id === subtask.id)!.path, subtask.path);
    assert.ok(after.every((i) => i.violations.length === 0));
  });
});

test("illegal moves are refused", async () => {
  await withWorkspace(async (root, projectId) => {
    const { epic, task, subtask } = await seedLadder(root, projectId);
    const spare = await createIssue(root, {
      projectId,
      parentIssueId: null,
      title: "Epic B",
    });
    await assert.rejects(
      () =>
        moveIssue(root, {
          projectId,
          issueId: spare.id,
          newParentIssueId: subtask.id,
        }),
      /subtasks cannot have children/,
    );
    await assert.rejects(
      () =>
        moveIssue(root, {
          projectId,
          issueId: task.id,
          newParentIssueId: subtask.id,
        }),
      /own subtree/,
    );
    // epic > task > subtask is already three deep; nesting it would overflow.
    await assert.rejects(
      () =>
        moveIssue(root, {
          projectId,
          issueId: epic.id,
          newParentIssueId: spare.id,
        }),
      /past subtask|exceeds/,
    );
    await assert.rejects(
      () =>
        moveIssue(root, {
          projectId,
          issueId: task.id,
          newParentIssueId: MISSING_PARENT,
        }),
      /Parent not found/,
    );
  });
});

test("a dangling parent is reported and stays reachable", async () => {
  await withWorkspace(async (root, projectId) => {
    const { subtask } = await seedLadder(root, projectId);
    const propsFile = path.join(subtask.path, "props.ts");
    const source = fs.readFileSync(propsFile, "utf8");
    fs.writeFileSync(
      propsFile,
      source.replace(/"parentId": "[^"]+"/, `"parentId": "${MISSING_PARENT}"`),
      "utf8",
    );

    // Reading one issue walks its ancestors, so it catches this on its own.
    const broken = await getIssue(root, projectId, subtask.id);
    assert.deepEqual(
      broken.violations.map((v) => v.kind),
      ["missing-parent"],
    );

    const tree = await buildTree(root);
    assert.equal(tree.byId[`${projectId}::${subtask.id}`]!.hasViolation, true);
    assert.ok((tree.children[projectId] ?? []).includes(`${projectId}::${subtask.id}`));
  });
});

test("a hand-edited level that contradicts its parent is reported", async () => {
  await withWorkspace(async (root, projectId) => {
    const { subtask } = await seedLadder(root, projectId);
    const propsFile = path.join(subtask.path, "props.ts");
    const source = fs.readFileSync(propsFile, "utf8");
    fs.writeFileSync(
      propsFile,
      source.replace('"level": "subtask"', '"level": "epic"'),
      "utf8",
    );
    const broken = await getIssue(root, projectId, subtask.id);
    // The stated level is kept, not quietly rewritten to match placement.
    assert.equal(broken.level, "epic");
    assert.deepEqual(
      broken.violations.map((v) => v.kind),
      ["ladder-break"],
    );
    assert.equal(broken.violations[0]!.expectedLevel, "subtask");
  });
});

test("delete counts its cost from the graph and cascades", async () => {
  await withWorkspace(async (root, projectId) => {
    const { epic, subtask } = await seedLadder(root, projectId);
    assert.deepEqual(countDescendants(await listIssues(root), projectId, epic.id), {
      epic: 0,
      task: 1,
      subtask: 1,
      total: 2,
    });
    await assert.rejects(
      () => deleteIssue(root, projectId, epic.id),
      /has children/,
    );
    await deleteIssue(root, projectId, epic.id, { cascade: true });
    assert.equal((await listIssues(root)).length, 0);

    // Ids are never reused: an old @issue ref must not resolve to a new issue.
    const fresh = await createIssue(root, {
      projectId,
      parentIssueId: null,
      title: "After delete",
    });
    assert.ok(fresh.id !== subtask.id);
  });
});

test("a stray directory is adopted as an epic under its project", async () => {
  await withWorkspace(async (root, projectId) => {
    const strayDir = path.join(root, "issue-hierarchy", projectId, "hand-made");
    fs.mkdirSync(strayDir, { recursive: true });
    assert.deepEqual(
      scanStrays(root).strays.map((s) => s.kind),
      ["invalid-name"],
    );
    const adopted = adoptStray(root, strayDir);
    assert.equal(scanStrays(root).strays.length, 0);
    const issue = await getIssue(root, projectId, adopted.issueId);
    assert.equal(issue.level, "epic");
    assert.equal(issue.parentId, null);
    assert.equal(issue.path, issueDirPath(root, projectId, adopted.issueId));
  });
});

test("rebuilding writes the derived map and the generated types", async () => {
  await withWorkspace(async (root, projectId) => {
    const { subtask } = await seedLadder(root, projectId);
    await rebuildIndex(root);
    const map = fs.readFileSync(path.join(root, ".pm", "tree.md"), "utf8");
    assert.match(map, new RegExp(`## project ${projectId} — Test`));
    assert.match(
      map,
      new RegExp(`@issue-${projectId}::${subtask.id} subtask`),
    );
    assert.ok(
      fs.existsSync(path.join(root, "issue-hierarchy", projectId, "schema.d.ts")),
    );
  });
});

test("rebuilding twice leaves schema.d.ts untouched", async () => {
  await withWorkspace(async (root, projectId) => {
    await seedLadder(root, projectId);
    await rebuildIndex(root);
    const generated = path.join(
      root,
      "issue-hierarchy",
      projectId,
      "schema.d.ts",
    );
    // schema.d.ts sits inside the watched hierarchy: a rewrite with identical
    // content would make the watcher retrigger the rebuild that wrote it.
    const before = fs.statSync(generated).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));
    await rebuildIndex(root);
    assert.equal(fs.statSync(generated).mtimeMs, before);
  });
});

test("create/update stamp created/updated; fields cannot clobber them", async () => {
  await withWorkspace(async (root, projectId) => {
    const project = await getProject(root, projectId);
    assert.match(project.created, /Z$/);
    assert.equal(project.created, project.updated);

    const epic = await createIssue(root, {
      projectId,
      parentIssueId: null,
      title: "Timed",
    });
    assert.match(epic.created, /Z$/);
    assert.equal(epic.created, epic.updated);
    assert.equal(epic.fields.created, undefined);
    assert.equal(epic.fields.updated, undefined);

    const created = epic.created;
    await new Promise((r) => setTimeout(r, 5));
    const patched = await updateIssue(root, projectId, epic.id, {
      description: "body change",
      fields: {
        created: "1999-01-01T00:00:00.000Z",
        updated: "1999-01-01T00:00:00.000Z",
      },
    });
    assert.equal(patched.created, created);
    assert.ok(patched.updated >= created);
    assert.notEqual(patched.updated, "1999-01-01T00:00:00.000Z");
    assert.equal(patched.fields.created, undefined);
    assert.equal(patched.fields.updated, undefined);

    const moved = await moveIssue(root, {
      projectId,
      issueId: epic.id,
      newParentIssueId: null,
    });
    assert.equal(moved.created, created);
    assert.ok(moved.updated >= patched.updated);
  });
});

test("updateIssue CAS rejects stale expected baseline for description", async () => {
  await withWorkspace(async (root, projectId) => {
    const issue = await createIssue(root, {
      projectId,
      parentIssueId: null,
      title: "CAS",
    });
    const { pickIssueEditable, StaleWriteError } = await import("./detail-diff.js");
    const expected = pickIssueEditable(issue);
    await updateIssue(root, projectId, issue.id, {
      description: "external",
    });
    await assert.rejects(
      () =>
        updateIssue(
          root,
          projectId,
          issue.id,
          { description: "mine" },
          { expected },
        ),
      (err: unknown) => err instanceof StaleWriteError,
    );
  });
});

test("updateIssue CAS allows write when expected matches disk", async () => {
  await withWorkspace(async (root, projectId) => {
    const issue = await createIssue(root, {
      projectId,
      parentIssueId: null,
      title: "CAS ok",
    });
    const { pickIssueEditable } = await import("./detail-diff.js");
    const expected = pickIssueEditable(issue);
    const next = await updateIssue(
      root,
      projectId,
      issue.id,
      { title: "CAS ok 2" },
      { expected },
    );
    assert.equal(next.title, "CAS ok 2");
  });
});

test("updateIssue CAS is file-granular: title expected stale does not block description-only when title untouched", async () => {
  await withWorkspace(async (root, projectId) => {
    const issue = await createIssue(root, {
      projectId,
      parentIssueId: null,
      title: "Granular",
    });
    const { pickIssueEditable } = await import("./detail-diff.js");
    const expected = pickIssueEditable(issue);
    // External title change only
    await updateIssue(root, projectId, issue.id, { title: "External title" });
    // Local description write with stale title in expected — ok because patch omits title
    const next = await updateIssue(
      root,
      projectId,
      issue.id,
      { description: "local body" },
      { expected },
    );
    assert.equal(next.description, "local body");
    assert.equal(next.title, "External title");
  });
});

test("blockedBy round-trip, cycle reject, and delete prune", async () => {
  await withWorkspace(async (root, projectId) => {
    const epic = await createIssue(root, {
      projectId,
      parentIssueId: null,
      title: "E",
    });
    const task = await createIssue(root, {
      projectId,
      parentIssueId: epic.id,
      title: "T",
    });
    const subtask = await createIssue(root, {
      projectId,
      parentIssueId: task.id,
      title: "S",
    });
    assert.deepEqual(task.blockedBy, []);

    const updated = await updateIssue(root, projectId, task.id, {
      blockedBy: [subtask.id],
    });
    assert.deepEqual(updated.blockedBy, [subtask.id]);

    const propsText = fs.readFileSync(
      path.join(updated.path, "props.ts"),
      "utf8",
    );
    assert.match(propsText, /blockedBy/);

    await assert.rejects(
      () =>
        updateIssue(root, projectId, subtask.id, {
          blockedBy: [task.id],
        }),
      /cycle/i,
    );

    await assert.rejects(
      () =>
        updateIssue(root, projectId, task.id, {
          blockedBy: [task.id],
        }),
      /itself/i,
    );

    await assert.rejects(
      () =>
        updateIssue(root, projectId, task.id, {
          blockedBy: [MISSING_PARENT],
        }),
      /missing/i,
    );

    await updateIssue(root, projectId, epic.id, {
      blockedBy: [subtask.id],
    });
    await deleteIssue(root, projectId, subtask.id);
    const after = await getIssue(root, projectId, epic.id);
    assert.deepEqual(after.blockedBy, []);
    const taskAfter = await getIssue(root, projectId, task.id);
    assert.deepEqual(taskAfter.blockedBy, []);
  });
});
