import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  copyFilesIntoNodeAssets,
  getNodeAssetsDir,
  listNodeAssets,
  sanitizeAssetBasename,
  uniqueAssetName,
  writeBuffersIntoNodeAssets,
} from "./node-assets.js";
import { scaffoldWorkspace } from "../workspace/scaffold-workspace.js";
import { createIssue, createProject } from "./store.js";
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

test("listNodeAssets returns [] when assets/ is absent", async () => {
  await withEnvUserData(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-assets-"));
    try {
      scaffoldWorkspace(root, { title: "Assets test" });
      const project = await createProject(root, { title: "P" });
      assert.deepEqual(
        listNodeAssets(root, { kind: "project", projectId: project.id }),
        [],
      );
      assert.equal(
        getNodeAssetsDir(root, { kind: "project", projectId: project.id }),
        null,
      );
      assert.equal(
        fs.existsSync(path.join(project.path, "assets")),
        false,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

test("copyFilesIntoNodeAssets creates assets/ and lists files", async () => {
  await withEnvUserData(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-assets2-"));
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-src-"));
    try {
      scaffoldWorkspace(root, { title: "Assets test" });
      const project = await createProject(root, { title: "P" });
      const issue = await createIssue(root, {
        projectId: project.id,
        parentIssueId: null,
        title: "C",
      });

      const srcA = path.join(staging, "shot.png");
      const srcB = path.join(staging, "notes.pdf");
      fs.writeFileSync(srcA, "png");
      fs.writeFileSync(srcB, "pdf");

      const written = copyFilesIntoNodeAssets(
        root,
        { kind: "issue", projectId: project.id, issueId: issue.id },
        [srcA, srcB],
      );
      assert.deepEqual(written, ["shot.png", "notes.pdf"]);
      assert.equal(fs.existsSync(path.join(issue.path, "assets")), true);
      assert.deepEqual(
        listNodeAssets(root, {
          kind: "issue",
          projectId: project.id,
          issueId: issue.id,
        }),
        ["notes.pdf", "shot.png"],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(staging, { recursive: true, force: true });
    }
  });
});

test("uniqueAssetName adds -2 suffix on conflict", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-uniq-"));
  try {
    fs.writeFileSync(path.join(dir, "diagram.png"), "1");
    assert.equal(uniqueAssetName(dir, "diagram.png"), "diagram-2.png");
    fs.writeFileSync(path.join(dir, "diagram-2.png"), "2");
    assert.equal(uniqueAssetName(dir, "diagram.png"), "diagram-3.png");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("sanitizeAssetBasename rejects path traversal", () => {
  assert.equal(sanitizeAssetBasename("/tmp/evil.png"), "evil.png");
  assert.equal(sanitizeAssetBasename("..\\x.png"), "x.png");
  assert.throws(() => sanitizeAssetBasename("."), /Invalid asset filename/);
  assert.throws(() => sanitizeAssetBasename(".."), /Invalid asset filename/);
});

test("workspace and wiki node assets share the same rules", async () => {
  await withEnvUserData(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-assets3-"));
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-src3-"));
    try {
      scaffoldWorkspace(root, { title: "Assets test" });
      const wiki = await createWikiNode(root, { title: "W" });
      const src = path.join(staging, "a.txt");
      fs.writeFileSync(src, "hi");

      copyFilesIntoNodeAssets(root, { kind: "workspace" }, [src]);
      assert.deepEqual(listNodeAssets(root, { kind: "workspace" }), ["a.txt"]);
      assert.equal(fs.existsSync(path.join(root, "assets", "a.txt")), true);

      copyFilesIntoNodeAssets(
        root,
        { kind: "wiki", wikiNodeId: wiki.id },
        [src],
      );
      assert.deepEqual(
        listNodeAssets(root, { kind: "wiki", wikiNodeId: wiki.id }),
        ["a.txt"],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(staging, { recursive: true, force: true });
    }
  });
});

test("copy conflict renames on second add of same basename", async () => {
  await withEnvUserData(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-assets4-"));
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-src4-"));
    try {
      scaffoldWorkspace(root, { title: "Assets test" });
      const project = await createProject(root, { title: "P" });
      const src = path.join(staging, "foo.bin");
      fs.writeFileSync(src, "1");

      assert.deepEqual(
        copyFilesIntoNodeAssets(
          root,
          { kind: "project", projectId: project.id },
          [src],
        ),
        ["foo.bin"],
      );
      fs.writeFileSync(src, "2");
      assert.deepEqual(
        copyFilesIntoNodeAssets(
          root,
          { kind: "project", projectId: project.id },
          [src],
        ),
        ["foo-2.bin"],
      );
      assert.deepEqual(
        listNodeAssets(root, { kind: "project", projectId: project.id }),
        ["foo-2.bin", "foo.bin"],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(staging, { recursive: true, force: true });
    }
  });
});

test("writeBuffersIntoNodeAssets writes clipboard-style bytes", async () => {
  await withEnvUserData(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-assets5-"));
    try {
      scaffoldWorkspace(root, { title: "Assets buffer" });
      const project = await createProject(root, { title: "P" });
      const written = writeBuffersIntoNodeAssets(
        root,
        { kind: "project", projectId: project.id },
        [
          { name: "paste.png", bytes: new Uint8Array([1, 2, 3]) },
          { name: "paste.png", bytes: new Uint8Array([4, 5]) },
        ],
      );
      assert.deepEqual(written, ["paste.png", "paste-2.png"]);
      assert.deepEqual(
        listNodeAssets(root, { kind: "project", projectId: project.id }),
        ["paste-2.png", "paste.png"],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
