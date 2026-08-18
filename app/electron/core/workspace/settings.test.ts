import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  MAX_RECENT_WORKSPACES,
  clearRecentWorkspaceRoots,
  listRecentWorkspaceRoots,
  readSettings,
  removeRecentWorkspaceRoot,
  setLastWorkspaceRoot,
} from "./settings.js";

function withUserData(fn: () => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pm-settings-"));
  const prev = process.env.LOCAL_PM_USER_DATA;
  process.env.LOCAL_PM_USER_DATA = dir;
  try {
    fn();
  } finally {
    if (prev === undefined) {
      delete process.env.LOCAL_PM_USER_DATA;
    } else {
      process.env.LOCAL_PM_USER_DATA = prev;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("setLastWorkspaceRoot prepends and dedupes the recent list", () => {
  withUserData(() => {
    setLastWorkspaceRoot("/tmp/pm-a/one");
    setLastWorkspaceRoot("/tmp/pm-a/two");
    setLastWorkspaceRoot("/tmp/pm-a/one");

    assert.deepEqual(listRecentWorkspaceRoots(), [
      path.resolve("/tmp/pm-a/one"),
      path.resolve("/tmp/pm-a/two"),
    ]);
    assert.equal(readSettings().lastWorkspaceRoot, path.resolve("/tmp/pm-a/one"));
  });
});

test("listRecentWorkspaceRoots migrates last-only settings.json", () => {
  withUserData(() => {
    const file = path.join(process.env.LOCAL_PM_USER_DATA!, "settings.json");
    fs.writeFileSync(
      file,
      `${JSON.stringify({ lastWorkspaceRoot: "/tmp/pm-legacy" }, null, 2)}\n`,
      "utf8",
    );

    assert.deepEqual(listRecentWorkspaceRoots(), [
      path.resolve("/tmp/pm-legacy"),
    ]);
  });
});

test("setLastWorkspaceRoot caps the recent list", () => {
  withUserData(() => {
    for (let i = 0; i < MAX_RECENT_WORKSPACES + 3; i += 1) {
      setLastWorkspaceRoot(`/tmp/pm-cap/${i}`);
    }
    const recent = listRecentWorkspaceRoots();
    assert.equal(recent.length, MAX_RECENT_WORKSPACES);
    assert.equal(recent[0], path.resolve(`/tmp/pm-cap/${MAX_RECENT_WORKSPACES + 2}`));
    assert.ok(!recent.includes(path.resolve("/tmp/pm-cap/0")));
  });
});

test("clearRecentWorkspaceRoots empties the menu list but keeps last", () => {
  withUserData(() => {
    setLastWorkspaceRoot("/tmp/pm-keep/one");
    setLastWorkspaceRoot("/tmp/pm-keep/two");
    clearRecentWorkspaceRoots();

    assert.deepEqual(listRecentWorkspaceRoots(), []);
    assert.equal(readSettings().lastWorkspaceRoot, path.resolve("/tmp/pm-keep/two"));
  });
});

test("removeRecentWorkspaceRoot drops one path", () => {
  withUserData(() => {
    setLastWorkspaceRoot("/tmp/pm-rm/one");
    setLastWorkspaceRoot("/tmp/pm-rm/two");
    removeRecentWorkspaceRoot("/tmp/pm-rm/one");

    assert.deepEqual(listRecentWorkspaceRoots(), [path.resolve("/tmp/pm-rm/two")]);
  });
});
