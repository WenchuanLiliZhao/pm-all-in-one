import assert from "node:assert/strict";
import { test } from "node:test";

import { slugifyWorkspaceFolder } from "./slugify-folder.js";

test("slugifyWorkspaceFolder basic", () => {
  assert.equal(slugifyWorkspaceFolder("My Workspace"), "my-workspace");
  assert.equal(slugifyWorkspaceFolder("  Hello World  "), "hello-world");
});

test("slugifyWorkspaceFolder strips unsafe chars", () => {
  assert.equal(slugifyWorkspaceFolder("Foo/Bar\\Baz"), "foo-bar-baz");
  assert.equal(slugifyWorkspaceFolder("a@b#c"), "a-b-c");
});

test("slugifyWorkspaceFolder unicode → ascii-ish", () => {
  assert.equal(slugifyWorkspaceFolder("Café"), "cafe");
  assert.equal(slugifyWorkspaceFolder("项目"), "workspace");
});

test("slugifyWorkspaceFolder empty / reserved", () => {
  assert.equal(slugifyWorkspaceFolder(""), "workspace");
  assert.equal(slugifyWorkspaceFolder("   "), "workspace");
  assert.equal(slugifyWorkspaceFolder("..."), "workspace");
  assert.equal(slugifyWorkspaceFolder("CON"), "workspace");
});
