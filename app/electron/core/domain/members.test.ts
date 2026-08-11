import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { isValidEntityId } from "../identity/dir-id.js";
import { scanStrays } from "../workspace/doctor.js";
import { parseMemberLinks, memberLinkSyntax } from "../identity/links.js";
import { writeLocalConfig } from "../workspace/local-config.js";
import {
  backfillMemberRefs,
  createMember,
  ensureMembers,
  getMember,
  getMemberSnapshot,
  setMemberAvatar,
  updateMember,
} from "./members.js";
import { scaffoldWorkspace } from "../workspace/scaffold-workspace.js";
import { createIssue, createProject, getIssue, getProject } from "./store.js";
import { createWikiNode, getWikiNode } from "./wiki.js";

async function withTempWorkspace(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-members-"));
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-ud-"));
  const prev = process.env.LOCAL_PM_USER_DATA;
  process.env.LOCAL_PM_USER_DATA = userData;
  try {
    scaffoldWorkspace(root, { title: "Members Test" });
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

test("scaffold seeds members/", async () => {
  await withTempWorkspace(async (root) => {
    assert.equal(fs.existsSync(path.join(root, "members")), true);
    const snap = await ensureMembers(root);
    assert.deepEqual(snap.nodes, []);
    assert.deepEqual(snap.invalidNames, []);
  });
});

test("createMember allocates nanoid and defaults involved", async () => {
  await withTempWorkspace(async (root) => {
    const m = await createMember(root, { title: "Alice" });
    assert.equal(isValidEntityId(m.id), true);
    assert.equal(m.title, "Alice");
    assert.equal(m.membership, "involved");
    assert.equal(m.avatarPath, null);
    assert.match(m.created, /Z$/);
    assert.equal(m.created, m.updated);
    assert.equal(
      fs.existsSync(path.join(root, "members", m.id, "props.ts")),
      true,
    );
    const snap = await getMemberSnapshot(root);
    assert.equal(snap.nodes.length, 1);
    assert.equal(snap.nodes[0]!.id, m.id);
  });
});

test("updateMember can set left; title rename keeps id", async () => {
  await withTempWorkspace(async (root) => {
    const m = await createMember(root, { title: "Bob" });
    const left = await updateMember(root, m.id, { membership: "left" });
    assert.equal(left.membership, "left");
    assert.notEqual(left.updated, m.updated);
    const renamed = await updateMember(root, m.id, { title: "Robert" });
    assert.equal(renamed.id, m.id);
    assert.equal(renamed.title, "Robert");
  });
});

test("setMemberAvatar writes avatar.jpeg", async () => {
  await withTempWorkspace(async (root) => {
    const m = await createMember(root, { title: "Carol" });
    const src = path.join(root, "face.jpeg");
    fs.writeFileSync(src, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const dest = setMemberAvatar(root, m.id, src);
    assert.equal(path.basename(dest), "avatar.jpeg");
    const again = await getMember(root, m.id);
    assert.equal(again.avatarPath, dest);
  });
});

test("createIssue stamps createdBy from local me; assignee patchable", async () => {
  await withTempWorkspace(async (root) => {
    const me = await createMember(root, { title: "Me" });
    writeLocalConfig(root, { me: me.id });
    const project = await createProject(root, { title: "P" });
    assert.equal(project.createdBy, me.id);
    const issue = await createIssue(root, {
      projectId: project.id,
      parentIssueId: null,
      title: "I",
    });
    assert.equal(issue.createdBy, me.id);
    assert.equal(issue.assignee, null);
    const assigned = await getIssue(
      root,
      project.id,
      (
        await createIssue(root, {
          projectId: project.id,
          parentIssueId: null,
          title: "J",
        })
      ).id,
    );
    const patched = await (
      await import("./store.js")
    ).updateIssue(root, project.id, assigned.id, { assignee: me.id });
    assert.equal(patched.assignee, me.id);
    // createdBy not patchable via fields
    const propsPath = path.join(patched.path, "props.ts");
    const before = fs.readFileSync(propsPath, "utf8");
    assert.match(before, /createdBy/);
  });
});

test("doctor flags assignee-left-member and broken refs", async () => {
  await withTempWorkspace(async (root) => {
    const gone = await createMember(root, { title: "Gone" });
    await updateMember(root, gone.id, { membership: "left" });
    const project = await createProject(root, { title: "P" });
    const issue = await createIssue(root, {
      projectId: project.id,
      parentIssueId: null,
      title: "Open",
    });
    const { updateIssue } = await import("./store.js");
    await updateIssue(root, project.id, issue.id, {
      status: "in-progress",
      assignee: gone.id,
    });
    const report = scanStrays(root);
    assert.ok(
      report.warnings.some((w) => w.kind === "assignee-left-member"),
      JSON.stringify(report.warnings),
    );

    const fake = "aaaaaaaaaaaaaaaaaaaaa";
    await updateIssue(root, project.id, issue.id, { assignee: fake });
    const report2 = scanStrays(root);
    assert.ok(
      report2.warnings.some((w) => w.kind === "member-broken-ref"),
      JSON.stringify(report2.warnings),
    );
  });
});

test("backfillMemberRefs sets refs without bumping updated", async () => {
  await withTempWorkspace(async (root) => {
    const actor = await createMember(root, { title: "Actor" });
    const project = await createProject(root, { title: "P" });
    const issue = await createIssue(root, {
      projectId: project.id,
      parentIssueId: null,
      title: "I",
    });
    const wiki = await createWikiNode(root, { title: "W" });
    const issueUpdated = issue.updated;
    const projectUpdated = project.updated;
    const wikiUpdated = wiki.updated;

    const counts = await backfillMemberRefs(root, {
      createdBy: actor.id,
      assignee: actor.id,
    });
    assert.equal(counts.projects, 1);
    assert.equal(counts.issues, 1);
    assert.equal(counts.wikiNodes, 1);

    const p2 = await getProject(root, project.id);
    const i2 = await getIssue(root, project.id, issue.id);
    const w2 = await getWikiNode(root, wiki.id);
    assert.equal(p2.createdBy, actor.id);
    assert.equal(i2.createdBy, actor.id);
    assert.equal(i2.assignee, actor.id);
    assert.equal(w2.createdBy, actor.id);
    assert.equal(p2.updated, projectUpdated);
    assert.equal(i2.updated, issueUpdated);
    assert.equal(w2.updated, wikiUpdated);
  });
});

test("member link syntax", () => {
  const id = "V1StGXR8_Z5jdHi6B-myT";
  assert.equal(memberLinkSyntax(id), `@member-${id}`);
  const parsed = parseMemberLinks(`See @member-${id} please`);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.memberId, id);
});

test("updateMember CAS rejects stale expected baseline for body", async () => {
  await withTempWorkspace(async (root) => {
    const m = await createMember(root, { title: "CAS" });
    const { pickMemberEditable, StaleWriteError } = await import("../sync/detail-diff.js");
    const expected = pickMemberEditable(m);
    await updateMember(root, m.id, { body: "external\n" });
    await assert.rejects(
      () =>
        updateMember(root, m.id, { body: "mine\n" }, { expected }),
      (err: unknown) => err instanceof StaleWriteError,
    );
  });
});

test("updateMember CAS allows write when expected matches disk", async () => {
  await withTempWorkspace(async (root) => {
    const m = await createMember(root, { title: "CAS ok" });
    const { pickMemberEditable } = await import("../sync/detail-diff.js");
    const expected = pickMemberEditable(m);
    const next = await updateMember(
      root,
      m.id,
      { body: "ok\n" },
      { expected },
    );
    assert.equal(next.body, "ok\n");
  });
});
