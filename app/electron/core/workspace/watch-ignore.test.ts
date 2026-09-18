import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { isIgnoredWatchDirName, isIgnoredWatchPath } from "./watch-ignore.js";

const root = path.join("/tmp", "pm-watch-ws");

function under(...parts: string[]): string {
  return path.join(root, ...parts);
}

test("isIgnoredWatchPath: PM source files stay watched", () => {
  assert.equal(isIgnoredWatchPath(root, under("workspace.ts")), false);
  assert.equal(isIgnoredWatchPath(root, under("README.md")), false);
  assert.equal(
    isIgnoredWatchPath(root, under("issue-hierarchy", "projId21charsXXXXXXX", "project.ts")),
    false,
  );
  assert.equal(
    isIgnoredWatchPath(
      root,
      under("issue-hierarchy", "projId21charsXXXXXXX", "issId21charsYYYYYYYY", "props.ts"),
    ),
    false,
  );
  assert.equal(
    isIgnoredWatchPath(root, under("wiki", "wikiId21charsZZZZZZZZ", "README.md")),
    false,
  );
});

test("isIgnoredWatchPath: skips .pm, node_modules, assets, and dotdirs", () => {
  assert.equal(isIgnoredWatchPath(root, under(".pm", "index.json")), true);
  assert.equal(
    isIgnoredWatchPath(
      root,
      under("issue-hierarchy", "proj", "assets", "web-app", "node_modules", "chokidar", "index.js"),
    ),
    true,
  );
  assert.equal(
    isIgnoredWatchPath(
      root,
      under("issue-hierarchy", "proj", "assets", "web-app", ".next", "trace"),
    ),
    true,
  );
  assert.equal(
    isIgnoredWatchPath(root, under("issue-hierarchy", "proj", "assets", "nested", ".git", "HEAD")),
    true,
  );
  assert.equal(
    isIgnoredWatchPath(root, under("issue-hierarchy", "proj", "issueA", "assets", "photo.png")),
    true,
  );
  assert.equal(isIgnoredWatchPath(root, under("assets", "logo.png")), true);
});

test("isIgnoredWatchPath: workspace root itself is not ignored", () => {
  assert.equal(isIgnoredWatchPath(root, root), false);
});

test("isIgnoredWatchDirName: junk names and dotdirs", () => {
  assert.equal(isIgnoredWatchDirName("node_modules"), true);
  assert.equal(isIgnoredWatchDirName("assets"), true);
  assert.equal(isIgnoredWatchDirName(".git"), true);
  assert.equal(isIgnoredWatchDirName("wiki"), false);
});
