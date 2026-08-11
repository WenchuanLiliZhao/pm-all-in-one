import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { scaffoldWorkspace } from "./scaffold-workspace.js";
import { workspaceTemplateDir } from "./workspace-template.js";

const sourceTemplate = path.resolve(process.cwd(), "electron/workspace-template");
const sourceProjectTemplate = path.resolve(
  process.cwd(),
  "electron/project-template",
);

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pm-workspace-template-"));
}

function withSourceTemplates<T>(fn: () => T): T {
  const prevWs = process.env.LOCAL_PM_WORKSPACE_TEMPLATE;
  const prevProj = process.env.LOCAL_PM_PROJECT_TEMPLATE;
  process.env.LOCAL_PM_WORKSPACE_TEMPLATE = sourceTemplate;
  process.env.LOCAL_PM_PROJECT_TEMPLATE = sourceProjectTemplate;
  try {
    return fn();
  } finally {
    if (prevWs === undefined) {
      delete process.env.LOCAL_PM_WORKSPACE_TEMPLATE;
    } else {
      process.env.LOCAL_PM_WORKSPACE_TEMPLATE = prevWs;
    }
    if (prevProj === undefined) {
      delete process.env.LOCAL_PM_PROJECT_TEMPLATE;
    } else {
      process.env.LOCAL_PM_PROJECT_TEMPLATE = prevProj;
    }
  }
}

test("scaffold copies template files and skips .gitkeep", () => {
  withSourceTemplates(() => {
    const root = tmpRoot();
    try {
      scaffoldWorkspace(root, { title: "Template scaffold" });

      assert.ok(fs.existsSync(path.join(root, "AGENTS.md")));
      assert.ok(fs.existsSync(path.join(root, ".pm", "agent.md")));
      assert.ok(fs.existsSync(path.join(root, ".pm", "view-orders.json")));
      assert.ok(fs.existsSync(path.join(root, ".pm", "views.json")));
      assert.ok(fs.existsSync(path.join(root, "wiki", "sidebar.ts")));
      assert.ok(fs.existsSync(path.join(root, ".gitignore")));
      const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
      assert.ok(gitignore.includes(".pm/local.json"));
      assert.ok(gitignore.includes(".pm/local.md"));
      assert.ok(fs.existsSync(path.join(root, "workspace.ts")));
      assert.ok(fs.statSync(path.join(root, "members")).isDirectory());
      assert.ok(fs.statSync(path.join(root, "handoffs")).isDirectory());
      assert.ok(fs.statSync(path.join(root, "issue-hierarchy")).isDirectory());

      const placementSkill = path.join(
        root,
        ".agents",
        "skills",
        "pm-content-placement",
        "SKILL.md",
      );
      const createSkill = path.join(
        root,
        ".agents",
        "skills",
        "pm-create-skill",
        "SKILL.md",
      );
      assert.ok(fs.existsSync(placementSkill));
      assert.ok(fs.existsSync(createSkill));
      const placementBody = fs.readFileSync(placementSkill, "utf8");
      const createBody = fs.readFileSync(createSkill, "utf8");
      assert.match(placementBody, /^---\nname: pm-content-placement\n/);
      assert.match(createBody, /^---\nname: pm-create-skill\n/);
      assert.ok(placementBody.includes("What goes where"));
      assert.ok(createBody.includes(".agents/skills/"));

      assert.equal(
        fs.existsSync(path.join(root, "members", ".gitkeep")),
        false,
      );
      assert.equal(
        fs.existsSync(path.join(root, "handoffs", ".gitkeep")),
        false,
      );
      assert.equal(
        fs.existsSync(path.join(root, "issue-hierarchy", ".gitkeep")),
        false,
      );

      const agent = fs.readFileSync(path.join(root, ".pm", "agent.md"), "utf8");
      const templateAgent = fs.readFileSync(
        path.join(workspaceTemplateDir(), ".pm", "agent.md"),
        "utf8",
      );
      assert.equal(agent, templateAgent);
      assert.match(
        agent,
        /^<!-- local-pm agent\.md rev 3 — product-owned;/,
      );
      assert.ok(agent.includes("Install Command Line Tool"));
      assert.ok(agent.includes("**When no CLI is reachable, stop and say so.**"));
      assert.ok(agent.includes("## Mentions (live cross-references)"));
      assert.ok(agent.includes("**Never** wrap a concrete locator"));
      assert.ok(agent.includes("## Custom conventions"));
      assert.ok(agent.includes("local.md"));
      assert.ok(agent.includes("machine-absolute code paths"));
      assert.equal(agent.includes("## What goes where"), false);
      assert.equal(agent.includes("What goes where (project / epic / wiki)"), false);

      const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
      assert.ok(agents.includes("bare text, never backticks"));
      assert.ok(agents.includes("pm-content-placement"));
      assert.ok(agents.includes(".agents/skills/"));
      assert.equal(agents.includes("see `.pm/agent.md`."), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

test("scaffold with seed project copies project-template", () => {
  withSourceTemplates(() => {
    const root = tmpRoot();
    try {
      scaffoldWorkspace(root, {
        title: "Seeded",
        seedProject: { title: "My Project" },
      });
      const projects = fs
        .readdirSync(path.join(root, "issue-hierarchy"), {
          withFileTypes: true,
        })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
      assert.equal(projects.length, 1);
      const projectDir = path.join(root, "issue-hierarchy", projects[0]!);
      assert.ok(fs.existsSync(path.join(projectDir, "project.ts")));
      assert.ok(fs.existsSync(path.join(projectDir, "custom-props.ts")));
      assert.ok(fs.existsSync(path.join(projectDir, "README.md")));
      assert.ok(fs.existsSync(path.join(projectDir, "schema.d.ts")));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
