#!/usr/bin/env node
/**
 * Dual-clone concurrent create harness (nanoid ids, no writer handles).
 *
 * Layout:
 *   <tmpdir>/local-pm-harness-<ts>/
 *     remote.git/          bare remote
 *     alice/               clone + LOCAL_PM_USER_DATA=alice-ud
 *     bob/                 clone + LOCAL_PM_USER_DATA=bob-ud
 *
 * Asserts:
 *   - concurrent createProject / createIssue / createWikiNode → distinct nanoid(21)
 *   - git push/pull/merge succeeds (new dirs only)
 *
 * Usage (from app after build:electron):
 *   node scripts/dual-writer-harness.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "..", "dist-electron", "core");

const { scaffoldWorkspace } = await import(path.join(dist, "scaffold-workspace.js"));
const { createIssue, createProject, listIssues, listProjects } = await import(
  path.join(dist, "store.js")
);
const { createWikiNode, listWikiNodeIdsOnDisk } = await import(
  path.join(dist, "wiki.js")
);
const { ENTITY_ID_LENGTH, isValidEntityId } = await import(
  path.join(dist, "dir-id.js")
);

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function writeUd(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function withUserData(ud, fn) {
  const prev = process.env.LOCAL_PM_USER_DATA;
  process.env.LOCAL_PM_USER_DATA = ud;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.LOCAL_PM_USER_DATA;
    else process.env.LOCAL_PM_USER_DATA = prev;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertNanoid(id, label) {
  assert(
    typeof id === "string" &&
      id.length === ENTITY_ID_LENGTH &&
      isValidEntityId(id),
    `${label} must be nanoid(21), got ${JSON.stringify(id)}`,
  );
}

const base = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-harness-"));
const remote = path.join(base, "remote.git");
const alice = path.join(base, "alice");
const bob = path.join(base, "bob");
const aliceUd = writeUd(path.join(base, "alice-ud"));
const bobUd = writeUd(path.join(base, "bob-ud"));

console.log("harness root:", base);

try {
  // Seed workspace → bare remote → two clones
  const seed = path.join(base, "seed");
  scaffoldWorkspace(seed, {
    title: "Harness",
    seedProject: { title: "Shared" },
  });
  git(seed, "init");
  git(seed, "config", "user.email", "seed@example.com");
  git(seed, "config", "user.name", "Seed");
  git(seed, "add", "-A");
  git(seed, "commit", "-m", "seed");
  git(seed, "branch", "-M", "main");
  execFileSync("git", ["clone", "--bare", seed, remote], { encoding: "utf8" });
  git(base, "clone", remote, "alice");
  git(base, "clone", remote, "bob");
  for (const who of [alice, bob]) {
    git(who, "config", "user.email", `${path.basename(who)}@example.com`);
    git(who, "config", "user.name", path.basename(who));
  }

  const seedProjects = await listProjects(alice);
  assert(seedProjects.length === 1, "seed should have one project");
  const sharedProjectId = seedProjects[0].id;
  assertNanoid(sharedProjectId, "seed project");

  // --- Concurrent createIssue under shared project ---
  let aliceIssueId;
  let bobIssueId;
  await withUserData(aliceUd, async () => {
    const issue = await createIssue(alice, {
      projectId: sharedProjectId,
      parentIssueId: null,
      title: "Alice epic",
    });
    aliceIssueId = issue.id;
  });
  await withUserData(bobUd, async () => {
    const issue = await createIssue(bob, {
      projectId: sharedProjectId,
      parentIssueId: null,
      title: "Bob epic",
    });
    bobIssueId = issue.id;
  });
  assertNanoid(aliceIssueId, "alice issue");
  assertNanoid(bobIssueId, "bob issue");
  assert(aliceIssueId !== bobIssueId, "issue ids must differ");

  git(alice, "add", "-A");
  git(alice, "commit", "-m", "alice creates issue");
  git(alice, "push", "origin", "main");

  git(bob, "add", "-A");
  git(bob, "commit", "-m", "bob creates issue");
  git(bob, "pull", "--no-rebase", "origin", "main");
  git(bob, "push", "origin", "main");
  git(alice, "pull", "--no-rebase", "origin", "main");

  const issues = await listIssues(alice);
  const titles = new Set(issues.map((i) => i.title));
  assert(
    titles.has("Alice epic") && titles.has("Bob epic"),
    "both issues survive",
  );
  assert(
    !fs.existsSync(path.join(alice, ".git", "MERGE_HEAD")),
    "no unresolved merge",
  );
  console.log("ok: concurrent createIssue — zero conflict, both present", {
    aliceIssueId,
    bobIssueId,
  });

  // --- Concurrent createProject ---
  let aliceProj;
  let bobProj;
  await withUserData(aliceUd, async () => {
    aliceProj = await createProject(alice, { title: "Alice Project" });
  });
  await withUserData(bobUd, async () => {
    bobProj = await createProject(bob, { title: "Bob Project" });
  });
  assertNanoid(aliceProj.id, "alice project");
  assertNanoid(bobProj.id, "bob project");
  assert(aliceProj.id !== bobProj.id, "project ids must differ");
  git(alice, "add", "-A");
  git(alice, "commit", "-m", "alice project");
  git(alice, "push", "origin", "main");
  git(bob, "add", "-A");
  git(bob, "commit", "-m", "bob project");
  git(bob, "pull", "--no-rebase", "origin", "main");
  git(bob, "push", "origin", "main");
  git(alice, "pull", "--no-rebase", "origin", "main");
  const projects = await listProjects(alice);
  const pt = new Set(projects.map((p) => p.title));
  assert(
    pt.has("Alice Project") && pt.has("Bob Project"),
    "both projects survive",
  );
  console.log("ok: concurrent createProject", {
    alice: aliceProj.id,
    bob: bobProj.id,
  });

  // --- Concurrent createWikiNode ---
  let aliceWiki;
  let bobWiki;
  await withUserData(aliceUd, async () => {
    aliceWiki = await createWikiNode(alice, { title: "Alice Wiki" });
  });
  await withUserData(bobUd, async () => {
    bobWiki = await createWikiNode(bob, { title: "Bob Wiki" });
  });
  assertNanoid(aliceWiki.id, "alice wiki");
  assertNanoid(bobWiki.id, "bob wiki");
  assert(aliceWiki.id !== bobWiki.id, "wiki ids must differ");
  git(alice, "add", "-A");
  git(alice, "commit", "-m", "alice wiki");
  git(alice, "push", "origin", "main");
  git(bob, "add", "-A");
  git(bob, "commit", "-m", "bob wiki");
  git(bob, "pull", "--no-rebase", "origin", "main");
  git(bob, "push", "origin", "main");
  git(alice, "pull", "--no-rebase", "origin", "main");
  const wikiIds = listWikiNodeIdsOnDisk(alice);
  assert(wikiIds.includes(aliceWiki.id) && wikiIds.includes(bobWiki.id), "both wiki nodes survive");
  console.log("ok: concurrent createWikiNode", {
    alice: aliceWiki.id,
    bob: bobWiki.id,
  });

  // All created ids distinct
  const allIds = [
    sharedProjectId,
    aliceIssueId,
    bobIssueId,
    aliceProj.id,
    bobProj.id,
    aliceWiki.id,
    bobWiki.id,
  ];
  assert(new Set(allIds).size === allIds.length, "all entity ids must be unique");
  for (const id of allIds) assertNanoid(id, "entity");

  // --- Cross-ref ---
  await withUserData(aliceUd, async () => {
    const bobIssue = (await listIssues(alice)).find(
      (i) => i.title === "Bob epic",
    );
    assert(bobIssue, "alice can see bob issue");
    const body = path.join(
      alice,
      "issue-hierarchy",
      sharedProjectId,
      aliceIssueId,
      "README.md",
    );
    fs.writeFileSync(
      body,
      `Mentions @issue-${sharedProjectId}::${bobIssue.id}\n`,
      "utf8",
    );
  });
  git(alice, "add", "-A");
  git(alice, "commit", "-m", "alice references bob issue");
  git(alice, "push", "origin", "main");
  git(bob, "pull", "--no-rebase", "origin", "main");
  console.log("ok: cross @issue- reference");

  console.log("\nALL HARNESS ASSERTIONS PASSED");
  console.log("(Expected MANUAL conflicts like view-orders.json are out of this script.)");
} catch (e) {
  console.error("\nHARNESS FAILED:", e instanceof Error ? e.message : e);
  console.error("left workspace at", base);
  process.exitCode = 1;
} finally {
  // Keep on failure for inspection; wipe on success
  if (process.exitCode !== 1) {
    fs.rmSync(base, { recursive: true, force: true });
  }
}
