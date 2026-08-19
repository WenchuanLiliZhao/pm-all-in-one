import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCliArgs } from "./cli-args.js";

test("value flag accepts nanoid that starts with a dash", () => {
  const id = "-p7Rkr1ks6rjrIk8LvqTV";
  const { flags } = parseCliArgs([
    "issue",
    "create",
    "--project",
    "blwwMj6xHRYLCWXfa9wwl",
    "--parent",
    id,
    "--title",
    "Republish",
  ]);
  assert.equal(flags.parent, id);
  assert.equal(flags.project, "blwwMj6xHRYLCWXfa9wwl");
  assert.equal(flags.title, "Republish");
});

test("equals form still binds leading-dash ids", () => {
  const id = "-p7Rkr1ks6rjrIk8LvqTV";
  const { flags } = parseCliArgs([`--parent=${id}`, "--issue", "3i1XC4mkiSpovaCG_3-Fz"]);
  assert.equal(flags.parent, id);
  assert.equal(flags.issue, "3i1XC4mkiSpovaCG_3-Fz");
});

test("boolean flags stay boolean when followed by another option", () => {
  const { flags } = parseCliArgs(["issue", "delete", "--force", "--json"]);
  assert.equal(flags.force, true);
  assert.equal(flags.json, true);
});

test("leading-dash id as positional is not treated as a short option", () => {
  const id = "-p7Rkr1ks6rjrIk8LvqTV";
  const { _, flags } = parseCliArgs(["adopt", id]);
  assert.deepEqual(_, ["adopt", id]);
  assert.deepEqual(flags, {});
});

test("short -p accepts leading-dash project id", () => {
  const id = "-p7Rkr1ks6rjrIk8LvqTV";
  const { flags } = parseCliArgs(["issue", "list", "-p", id]);
  assert.equal(flags.p, id);
});

test("--body is a value flag", () => {
  const { flags } = parseCliArgs([
    "handoff",
    "create",
    "--body",
    "Hello Oliver",
    "--body-file",
    "/tmp/note.md",
  ]);
  assert.equal(flags.body, "Hello Oliver");
  assert.equal(flags["body-file"], "/tmp/note.md");
});

test("--index is a value flag", () => {
  const { flags } = parseCliArgs([
    "wiki",
    "move",
    "--id",
    "V1StGXR8_Z5jdHi6B-myT",
    "--parent",
    "root",
    "--index",
    "0",
  ]);
  assert.equal(flags.index, "0");
  assert.equal(flags.id, "V1StGXR8_Z5jdHi6B-myT");
  assert.equal(flags.parent, "root");
});
