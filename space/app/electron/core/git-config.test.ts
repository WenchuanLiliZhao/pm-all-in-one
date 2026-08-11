import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { readGitIdentity } from "./git-config.js";

test("readGitIdentity returns nulls for non-repo without throwing", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-nogit-"));
  try {
    const identity = await readGitIdentity(root);
    assert.equal(identity.name, null);
    assert.equal(identity.email, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
