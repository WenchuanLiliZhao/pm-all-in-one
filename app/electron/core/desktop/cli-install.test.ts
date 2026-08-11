import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { chooseCliDir, installCliLink } from "./cli-install.js";
import { ensureLocalPmShim, SHIM_MARKER } from "./local-pm-shim.js";

function tmpdir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("installCliLink links the shim into the chosen dir", () => {
  const userData = tmpdir("local-pm-userdata-");
  const binDir = tmpdir("local-pm-bin-");
  try {
    const shim = ensureLocalPmShim(userData);
    const result = installCliLink(shim.shimPath, binDir);

    assert.equal(result.linkPath, path.join(binDir, "pm-all-in-one"));
    assert.equal(result.replaced, false);
    assert.equal(fs.realpathSync(result.linkPath), fs.realpathSync(shim.shimPath));
    assert.ok(fs.readFileSync(result.linkPath, "utf8").includes(SHIM_MARKER));
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test("installCliLink replaces its own earlier link", () => {
  const userData = tmpdir("local-pm-userdata-");
  const binDir = tmpdir("local-pm-bin-");
  try {
    const shim = ensureLocalPmShim(userData);
    installCliLink(shim.shimPath, binDir);
    const again = installCliLink(shim.shimPath, binDir);

    assert.equal(again.replaced, true);
    assert.equal(fs.realpathSync(again.linkPath), fs.realpathSync(shim.shimPath));
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test("installCliLink refuses to clobber a foreign file", () => {
  const userData = tmpdir("local-pm-userdata-");
  const binDir = tmpdir("local-pm-bin-");
  const foreign = path.join(binDir, "pm-all-in-one");
  try {
    const shim = ensureLocalPmShim(userData);
    fs.writeFileSync(foreign, "#!/bin/sh\necho someone else's tool\n", "utf8");

    assert.throws(() => installCliLink(shim.shimPath, binDir), /not created by pm-all-in-one/);
    assert.ok(fs.readFileSync(foreign, "utf8").includes("someone else"));
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test("installCliLink reports a missing shim instead of linking", () => {
  const binDir = tmpdir("local-pm-bin-");
  try {
    assert.throws(
      () => installCliLink(path.join(binDir, "absent", "pm-all-in-one"), binDir),
      /Relaunch the app/,
    );
  } finally {
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test("installCliLink flags a non-PATH dir so the caller can advise", () => {
  const userData = tmpdir("local-pm-userdata-");
  const binDir = tmpdir("local-pm-bin-");
  try {
    const shim = ensureLocalPmShim(userData);
    assert.equal(installCliLink(shim.shimPath, binDir).onPath, false);
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test("chooseCliDir falls back to a per-user bin dir", () => {
  const dir = chooseCliDir();
  assert.ok(path.isAbsolute(dir));
  assert.equal(path.basename(dir), "bin");
});

test("installCliLink creates the target dir when absent", () => {
  const userData = tmpdir("local-pm-userdata-");
  const parent = tmpdir("local-pm-bin-");
  const binDir = path.join(parent, "nested", "bin");
  try {
    const shim = ensureLocalPmShim(userData);
    const result = installCliLink(shim.shimPath, binDir);

    assert.ok(fs.existsSync(result.linkPath));
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
