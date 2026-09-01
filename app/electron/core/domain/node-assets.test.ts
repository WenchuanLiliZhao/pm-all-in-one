import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  copyFilesIntoNodeAssets,
  getNodeAssetsDir,
  listNodeAssets,
  MAX_ASSET_COPY_DEPTH,
  sanitizeAssetBasename,
  uniqueAssetFolderName,
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

test("copyFilesIntoNodeAssets copies a folder tree and lists posix relpaths", async () => {
  await withEnvUserData(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-assets-dir-"));
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-src-dir-"));
    try {
      scaffoldWorkspace(root, { title: "Assets dir" });
      const project = await createProject(root, { title: "P" });
      const folder = path.join(staging, "docs");
      fs.mkdirSync(path.join(folder, "sub"), { recursive: true });
      fs.writeFileSync(path.join(folder, "a.pdf"), "a");
      fs.writeFileSync(path.join(folder, "sub", "b.png"), "b");
      fs.writeFileSync(path.join(folder, ".DS_Store"), "junk");
      fs.writeFileSync(path.join(folder, "Thumbs.db"), "junk");
      fs.mkdirSync(path.join(folder, ".hidden"));
      fs.writeFileSync(path.join(folder, ".hidden", "secret.txt"), "no");

      const written = copyFilesIntoNodeAssets(
        root,
        { kind: "project", projectId: project.id },
        [folder],
      );
      assert.deepEqual(written.sort(), ["docs/a.pdf", "docs/sub/b.png"]);
      assert.deepEqual(
        listNodeAssets(root, { kind: "project", projectId: project.id }),
        ["docs/", "docs/a.pdf", "docs/sub/", "docs/sub/b.png"],
      );
      assert.equal(
        fs.existsSync(path.join(project.path, "assets", "docs", ".DS_Store")),
        false,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(staging, { recursive: true, force: true });
    }
  });
});

test("copying a folder merges into an existing directory", async () => {
  await withEnvUserData(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-assets-merge-"));
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-src-merge-"));
    try {
      scaffoldWorkspace(root, { title: "Assets merge" });
      const project = await createProject(root, { title: "P" });
      const first = path.join(staging, "docs");
      fs.mkdirSync(first);
      fs.writeFileSync(path.join(first, "a.pdf"), "1");
      copyFilesIntoNodeAssets(
        root,
        { kind: "project", projectId: project.id },
        [first],
      );

      const second = path.join(staging, "docs-again");
      fs.mkdirSync(second);
      fs.writeFileSync(path.join(second, "a.pdf"), "2");
      fs.writeFileSync(path.join(second, "c.txt"), "c");
      // Upload a folder named docs again (same basename via rename of source).
      const docs2 = path.join(staging, "docs");
      fs.rmSync(docs2, { recursive: true, force: true });
      fs.renameSync(second, docs2);

      const written = copyFilesIntoNodeAssets(
        root,
        { kind: "project", projectId: project.id },
        [docs2],
      );
      assert.deepEqual(written.sort(), ["docs/a-2.pdf", "docs/c.txt"]);
      assert.deepEqual(
        listNodeAssets(root, { kind: "project", projectId: project.id }),
        ["docs/", "docs/a-2.pdf", "docs/a.pdf", "docs/c.txt"],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(staging, { recursive: true, force: true });
    }
  });
});

test("folder name colliding with a file is renamed", async () => {
  await withEnvUserData(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-assets-coll-"));
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-src-coll-"));
    try {
      scaffoldWorkspace(root, { title: "Assets coll" });
      const project = await createProject(root, { title: "P" });
      const file = path.join(staging, "docs");
      fs.writeFileSync(file, "not-a-dir");
      copyFilesIntoNodeAssets(
        root,
        { kind: "project", projectId: project.id },
        [file],
      );

      const folder = path.join(staging, "docs-folder");
      fs.mkdirSync(folder);
      fs.writeFileSync(path.join(folder, "x.txt"), "x");
      const asDocs = path.join(staging, "upload", "docs");
      fs.mkdirSync(path.dirname(asDocs), { recursive: true });
      fs.cpSync(folder, asDocs, { recursive: true });

      const written = copyFilesIntoNodeAssets(
        root,
        { kind: "project", projectId: project.id },
        [asDocs],
      );
      assert.deepEqual(written, ["docs-2/x.txt"]);
      assert.deepEqual(
        listNodeAssets(root, { kind: "project", projectId: project.id }),
        ["docs", "docs-2/", "docs-2/x.txt"],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(staging, { recursive: true, force: true });
    }
  });
});

test("copyFilesIntoNodeAssets skips symlinks and rejects a top-level symlink", async () => {
  await withEnvUserData(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-assets-sym-"));
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-src-sym-"));
    try {
      scaffoldWorkspace(root, { title: "Assets sym" });
      const project = await createProject(root, { title: "P" });
      const target = path.join(staging, "real.txt");
      fs.writeFileSync(target, "hi");
      const link = path.join(staging, "link.txt");
      fs.symlinkSync(target, link);
      assert.throws(
        () =>
          copyFilesIntoNodeAssets(
            root,
            { kind: "project", projectId: project.id },
            [link],
          ),
        /Symlinks are not copied/,
      );

      const folder = path.join(staging, "bag");
      fs.mkdirSync(folder);
      fs.writeFileSync(path.join(folder, "ok.txt"), "ok");
      fs.symlinkSync(target, path.join(folder, "skip.txt"));
      const written = copyFilesIntoNodeAssets(
        root,
        { kind: "project", projectId: project.id },
        [folder],
      );
      assert.deepEqual(written, ["bag/ok.txt"]);
      assert.deepEqual(
        listNodeAssets(root, { kind: "project", projectId: project.id }),
        ["bag/", "bag/ok.txt"],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(staging, { recursive: true, force: true });
    }
  });
});

test("listNodeAssets includes empty folders", async () => {
  await withEnvUserData(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-assets-empty-"));
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-src-empty-"));
    try {
      scaffoldWorkspace(root, { title: "Assets empty" });
      const project = await createProject(root, { title: "P" });
      const empty = path.join(staging, "vacant");
      fs.mkdirSync(empty);
      fs.writeFileSync(path.join(empty, ".DS_Store"), "junk");
      const nested = path.join(staging, "docs");
      fs.mkdirSync(path.join(nested, "hollow"), { recursive: true });
      fs.writeFileSync(path.join(nested, "a.pdf"), "a");

      const writtenEmpty = copyFilesIntoNodeAssets(
        root,
        { kind: "project", projectId: project.id },
        [empty],
      );
      assert.deepEqual(writtenEmpty, []);
      const writtenNested = copyFilesIntoNodeAssets(
        root,
        { kind: "project", projectId: project.id },
        [nested],
      );
      assert.deepEqual(writtenNested, ["docs/a.pdf"]);
      assert.deepEqual(
        listNodeAssets(root, { kind: "project", projectId: project.id }),
        ["docs/", "docs/a.pdf", "docs/hollow/", "vacant/"],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(staging, { recursive: true, force: true });
    }
  });
});

test("copyFilesIntoNodeAssets rejects a folder deeper than max depth", async () => {
  await withEnvUserData(async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-assets-deep-"));
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-src-deep-"));
    try {
      scaffoldWorkspace(root, { title: "Assets deep" });
      const project = await createProject(root, { title: "P" });
      let dir = path.join(staging, "deep");
      fs.mkdirSync(dir);
      for (let i = 0; i < MAX_ASSET_COPY_DEPTH + 1; i += 1) {
        dir = path.join(dir, `l${i}`);
        fs.mkdirSync(dir);
      }
      fs.writeFileSync(path.join(dir, "x.txt"), "x");
      assert.throws(
        () =>
          copyFilesIntoNodeAssets(
            root,
            { kind: "project", projectId: project.id },
            [path.join(staging, "deep")],
          ),
        /max depth/,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(staging, { recursive: true, force: true });
    }
  });
});

test("uniqueAssetFolderName reuses an existing directory", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-folder-uniq-"));
  try {
    fs.mkdirSync(path.join(dir, "docs"));
    assert.equal(uniqueAssetFolderName(dir, "docs"), "docs");
    fs.writeFileSync(path.join(dir, "taken"), "file");
    assert.equal(uniqueAssetFolderName(dir, "taken"), "taken-2");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
