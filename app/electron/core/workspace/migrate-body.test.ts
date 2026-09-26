import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { listLegacyBodyFiles, migrateBodyFiles } from "./migrate-body.js";
import { scanStrays } from "./doctor.js";

const PROJECT_ID = "V1StGXR8_Z5jdHi6B-myT";
const ISSUE_ID = "abcDEF0123456789xyz01";
const WIKI_ID = "wikiId21charsZZZZZZZZ";

function scaffold(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pm-migrate-body-"));
  fs.mkdirSync(path.join(root, ".pm"), { recursive: true });
  fs.writeFileSync(path.join(root, "workspace.ts"), 'export const props = { title: "t", createdDate: "2026-01-01" } as const;\n');
  fs.writeFileSync(path.join(root, "README.md"), "home\n");
  const project = path.join(root, "issue-hierarchy", PROJECT_ID);
  fs.mkdirSync(path.join(project, ISSUE_ID), { recursive: true });
  fs.writeFileSync(path.join(project, "project.ts"), 'export const props = { title: "p" } as const;\n');
  fs.writeFileSync(path.join(project, "README.md"), "project\n");
  fs.writeFileSync(path.join(project, ISSUE_ID, "props.ts"), "export const props = {} as const;\n");
  fs.writeFileSync(path.join(project, ISSUE_ID, "README.md"), "issue\n");
  // An ordinary README under assets/ is not a node body.
  fs.mkdirSync(path.join(project, ISSUE_ID, "assets", "cut"), { recursive: true });
  fs.writeFileSync(path.join(project, ISSUE_ID, "assets", "cut", "README.md"), "# cut\n");
  const wiki = path.join(root, "wiki", WIKI_ID);
  fs.mkdirSync(wiki, { recursive: true });
  fs.writeFileSync(path.join(wiki, "props.ts"), "export const props = {} as const;\n");
  fs.writeFileSync(path.join(wiki, "README.md"), "wiki\n");
  fs.writeFileSync(path.join(root, "wiki", "sidebar.ts"), "export const props = [];\n");
  return root;
}

test("migrateBodyFiles renames README.md to body.md at every node, not under assets", () => {
  const root = scaffold();
  const report = migrateBodyFiles(root);
  assert.deepEqual(report.conflicts, []);
  assert.deepEqual(
    report.renamed.sort(),
    [".", `issue-hierarchy/${PROJECT_ID}`, `issue-hierarchy/${PROJECT_ID}/${ISSUE_ID}`, `wiki/${WIKI_ID}`].sort(),
  );
  assert.equal(fs.readFileSync(path.join(root, "body.md"), "utf8"), "home\n");
  assert.equal(fs.existsSync(path.join(root, "README.md")), false);
  assert.equal(
    fs.readFileSync(path.join(root, "issue-hierarchy", PROJECT_ID, ISSUE_ID, "body.md"), "utf8"),
    "issue\n",
  );
  assert.equal(
    fs.existsSync(path.join(root, "issue-hierarchy", PROJECT_ID, ISSUE_ID, "assets", "cut", "README.md")),
    true,
  );
  assert.deepEqual(listLegacyBodyFiles(root), []);
  assert.deepEqual(migrateBodyFiles(root), { renamed: [], conflicts: [] });
});

test("a node with both files is a conflict and a doctor warning", () => {
  const root = scaffold();
  const wiki = path.join(root, "wiki", WIKI_ID);
  fs.writeFileSync(path.join(wiki, "body.md"), "new\n");
  const report = migrateBodyFiles(root);
  assert.deepEqual(report.conflicts, [`wiki/${WIKI_ID}`]);
  assert.equal(fs.readFileSync(path.join(wiki, "body.md"), "utf8"), "new\n");
  assert.equal(fs.readFileSync(path.join(wiki, "README.md"), "utf8"), "wiki\n");
  const doctor = scanStrays(root);
  const legacy = doctor.warnings.filter((w) => w.kind === "body-legacy-readme");
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0]?.relPath, path.join("wiki", WIKI_ID, "README.md"));
  assert.match(legacy[0]?.message ?? "", /both/);
});

test("doctor points a still-legacy workspace at migrate body", () => {
  const root = scaffold();
  const doctor = scanStrays(root);
  const legacy = doctor.warnings.filter((w) => w.kind === "body-legacy-readme");
  assert.equal(legacy.length, 4);
  assert.match(legacy[0]?.message ?? "", /migrate body/);
});
