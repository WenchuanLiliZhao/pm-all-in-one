import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { scaffoldWorkspace } from "./scaffold-workspace.js";
import { writeLocalConfig } from "./local-config.js";
import {
  FENCE_SOFT_WARNING_KINDS,
  findFencedBlocks,
  listMarkdownBodies,
  scanFenceValidators,
} from "./fence-validators.js";
import { scanWorkspace } from "./doctor.js";

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pm-fence-val-"));
}

function writeValidator(root: string, rel: string, source: string): string {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, source, "utf8");
  return abs;
}

const DEMO_VALIDATOR = `export function validate({ body }) {
  const findings = [];
  const lines = body.split(/\\n/);
  if (!/(^|\\n)expression\\s*:/.test(body)) {
    findings.push({ message: "missing expression", line: 1 });
  }
  lines.forEach((line, i) => {
    if (line.includes("not-a-rule")) {
      findings.push({ message: "rule name not allowed", line: i + 1 });
    }
  });
  return findings;
}
`;

test("findFencedBlocks: lang is the first info token; lines are file-relative", () => {
  const src = `intro

\`\`\`demo riemann
expression: x
rule: left
\`\`\`

after
`;
  const [block] = findFencedBlocks(src);
  assert.equal(block?.lang, "demo");
  assert.equal(block?.info, "demo riemann");
  assert.equal(block?.body, "expression: x\nrule: left");
  assert.equal(block?.openLine, 3);
  assert.equal(block?.bodyStartLine, 4);
});

test("findFencedBlocks: skips unclosed and empty-lang fences", () => {
  const src = "```js\nconst x = 1;\n```\n\n```\nplain\n```\n\n```todo\nno close\n";
  const blocks = findFencedBlocks(src);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]?.lang, "js");
  assert.equal(blocks[1]?.lang, "");
});

test("scanFenceValidators: no declaration → no warnings", async () => {
  const root = tmpRoot();
  try {
    scaffoldWorkspace(root, { seedProject: { title: "T" } });
    const warnings = await scanFenceValidators(root);
    assert.deepEqual(warnings, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scanFenceValidators: declared but untrusted does not import the module", async () => {
  const root = tmpRoot();
  try {
    scaffoldWorkspace(root, { seedProject: { title: "T" } });
    writeValidator(
      root,
      "fence-validators/demo.mjs",
      `throw new Error("must not load");\n`,
    );
    fs.writeFileSync(
      path.join(root, ".pm", "fence-validators.json"),
      JSON.stringify({
        validators: [{ lang: "demo", module: "fence-validators/demo.mjs" }],
      }),
      "utf8",
    );
    const warnings = await scanFenceValidators(root);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]?.kind, "fence-validators-untrusted");
    assert.equal(FENCE_SOFT_WARNING_KINDS.has("fence-validators-untrusted"), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scanFenceValidators: trusted bad fence reports file-relative line", async () => {
  const root = tmpRoot();
  try {
    scaffoldWorkspace(root, { seedProject: { title: "T" } });
    writeValidator(root, "fence-validators/demo.mjs", DEMO_VALIDATOR);
    fs.writeFileSync(
      path.join(root, ".pm", "fence-validators.json"),
      JSON.stringify({
        validators: [{ lang: "demo", module: "fence-validators/demo.mjs" }],
      }),
      "utf8",
    );
    writeLocalConfig(root, { trustFenceValidators: true });
    fs.writeFileSync(
      path.join(root, "README.md"),
      `# Home

A figure:

\`\`\`demo riemann
steps: 4
rule: not-a-rule
\`\`\`
`,
      "utf8",
    );
    const warnings = await scanFenceValidators(root);
    const invalid = warnings.filter((w) => w.kind === "fence-invalid");
    assert.ok(invalid.length >= 2, JSON.stringify(invalid));
    const missing = invalid.find((w) => w.message === "missing expression");
    const rule = invalid.find((w) => w.message === "rule name not allowed");
    assert.equal(missing?.relPath, "README.md");
    assert.equal(missing?.line, 6);
    assert.equal(rule?.line, 7);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scanFenceValidators: undeclared langs are ignored (CLI has no fence DSL)", async () => {
  const root = tmpRoot();
  try {
    scaffoldWorkspace(root, { seedProject: { title: "T" } });
    writeValidator(root, "fence-validators/demo.mjs", DEMO_VALIDATOR);
    fs.writeFileSync(
      path.join(root, ".pm", "fence-validators.json"),
      JSON.stringify({
        validators: [{ lang: "demo", module: "fence-validators/demo.mjs" }],
      }),
      "utf8",
    );
    writeLocalConfig(root, { trustFenceValidators: true });
    fs.writeFileSync(
      path.join(root, "README.md"),
      "```plot riemann\nexpression: x\n```\n",
      "utf8",
    );
    const warnings = await scanFenceValidators(root);
    assert.equal(
      warnings.filter((w) => w.kind === "fence-invalid").length,
      0,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scanFenceValidators: module outside workspace is rejected", async () => {
  const root = tmpRoot();
  try {
    scaffoldWorkspace(root, { seedProject: { title: "T" } });
    fs.writeFileSync(
      path.join(root, ".pm", "fence-validators.json"),
      JSON.stringify({
        validators: [{ lang: "demo", module: "../escape.mjs" }],
      }),
      "utf8",
    );
    const warnings = await scanFenceValidators(root, {
      trustFenceValidators: true,
    });
    assert.equal(warnings[0]?.kind, "fence-validator-load-failed");
    assert.match(warnings[0]?.message ?? "", /outside the workspace/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scanWorkspace merges fence warnings; soft kinds stay warnings", async () => {
  const root = tmpRoot();
  try {
    scaffoldWorkspace(root, { seedProject: { title: "T" } });
    writeValidator(root, "fence-validators/demo.mjs", DEMO_VALIDATOR);
    fs.writeFileSync(
      path.join(root, ".pm", "fence-validators.json"),
      JSON.stringify({
        validators: [{ lang: "demo", module: "fence-validators/demo.mjs" }],
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "README.md"),
      "```demo\nsteps: 1\n```\n",
      "utf8",
    );
    const untrusted = await scanWorkspace(root);
    assert.ok(
      untrusted.warnings.some((w) => w.kind === "fence-validators-untrusted"),
    );
    const trusted = await scanWorkspace(root, { trustFenceValidators: true });
    assert.ok(trusted.warnings.some((w) => w.kind === "fence-invalid"));
    assert.equal(trusted.strays.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("listMarkdownBodies includes Home README", () => {
  const root = tmpRoot();
  try {
    scaffoldWorkspace(root, { seedProject: { title: "T" } });
    const files = listMarkdownBodies(root);
    assert.ok(files.some((f) => path.basename(f) === "README.md"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
