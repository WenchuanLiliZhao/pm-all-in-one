import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { getGitSyncStatus, pullFastForward } from "./git-sync.js";

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

test("getGitSyncStatus returns not-repo for plain directory", async () => {
  const root = mkTmp("local-pm-sync-nogit-");
  try {
    const status = await getGitSyncStatus(root);
    assert.equal(status.kind, "not-repo");
    assert.equal(status.behind, 0);
    assert.equal(status.ahead, 0);
    assert.equal(status.dirty, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("getGitSyncStatus returns no-upstream when remote tracking missing", async () => {
  const root = mkTmp("local-pm-sync-noup-");
  try {
    initRepo(root);
    writeFile(root, "README.md", "a\n");
    git(root, ["add", "README.md"]);
    git(root, ["commit", "-m", "init"]);

    const status = await getGitSyncStatus(root);
    assert.equal(status.kind, "no-upstream");
    assert.equal(status.dirty, false);
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

function pushAdvance(a: string, body: string): void {
  writeFile(a, "README.md", body);
  git(a, ["add", "README.md"]);
  git(a, ["commit", "-m", "advance"]);
  git(a, ["push"]);
}

function setupRemotePair(): { bare: string; a: string; b: string } {
  const bare = mkTmp("local-pm-sync-bare-");
  const a = mkTmp("local-pm-sync-a-");
  const parent = mkTmp("local-pm-sync-clones-");
  const b = path.join(parent, "b");

  git(bare, ["init", "--bare"]);

  initRepo(a);
  writeFile(a, "README.md", "one\n");
  git(a, ["add", "README.md"]);
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

test("getGitSyncStatus reports dirty and behind after remote advances", async () => {
  const pair = setupRemotePair();
  try {
    pushAdvance(pair.a, "two\n");
    writeFile(pair.b, "local.txt", "dirty\n");

    const status = await getGitSyncStatus(pair.b);
    assert.equal(status.kind, "ok");
    assert.equal(status.behind, 1);
    assert.equal(status.ahead, 0);
    assert.equal(status.dirty, true);
  } finally {
    cleanupPair(pair);
  }
});

test("pullFastForward blocks dirty tree", async () => {
  const pair = setupRemotePair();
  try {
    pushAdvance(pair.a, "two\n");
    writeFile(pair.b, "local.txt", "dirty\n");

    const result = await pullFastForward(pair.b);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "dirty");
    }
  } finally {
    cleanupPair(pair);
  }
});

test("pullFastForward fast-forwards a clean behind clone", async () => {
  const pair = setupRemotePair();
  try {
    pushAdvance(pair.a, "two\n");

    const result = await pullFastForward(pair.b);
    assert.equal(result.ok, true);
    assert.equal(
      fs.readFileSync(path.join(pair.b, "README.md"), "utf8"),
      "two\n",
    );

    const status = await getGitSyncStatus(pair.b);
    assert.equal(status.kind, "ok");
    assert.equal(status.behind, 0);
  } finally {
    cleanupPair(pair);
  }
});

test("pullFastForward returns not-repo for plain directory", async () => {
  const root = mkTmp("local-pm-pull-nogit-");
  try {
    const result = await pullFastForward(root);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "not-repo");
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("getGitSyncStatus dirty ignores sibling outside workspace cwd", async () => {
  const repo = mkTmp("local-pm-sync-subdir-repo-");
  try {
    initRepo(repo);
    writeFile(repo, "outside.txt", "out\n");
    writeFile(repo, "workspace/README.md", "in\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-m", "init"]);
    git(repo, ["branch", "-M", "main"]);

    // Dirty outside the workspace subdirectory
    writeFile(repo, "outside.txt", "dirty-out\n");
    const ws = path.join(repo, "workspace");
    const status = await getGitSyncStatus(ws, { fetch: false });
    // workspace is still a git work tree (subdirectory)
    assert.ok(status.kind === "ok" || status.kind === "no-upstream");
    assert.equal(status.dirty, false);
    assert.equal(status.fetched, false);
    assert.ok(typeof status.checkedAt === "string");
    assert.match(status.checkedAt, /Z$/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("getGitSyncStatus fetch:false skips network and still reports ahead/behind", async () => {
  const pair = setupRemotePair();
  try {
    pushAdvance(pair.a, "two\n");
    // Without fetch, local clone still has stale upstream tip until fetch —
    // but fetch:false must still return kind ok with local counts.
    const status = await getGitSyncStatus(pair.b, { fetch: false });
    assert.equal(status.kind, "ok");
    assert.equal(status.fetched, false);
    assert.ok(typeof status.checkedAt === "string");
    // Local tracking not updated → behind may still be 0 without fetch
    assert.equal(typeof status.behind, "number");
    assert.equal(typeof status.ahead, "number");

    const withFetch = await getGitSyncStatus(pair.b, { fetch: true });
    assert.equal(withFetch.kind, "ok");
    assert.equal(withFetch.fetched, true);
    assert.equal(withFetch.behind, 1);
  } finally {
    cleanupPair(pair);
  }
});
