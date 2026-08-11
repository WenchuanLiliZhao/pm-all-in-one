import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  getUnsyncedChanges,
  nodeRefFromRelPath,
  parseNullSeparatedPaths,
} from "./git-changes.js";

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "pipe", encoding: "utf8" });
}

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(root: string, rel: string, body: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body, "utf8");
}

function initRepo(root: string): void {
  git(root, ["init"]);
  git(root, ["config", "user.name", "Test"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "commit.gpgsign", "false"]);
}

const PROJECT_ID = "V1StGXR8_Z5jdHi6B-myT";
const ISSUE_ID = "abcdefghijklmnopqrstu";
const WIKI_ID = "wikiNodeId0123456789a";

test("nodeRefFromRelPath maps known layouts", () => {
  assert.deepEqual(nodeRefFromRelPath("workspace.ts"), {
    kind: "workspace",
  });
  assert.deepEqual(nodeRefFromRelPath("README.md"), { kind: "workspace" });
  assert.deepEqual(
    nodeRefFromRelPath(`issue-hierarchy/${PROJECT_ID}/project.ts`),
    { kind: "project", projectId: PROJECT_ID },
  );
  assert.deepEqual(
    nodeRefFromRelPath(
      `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/props.ts`,
    ),
    { kind: "issue", projectId: PROJECT_ID, issueId: ISSUE_ID },
  );
  assert.deepEqual(nodeRefFromRelPath(`wiki/${WIKI_ID}/README.md`), {
    kind: "wiki",
    wikiNodeId: WIKI_ID,
  });
  assert.equal(nodeRefFromRelPath("wiki/sidebar.ts"), null);
  assert.equal(
    nodeRefFromRelPath(`issue-hierarchy/${PROJECT_ID}/custom-props.ts`),
    null,
  );
  assert.equal(nodeRefFromRelPath(".pm/index.json"), null);
});

test("parseNullSeparatedPaths status and name-status", () => {
  const status = parseNullSeparatedPaths(
    ` M issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/props.ts\0?? wiki/${WIKI_ID}/README.md\0`,
    "status",
  );
  assert.deepEqual(status, [
    `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/props.ts`,
    `wiki/${WIKI_ID}/README.md`,
  ]);

  const renamed = parseNullSeparatedPaths(
    `R  old/path.md\0new/path.md\0`,
    "status",
  );
  assert.deepEqual(renamed, ["old/path.md", "new/path.md"]);

  const nameStatus = parseNullSeparatedPaths(
    `M\0issue-hierarchy/${PROJECT_ID}/project.ts\0A\0wiki/${WIKI_ID}/props.ts\0`,
    "name-status",
  );
  assert.deepEqual(nameStatus, [
    `issue-hierarchy/${PROJECT_ID}/project.ts`,
    `wiki/${WIKI_ID}/props.ts`,
  ]);

  const renameNs = parseNullSeparatedPaths(
    `R100\0old.md\0new.md\0`,
    "name-status",
  );
  assert.deepEqual(renameNs, ["old.md", "new.md"]);
});

test("getUnsyncedChanges returns not-repo for plain directory", async () => {
  const root = mkTmp("local-pm-changes-nogit-");
  try {
    const result = await getUnsyncedChanges(root);
    assert.equal(result.kind, "not-repo");
    assert.equal(result.nodes.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("getUnsyncedChanges reports untracked new issue as uncommitted", async () => {
  const root = mkTmp("local-pm-changes-newissue-");
  try {
    initRepo(root);
    writeFile(root, "README.md", "ws\n");
    git(root, ["add", "README.md"]);
    git(root, ["commit", "-m", "init"]);

    writeFile(
      root,
      `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/props.ts`,
      'export const props = { "title": "x" }\n',
    );
    writeFile(
      root,
      `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/README.md`,
      "body\n",
    );

    const result = await getUnsyncedChanges(root);
    assert.equal(result.kind, "no-upstream");
    assert.equal(result.nodes.length, 1);
    const node = result.nodes[0]!;
    assert.equal(node.ref.kind, "issue");
    assert.equal(node.propsChanged, true);
    assert.equal(node.bodyChanged, true);
    assert.equal(node.state, "uncommitted");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function cloneRepo(bare: string, dest: string): void {
  execFileSync("git", ["clone", bare, dest], {
    stdio: "pipe",
    encoding: "utf8",
  });
  git(dest, ["config", "user.name", "Test"]);
  git(dest, ["config", "user.email", "test@example.com"]);
  git(dest, ["config", "commit.gpgsign", "false"]);
}

function setupRemotePair(): { bare: string; a: string; b: string } {
  const bare = mkTmp("local-pm-changes-bare-");
  const a = mkTmp("local-pm-changes-a-");
  const parent = mkTmp("local-pm-changes-clones-");
  const b = path.join(parent, "b");

  git(bare, ["init", "--bare"]);

  initRepo(a);
  writeFile(a, "README.md", "one\n");
  writeFile(
    a,
    `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/props.ts`,
    'export const props = { "title": "base" }\n',
  );
  writeFile(
    a,
    `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/README.md`,
    "body\n",
  );
  writeFile(a, `wiki/${WIKI_ID}/props.ts`, 'export const props = {}\n');
  writeFile(a, `wiki/${WIKI_ID}/README.md`, "wiki\n");
  git(a, ["add", "."]);
  git(a, ["commit", "-m", "init"]);
  git(a, ["branch", "-M", "main"]);
  git(a, ["remote", "add", "origin", bare]);
  git(a, ["push", "-u", "origin", "main"]);

  cloneRepo(bare, b);
  return { bare, a, b };
}

function cleanupPair(paths: { bare: string; a: string; b: string }): void {
  fs.rmSync(paths.bare, { recursive: true, force: true });
  fs.rmSync(paths.a, { recursive: true, force: true });
  fs.rmSync(path.dirname(paths.b), { recursive: true, force: true });
}

test("getUnsyncedChanges: props-only edit is propsChanged", async () => {
  const pair = setupRemotePair();
  try {
    writeFile(
      pair.b,
      `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/props.ts`,
      'export const props = { "title": "edited" }\n',
    );
    const result = await getUnsyncedChanges(pair.b);
    assert.equal(result.kind, "ok");
    assert.equal(result.nodes.length, 1);
    const node = result.nodes[0]!;
    assert.equal(node.propsChanged, true);
    assert.equal(node.bodyChanged, false);
    assert.equal(node.state, "uncommitted");
  } finally {
    cleanupPair(pair);
  }
});

test("getUnsyncedChanges: timestamp-only props diff is omitted", async () => {
  const pair = setupRemotePair();
  try {
    writeFile(
      pair.b,
      `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/props.ts`,
      [
        "export const props = {",
        '  "title": "base",',
        '  "status": "todo",',
        '  "created": "2026-01-01T00:00:00.000Z",',
        '  "updated": "2026-01-01T00:00:00.000Z"',
        "}",
        "",
      ].join("\n"),
    );
    git(pair.b, ["add", "."]);
    git(pair.b, ["commit", "-m", "with timestamps"]);
    git(pair.b, ["push"]);

    writeFile(
      pair.b,
      `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/props.ts`,
      [
        "export const props = {",
        '  "title": "base",',
        '  "status": "todo",',
        '  "created": "2026-01-01T00:00:00.000Z",',
        '  "updated": "2026-08-11T13:00:00.000Z"',
        "}",
        "",
      ].join("\n"),
    );

    const result = await getUnsyncedChanges(pair.b);
    assert.equal(result.kind, "ok");
    assert.equal(result.nodes.length, 0);
    assert.deepEqual(result.otherFiles, []);
  } finally {
    cleanupPair(pair);
  }
});

test("getUnsyncedChanges: revert editable field but bumped updated is omitted", async () => {
  const pair = setupRemotePair();
  try {
    writeFile(
      pair.b,
      `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/props.ts`,
      [
        "export const props = {",
        '  "title": "base",',
        '  "status": "draft",',
        '  "created": "2026-01-01T00:00:00.000Z",',
        '  "updated": "2026-01-01T00:00:00.000Z"',
        "}",
        "",
      ].join("\n"),
    );
    git(pair.b, ["add", "."]);
    git(pair.b, ["commit", "-m", "baseline"]);
    git(pair.b, ["push"]);

    writeFile(
      pair.b,
      `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/props.ts`,
      [
        "export const props = {",
        '  "title": "base",',
        '  "status": "todo",',
        '  "created": "2026-01-01T00:00:00.000Z",',
        '  "updated": "2026-08-11T12:00:00.000Z"',
        "}",
        "",
      ].join("\n"),
    );
    const mid = await getUnsyncedChanges(pair.b);
    assert.equal(mid.nodes.length, 1);

    writeFile(
      pair.b,
      `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/props.ts`,
      [
        "export const props = {",
        '  "title": "base",',
        '  "status": "draft",',
        '  "created": "2026-01-01T00:00:00.000Z",',
        '  "updated": "2026-08-11T13:00:00.000Z"',
        "}",
        "",
      ].join("\n"),
    );
    const after = await getUnsyncedChanges(pair.b);
    assert.equal(after.nodes.length, 0);
  } finally {
    cleanupPair(pair);
  }
});

test("getUnsyncedChanges: committed but unpushed is unpushed", async () => {
  const pair = setupRemotePair();
  try {
    writeFile(
      pair.b,
      `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}/props.ts`,
      'export const props = { "title": "committed" }\n',
    );
    git(pair.b, ["add", "."]);
    git(pair.b, ["commit", "-m", "local"]);

    const result = await getUnsyncedChanges(pair.b);
    assert.equal(result.kind, "ok");
    assert.equal(result.nodes.length, 1);
    const node = result.nodes[0]!;
    assert.equal(node.state, "unpushed");
    assert.equal(node.propsChanged, true);
    assert.equal(node.bodyChanged, false);
  } finally {
    cleanupPair(pair);
  }
});

test("getUnsyncedChanges: wiki README body only", async () => {
  const pair = setupRemotePair();
  try {
    writeFile(pair.b, `wiki/${WIKI_ID}/README.md`, "wiki edited\n");
    const result = await getUnsyncedChanges(pair.b);
    assert.equal(result.kind, "ok");
    assert.equal(result.nodes.length, 1);
    const node = result.nodes[0]!;
    assert.equal(node.ref.kind, "wiki");
    assert.equal(node.bodyChanged, true);
    assert.equal(node.propsChanged, false);
  } finally {
    cleanupPair(pair);
  }
});

test("getUnsyncedChanges: .pm file goes to otherFiles", async () => {
  const pair = setupRemotePair();
  try {
    writeFile(pair.b, ".pm/index.json", "{}\n");
    const result = await getUnsyncedChanges(pair.b);
    assert.equal(result.kind, "ok");
    assert.equal(result.nodes.length, 0);
    assert.ok(result.otherFiles.some((p) => p.includes(".pm/")));
  } finally {
    cleanupPair(pair);
  }
});
