import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  discoverPmWorkspaces,
  MAX_PM_WORKSPACE_DISCOVER_DEPTH,
} from "./discover-pm-workspaces.js";

function withTempRoot(body: (root: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pm-discover-ws-"));
  try {
    body(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function stubWorkspace(dir: string): void {
  fs.mkdirSync(path.join(dir, ".pm"), { recursive: true });
  fs.mkdirSync(path.join(dir, "issue-hierarchy"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".pmws"), "# marker\n", "utf8");
}

test("discoverPmWorkspaces: missing path is empty", () => {
  assert.deepEqual(
    discoverPmWorkspaces(path.join(os.tmpdir(), "pm-discover-missing-nope")),
    [],
  );
});

test("discoverPmWorkspaces: file path is empty", () => {
  withTempRoot((root) => {
    const file = path.join(root, "note.txt");
    fs.writeFileSync(file, "x\n", "utf8");
    assert.deepEqual(discoverPmWorkspaces(file), []);
  });
});

test("discoverPmWorkspaces: scanRoot itself is the only hit", () => {
  withTempRoot((root) => {
    stubWorkspace(root);
    stubWorkspace(path.join(root, "nested"));
    assert.deepEqual(discoverPmWorkspaces(root), [path.resolve(root)]);
  });
});

test("discoverPmWorkspaces: sibling outermost roots", () => {
  withTempRoot((root) => {
    const a = path.join(root, "alpha");
    const b = path.join(root, "beta");
    stubWorkspace(a);
    stubWorkspace(b);
    assert.deepEqual(
      discoverPmWorkspaces(root).slice().sort(),
      [path.resolve(a), path.resolve(b)].sort(),
    );
  });
});

test("discoverPmWorkspaces: does not list a nested library under an outer hit", () => {
  withTempRoot((root) => {
    const outer = path.join(root, "outer");
    stubWorkspace(outer);
    stubWorkspace(path.join(outer, "issue-hierarchy", "proj", "issue", "inner"));
    assert.deepEqual(discoverPmWorkspaces(root), [path.resolve(outer)]);
  });
});

test("discoverPmWorkspaces: skips assets unless scanRoot is that folder", () => {
  withTempRoot((root) => {
    const outer = path.join(root, "outer");
    stubWorkspace(outer);
    const nested = path.join(outer, "issue-hierarchy", "proj", "assets", "lib");
    stubWorkspace(nested);
    assert.deepEqual(discoverPmWorkspaces(root), [path.resolve(outer)]);
    const assets = path.join(outer, "issue-hierarchy", "proj", "assets");
    assert.deepEqual(discoverPmWorkspaces(assets), [path.resolve(nested)]);
  });
});

test("discoverPmWorkspaces: skips node_modules, dist, and dotdirs", () => {
  withTempRoot((root) => {
    stubWorkspace(path.join(root, "node_modules", "pkg"));
    stubWorkspace(path.join(root, "dist", "hidden"));
    stubWorkspace(path.join(root, ".git", "hidden"));
    const visible = path.join(root, "visible");
    stubWorkspace(visible);
    assert.deepEqual(discoverPmWorkspaces(root), [path.resolve(visible)]);
  });
});

test("discoverPmWorkspaces: invalid .pmws is a boundary", () => {
  withTempRoot((root) => {
    const broken = path.join(root, "broken");
    fs.mkdirSync(broken, { recursive: true });
    fs.writeFileSync(path.join(broken, ".pmws"), "# marker\n", "utf8");
    stubWorkspace(path.join(broken, "inside"));
    assert.deepEqual(discoverPmWorkspaces(root), []);
  });
});

test("discoverPmWorkspaces: depth cap includes MAX and skips deeper", () => {
  withTempRoot((root) => {
    let atMax = root;
    for (let i = 0; i < MAX_PM_WORKSPACE_DISCOVER_DEPTH; i++) {
      atMax = path.join(atMax, `d${i}`);
    }
    stubWorkspace(atMax);
    assert.deepEqual(discoverPmWorkspaces(root), [path.resolve(atMax)]);
  });
  withTempRoot((root) => {
    let tooDeep = root;
    for (let i = 0; i < MAX_PM_WORKSPACE_DISCOVER_DEPTH + 1; i++) {
      tooDeep = path.join(tooDeep, `d${i}`);
    }
    stubWorkspace(tooDeep);
    assert.deepEqual(discoverPmWorkspaces(root), []);
  });
});
