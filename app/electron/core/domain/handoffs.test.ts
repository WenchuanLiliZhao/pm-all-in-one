import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { isValidEntityId } from "../identity/dir-id.js";
import { scanStrays } from "../workspace/doctor.js";
import { handoffLinkSyntax, parseHandoffLinks } from "../identity/links.js";
import {
  createHandoff,
  ensureHandoffs,
  getHandoff,
  getHandoffSnapshot,
  updateHandoff,
} from "./handoffs.js";
import { createMember } from "./members.js";
import { scaffoldWorkspace } from "../workspace/scaffold-workspace.js";
import { createProject } from "./store.js";

async function withTempWorkspace(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-handoffs-"));
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-ud-"));
  const prev = process.env.LOCAL_PM_USER_DATA;
  process.env.LOCAL_PM_USER_DATA = userData;
  try {
    scaffoldWorkspace(root, { title: "Handoffs Test" });
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

test("scaffold seeds handoffs/", async () => {
  await withTempWorkspace(async (root) => {
    assert.equal(fs.existsSync(path.join(root, "handoffs")), true);
    const snap = await ensureHandoffs(root);
    assert.deepEqual(snap.nodes, []);
    assert.deepEqual(snap.invalidNames, []);
  });
});

test("createHandoff allocates id; list sorts newest first", async () => {
  await withTempWorkspace(async (root) => {
    const project = await createProject(root, { title: "P" });
    const from = await createMember(root, { title: "Alice" });
    const to = await createMember(root, { title: "Bob" });
    const older = await createHandoff(root, {
      title: "First",
      from: from.id,
      to: to.id,
      relatedProject: project.id,
      body: "See @issue-V1StGXR8_Z5jdHi6B-myT::abcDEF0123456789xyz01",
    });
    assert.equal(older.open, true);
    assert.equal(older.relatedProject, project.id);
    // Ensure distinct created if clock resolution is coarse
    await new Promise((r) => setTimeout(r, 5));
    const newer = await createHandoff(root, {
      title: "Second",
      from: from.id,
      to: to.id,
      relatedProject: project.id,
      open: false,
    });
    assert.equal(newer.open, false);
    assert.equal(isValidEntityId(older.id), true);
    assert.equal(newer.created >= older.created, true);
    const snap = await getHandoffSnapshot(root);
    assert.equal(snap.nodes.length, 2);
    assert.equal(snap.nodes[0]!.id, newer.id);
    assert.equal(snap.nodes[1]!.id, older.id);
    const got = await getHandoff(root, older.id);
    assert.match(got.body, /@issue-/);
  });
});

test("updateHandoff bumps updated; from/to must exist", async () => {
  await withTempWorkspace(async (root) => {
    const project = await createProject(root, { title: "P" });
    const from = await createMember(root, { title: "Alice" });
    const to = await createMember(root, { title: "Bob" });
    const other = await createMember(root, { title: "Carol" });
    const h = await createHandoff(root, {
      title: "Wave",
      from: from.id,
      to: to.id,
      relatedProject: project.id,
    });
    const updated = await updateHandoff(root, h.id, {
      title: "Wave 2",
      to: other.id,
      body: "done",
      open: false,
    });
    assert.equal(updated.title, "Wave 2");
    assert.equal(updated.to, other.id);
    assert.equal(updated.body, "done");
    assert.equal(updated.open, false);
    assert.notEqual(updated.updated, h.updated);
    assert.equal(updated.created, h.created);

    await assert.rejects(
      () =>
        createHandoff(root, {
          title: "Bad",
          from: from.id,
          to: "xxxxxxxxxxxxxxxxxxxxx" as never,
          relatedProject: project.id,
        }),
      /to \(member id\)|to member not found|Invalid/,
    );

    await assert.rejects(
      () =>
        createHandoff(root, {
          title: "No project",
          from: from.id,
          to: to.id,
          relatedProject: "xxxxxxxxxxxxxxxxxxxxx" as never,
        }),
      /relatedProject|project not found|Invalid/,
    );
  });
});

test("doctor reports handoff-broken-ref and invalid name", async () => {
  await withTempWorkspace(async (root) => {
    const project = await createProject(root, { title: "P" });
    const from = await createMember(root, { title: "Alice" });
    const to = await createMember(root, { title: "Bob" });
    const h = await createHandoff(root, {
      title: "Wave",
      from: from.id,
      to: to.id,
      relatedProject: project.id,
    });
    const propsPath = path.join(root, "handoffs", h.id, "props.ts");
    let src = fs.readFileSync(propsPath, "utf8");
    src = src.replace(to.id, "zzzzzzzzzzzzzzzzzzzzz");
    fs.writeFileSync(propsPath, src, "utf8");
    fs.mkdirSync(path.join(root, "handoffs", "not-a-nanoid-dir"), {
      recursive: true,
    });
    const report = scanStrays(root);
    assert.ok(
      report.warnings.some((w) => w.kind === "handoff-broken-ref"),
      "expected handoff-broken-ref",
    );
    assert.ok(
      report.warnings.some((w) => w.kind === "handoff-invalid-name"),
      "expected handoff-invalid-name",
    );
  });
});

test("handoff link parse/syntax", () => {
  const id = "V1StGXR8_Z5jdHi6B-myT";
  const raw = handoffLinkSyntax(id);
  assert.equal(raw, `@handoff-${id}`);
  const parsed = parseHandoffLinks(`See ${raw} please`);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.handoffId, id);
});
