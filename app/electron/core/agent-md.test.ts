import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkAgentMd,
  parseAgentMdRev,
  stripAgentMdStamp,
} from "./agent-md.js";

const sourceTemplate = path.resolve(process.cwd(), "electron/workspace-template");

function withSourceTemplate<T>(fn: () => T): T {
  const prev = process.env.LOCAL_PM_WORKSPACE_TEMPLATE;
  process.env.LOCAL_PM_WORKSPACE_TEMPLATE = sourceTemplate;
  try {
    return fn();
  } finally {
    if (prev === undefined) {
      delete process.env.LOCAL_PM_WORKSPACE_TEMPLATE;
    } else {
      process.env.LOCAL_PM_WORKSPACE_TEMPLATE = prev;
    }
  }
}

function tmpWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pm-agent-md-"));
  fs.mkdirSync(path.join(root, ".pm"), { recursive: true });
  return root;
}

test("parseAgentMdRev and stripAgentMdStamp", () => {
  const stamped =
    "<!-- local-pm agent.md rev 1 — product-owned; do not hand-edit. -->\n# Agent rules\n";
  assert.equal(parseAgentMdRev(stamped), 1);
  assert.equal(stripAgentMdStamp(stamped), "# Agent rules\n");
  assert.equal(parseAgentMdRev("# no stamp\n"), null);
  assert.equal(stripAgentMdStamp("# no stamp\n"), "# no stamp\n");
});

test("checkAgentMd: match / modified / outdated / missing", () => {
  withSourceTemplate(() => {
    const factory = fs.readFileSync(
      path.join(sourceTemplate, ".pm", "agent.md"),
      "utf8",
    );
    // The shipped rev is pinned in workspace-template.test.ts; here only its
    // relation to the workspace copy matters.
    const factoryRev = parseAgentMdRev(factory);
    assert.notEqual(factoryRev, null);

    const root = tmpWorkspace();
    try {
      assert.equal(checkAgentMd(root), "missing");

      fs.writeFileSync(path.join(root, ".pm", "agent.md"), factory, "utf8");
      assert.equal(checkAgentMd(root), "match");

      const body = stripAgentMdStamp(factory);
      fs.writeFileSync(
        path.join(root, ".pm", "agent.md"),
        `<!-- local-pm agent.md rev ${factoryRev} — product-owned. -->\n${body}\n\n<!-- user tweak -->\n`,
        "utf8",
      );
      assert.equal(checkAgentMd(root), "modified");

      fs.writeFileSync(
        path.join(root, ".pm", "agent.md"),
        "# Agent rules (legacy, no stamp)\n",
        "utf8",
      );
      assert.equal(checkAgentMd(root), "outdated");

      fs.writeFileSync(
        path.join(root, ".pm", "agent.md"),
        `<!-- local-pm agent.md rev 0 — old. -->\n${body}`,
        "utf8",
      );
      assert.equal(checkAgentMd(root), "outdated");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
