import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { isValidEntityId } from "./core/identity/dir-id.js";
import { handoffLinkSyntax } from "./core/identity/links.js";
import { createMember } from "./core/domain/members.js";
import { createProject } from "./core/domain/store.js";
import { scaffoldWorkspace } from "./core/workspace/scaffold-workspace.js";

const CLI_JS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "cli.js",
);

async function withTempWorkspace(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-cli-handoff-"));
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-ud-"));
  const prev = process.env.LOCAL_PM_USER_DATA;
  process.env.LOCAL_PM_USER_DATA = userData;
  try {
    scaffoldWorkspace(root, { title: "CLI Handoff Test" });
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

function runHandoff(
  root: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    [CLI_JS, "handoff", ...args, "--workspace", root],
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

test("cli handoff create --body writes README", async () => {
  await withTempWorkspace(async (root) => {
    const project = await createProject(root, { title: "P" });
    const from = await createMember(root, { title: "Alice" });
    const to = await createMember(root, { title: "Bob" });
    const result = runHandoff(root, [
      "create",
      "--from",
      from.id,
      "--to",
      to.id,
      "--related-project",
      project.id,
      "--title",
      "Wave",
      "--body",
      "Start here.",
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as {
      id: string;
      title: string;
      ref: string;
      body: string;
    };
    assert.equal(isValidEntityId(payload.id), true);
    assert.equal(payload.title, "Wave");
    assert.equal(payload.ref, handoffLinkSyntax(payload.id));
    assert.equal(payload.body, "Start here.");
    assert.equal(
      fs.readFileSync(
        path.join(root, "handoffs", payload.id, "README.md"),
        "utf8",
      ),
      "Start here.",
    );
  });
});

test("cli handoff create --body-file writes README", async () => {
  await withTempWorkspace(async (root) => {
    const project = await createProject(root, { title: "P" });
    const from = await createMember(root, { title: "Alice" });
    const to = await createMember(root, { title: "Bob" });
    const bodyFile = path.join(root, "note.md");
    fs.writeFileSync(bodyFile, "From a file.\nSecond line.\n");
    const result = runHandoff(root, [
      "create",
      "--from",
      from.id,
      "--to",
      to.id,
      "--related-project",
      project.id,
      "--body-file",
      bodyFile,
      "--json",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout) as { id: string; body: string };
    assert.equal(payload.body, "From a file.\nSecond line.\n");
  });
});

test("cli handoff create rejects both --body and --body-file", async () => {
  await withTempWorkspace(async (root) => {
    const project = await createProject(root, { title: "P" });
    const from = await createMember(root, { title: "Alice" });
    const to = await createMember(root, { title: "Bob" });
    const result = runHandoff(root, [
      "create",
      "--from",
      from.id,
      "--to",
      to.id,
      "--related-project",
      project.id,
      "--body",
      "inline",
      "--body-file",
      path.join(root, "missing.md"),
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--body or --body-file/);
  });
});
