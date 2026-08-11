/**
 * Filesystem-shape checks only.
 *
 * Flat storage makes two of the old checks unnecessary: two issues cannot claim
 * the same id (a directory name is unique within its parent) and nothing can be
 * nested too deep (there is no nesting). Relationship problems — wrong parent
 * level, dangling parent, cycles — are not shape problems and live in
 * `ladder.ts`, reported per issue.
 * ↔ agent-md.ts — agent-md-modified / agent-md-outdated warnings
 */
import fs from "node:fs";
import path from "node:path";

import { isBareNumericDir, isValidEntityId, parseId, type EntityId } from "./dir-id.js";
import {
  collectSidebarWikiNodeIds,
  wikiNodeDirPath,
  wikiDir,
  listWikiNodeIdsOnDisk,
  listInvalidWikiNodeNames,
  readSidebarResultSync,
  sidebarPath,
} from "./wiki.js";
import {
  isMembership,
  listInvalidMemberNames,
  listMemberIdsOnDisk,
  memberDirPath,
  memberPropsPath,
  membersDir,
} from "./members.js";
import {
  handoffPropsPath,
  handoffsDir,
  listHandoffIdsOnDisk,
  listInvalidHandoffNames,
} from "./handoffs.js";
import { allocateIssueId, hierarchyRoot } from "./ids.js";
import { issueLinkSyntax } from "./links.js";
import { evaluatePropsExportSync, writePropsTs } from "./props-load.js";
import { DEFAULT_ISSUE_PRIORITY } from "./issue-priority.js";
import { DEFAULT_ISSUE_STATUS } from "./issue-status.js";
import { LEVEL_TYPE_NAME } from "./schema-dts.js";
import { isIsoDateTimeZ, nowIsoUtcZ } from "./timestamps.js";
import { agentMdPath, checkAgentMd } from "./agent-md.js";

export type StrayKind = "invalid-name" | "missing-props" | "bare-numeric";

export interface StrayEntry {
  path: string;
  relPath: string;
  kind: StrayKind;
  message: string;
  /** Can be adopted in place (sits directly under a valid project). */
  adoptable: boolean;
  projectId?: EntityId;
}

export type DoctorWarningKind =
  | "missing-project-ts"
  | "wiki-broken-ref"
  | "wiki-unlisted"
  | "wiki-invalid-name"
  | "wiki-sidebar-unreadable"
  | "member-broken-ref"
  | "member-invalid-name"
  | "assignee-left-member"
  | "handoff-invalid-name"
  | "handoff-broken-ref"
  | "props-timestamp-missing"
  | "props-timestamp-malformed"
  | "agent-md-modified"
  | "agent-md-outdated";

export interface DoctorWarning {
  kind: DoctorWarningKind;
  message: string;
  path?: string;
  relPath?: string;
}

export interface DoctorReport {
  strays: StrayEntry[];
  warnings: DoctorWarning[];
}

export interface AdoptResult {
  projectId: EntityId;
  issueId: EntityId;
  path: string;
  relPath: string;
  ref: string;
}

function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir).filter((name) => {
    if (name === ".pm") {
      return false;
    }
    return fs.statSync(path.join(dir, name)).isDirectory();
  });
}

function isValidProjectDir(dir: string): boolean {
  return (
    parseId(path.basename(dir)) !== null &&
    fs.existsSync(path.join(dir, "project.ts"))
  );
}

/** Directories under `issue-hierarchy/` that are not projects or issues. */
export function scanStrays(workspaceRoot: string): DoctorReport {
  const strays: StrayEntry[] = [];
  const warnings: DoctorWarning[] = [];
  const root = hierarchyRoot(workspaceRoot);

  if (fs.existsSync(root)) {
    for (const name of listDirs(root)) {
      const projectDir = path.join(root, name);
      const rel = path.relative(workspaceRoot, projectDir);

      if (isBareNumericDir(name)) {
        strays.push({
          path: projectDir,
          relPath: rel,
          kind: "bare-numeric",
          message: `Bare numeric id (pre-token layout): ${name}. Rebuild the workspace; dual-format is not supported.`,
          adoptable: false,
        });
        continue;
      }

      const projectId = parseId(name);

      if (projectId === null) {
        strays.push({
          path: projectDir,
          relPath: rel,
          kind: "invalid-name",
          message: `Project directory name is not a nanoid(21) entity id: ${name}`,
          adoptable: false,
        });
        continue;
      }

      if (!fs.existsSync(path.join(projectDir, "project.ts"))) {
        warnings.push({
          kind: "missing-project-ts",
          message: `Looks like a project dir but has no project.ts: ${name}`,
          path: projectDir,
          relPath: rel,
        });
      }

      for (const childName of listDirs(projectDir)) {
        const dir = path.join(projectDir, childName);
        const childRel = path.relative(workspaceRoot, dir);
        if (isBareNumericDir(childName)) {
          strays.push({
            path: dir,
            relPath: childRel,
            kind: "bare-numeric",
            message: `Bare numeric id (pre-token layout): ${childName}`,
            adoptable: false,
            projectId,
          });
          continue;
        }
        if (parseId(childName) === null) {
          strays.push({
            path: dir,
            relPath: childRel,
            kind: "invalid-name",
            message: `Not a nanoid(21) entity id: ${childName}`,
            adoptable: true,
            projectId,
          });
          continue;
        }
        if (!fs.existsSync(path.join(dir, "props.ts"))) {
          strays.push({
            path: dir,
            relPath: childRel,
            kind: "missing-props",
            message: `Id directory with no props.ts: ${childName}`,
            adoptable: true,
            projectId,
          });
        }
      }
    }
  }

  appendWikiWarnings(workspaceRoot, warnings);
  appendMemberWarnings(workspaceRoot, warnings);
  appendHandoffWarnings(workspaceRoot, warnings);
  appendAgentMdWarnings(workspaceRoot, warnings);
  return { strays, warnings };
}

function appendAgentMdWarnings(
  workspaceRoot: string,
  warnings: DoctorWarning[],
): void {
  const status = checkAgentMd(workspaceRoot);
  const file = agentMdPath(workspaceRoot);
  const rel = path.relative(workspaceRoot, file);
  if (status === "modified") {
    warnings.push({
      kind: "agent-md-modified",
      message:
        ".pm/agent.md was edited at the same product rev as the shipped template. Restore from template or move conventions into .agents/skills/custom/.",
      path: file,
      relPath: rel,
    });
    return;
  }
  if (status === "outdated" || status === "missing") {
    warnings.push({
      kind: "agent-md-outdated",
      message:
        status === "missing"
          ? ".pm/agent.md is missing; new workspaces ship it from electron/workspace-template/."
          : ".pm/agent.md is missing a current rev stamp or lags the shipped template (detection only — no auto-refresh).",
      path: file,
      relPath: rel,
    });
  }
}

function appendWikiWarnings(
  workspaceRoot: string,
  warnings: DoctorWarning[],
): void {
  if (!fs.existsSync(wikiDir(workspaceRoot))) {
    return;
  }
  const sidebarResult = readSidebarResultSync(workspaceRoot);
  if (!sidebarResult.ok) {
    warnings.push({
      kind: "wiki-sidebar-unreadable",
      message: `wiki/sidebar.ts is unreadable: ${sidebarResult.reason}`,
      path: sidebarPath(workspaceRoot),
      relPath: path.relative(workspaceRoot, sidebarPath(workspaceRoot)),
    });
  }
  const sidebar = sidebarResult.ok ? sidebarResult.nodes : [];
  const onDisk = listWikiNodeIdsOnDisk(workspaceRoot);
  const listed = collectSidebarWikiNodeIds(sidebar);
  const listedSet = new Set(listed);
  for (const id of listed) {
    if (!onDisk.includes(id)) {
      warnings.push({
        kind: "wiki-broken-ref",
        message: `Sidebar points at missing wiki-node: ${id}`,
        path: sidebarPath(workspaceRoot),
        relPath: path.relative(workspaceRoot, sidebarPath(workspaceRoot)),
      });
    }
  }
  for (const id of onDisk) {
    if (!listedSet.has(id)) {
      warnings.push({
        kind: "wiki-unlisted",
        message: `Wiki-node is not in Contents (wiki/sidebar.ts): ${id}`,
        path: wikiNodeDirPath(workspaceRoot, id),
        relPath: path.relative(workspaceRoot, wikiNodeDirPath(workspaceRoot, id)),
      });
    }
  }
  for (const name of listInvalidWikiNodeNames(workspaceRoot)) {
    const asMd = path.join(wikiDir(workspaceRoot), `${name}.md`);
    const asDir = path.join(wikiDir(workspaceRoot), name);
    const file = fs.existsSync(asMd) ? asMd : asDir;
    warnings.push({
      kind: "wiki-invalid-name",
      message: `Wiki-node name is not a nanoid(21) entity id: ${name}`,
      path: file,
      relPath: path.relative(workspaceRoot, file),
    });
  }

  appendTimestampWarnings(workspaceRoot, warnings);
}

function optionalMemberId(value: unknown): EntityId | null {
  if (typeof value === "string" && isValidEntityId(value)) {
    return value;
  }
  return null;
}

function readPropsRecordSync(propsFile: string): Record<string, unknown> | null {
  if (!fs.existsSync(propsFile)) {
    return null;
  }
  try {
    const raw = evaluatePropsExportSync(fs.readFileSync(propsFile, "utf8"));
    if (!raw || typeof raw !== "object") {
      return null;
    }
    return raw as Record<string, unknown>;
  } catch {
    return null;
  }
}

function memberDirExists(workspaceRoot: string, id: EntityId): boolean {
  const dir = memberDirPath(workspaceRoot, id);
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}

/** Sync membership read for doctor (avoid async listIssues cycles). */
function readMembershipSync(
  workspaceRoot: string,
  id: EntityId,
): "involved" | "left" | null {
  if (!memberDirExists(workspaceRoot, id)) {
    return null;
  }
  const props = readPropsRecordSync(memberPropsPath(workspaceRoot, id));
  if (!props) {
    return "involved";
  }
  return isMembership(props.membership) ? props.membership : "involved";
}

function appendMemberWarnings(
  workspaceRoot: string,
  warnings: DoctorWarning[],
): void {
  const root = membersDir(workspaceRoot);
  if (fs.existsSync(root)) {
    for (const name of listInvalidMemberNames(workspaceRoot)) {
      const dir = path.join(root, name);
      warnings.push({
        kind: "member-invalid-name",
        message: `Member directory name is not a nanoid(21) entity id: ${name}`,
        path: dir,
        relPath: path.relative(workspaceRoot, dir),
      });
    }
  }

  const pushBroken = (
    label: string,
    field: "assignee" | "createdBy",
    memberId: EntityId,
    propsFile: string,
  ) => {
    warnings.push({
      kind: "member-broken-ref",
      message: `${label} ${field} points at missing member: ${memberId}`,
      path: propsFile,
      relPath: path.relative(workspaceRoot, propsFile),
    });
  };

  for (const id of listWikiNodeIdsOnDisk(workspaceRoot)) {
    const propsFile = path.join(wikiNodeDirPath(workspaceRoot, id), "props.ts");
    const props = readPropsRecordSync(propsFile);
    if (!props) {
      continue;
    }
    const createdBy = optionalMemberId(props.createdBy);
    if (createdBy && !memberDirExists(workspaceRoot, createdBy)) {
      pushBroken(`wiki/${id}`, "createdBy", createdBy, propsFile);
    }
  }

  const hierarchy = hierarchyRoot(workspaceRoot);
  if (fs.existsSync(hierarchy)) {
    for (const name of fs.readdirSync(hierarchy)) {
      const projectDir = path.join(hierarchy, name);
      if (!fs.statSync(projectDir).isDirectory() || parseId(name) === null) {
        continue;
      }
      const projectPropsFile = path.join(projectDir, "project.ts");
      const projectProps = readPropsRecordSync(projectPropsFile);
      if (projectProps) {
        const createdBy = optionalMemberId(projectProps.createdBy);
        if (createdBy && !memberDirExists(workspaceRoot, createdBy)) {
          pushBroken(`project ${name}`, "createdBy", createdBy, projectPropsFile);
        }
      }

      for (const child of fs.readdirSync(projectDir)) {
        if (child === ".pm" || parseId(child) === null) {
          continue;
        }
        const issueDir = path.join(projectDir, child);
        if (!fs.statSync(issueDir).isDirectory()) {
          continue;
        }
        const propsFile = path.join(issueDir, "props.ts");
        const props = readPropsRecordSync(propsFile);
        if (!props) {
          continue;
        }
        const label = `issue ${name}::${child}`;
        const assignee = optionalMemberId(props.assignee);
        const createdBy = optionalMemberId(props.createdBy);
        if (assignee && !memberDirExists(workspaceRoot, assignee)) {
          pushBroken(label, "assignee", assignee, propsFile);
        }
        if (createdBy && !memberDirExists(workspaceRoot, createdBy)) {
          pushBroken(label, "createdBy", createdBy, propsFile);
        }
        const status =
          typeof props.status === "string" ? props.status : undefined;
        if (
          (status === "todo" || status === "in-progress") &&
          assignee &&
          memberDirExists(workspaceRoot, assignee)
        ) {
          const membership = readMembershipSync(workspaceRoot, assignee);
          if (membership === "left") {
            warnings.push({
              kind: "assignee-left-member",
              message: `${label} is ${status} but assignee ${assignee} has membership left`,
              path: propsFile,
              relPath: path.relative(workspaceRoot, propsFile),
            });
          }
        }
      }
    }
  }

  if (fs.existsSync(root)) {
    for (const id of listMemberIdsOnDisk(workspaceRoot)) {
      pushTimestampWarningsForProps(
        warnings,
        memberPropsPath(workspaceRoot, id),
        workspaceRoot,
        `member ${id}`,
      );
    }
  }
}

function appendHandoffWarnings(
  workspaceRoot: string,
  warnings: DoctorWarning[],
): void {
  const root = handoffsDir(workspaceRoot);
  if (fs.existsSync(root)) {
    for (const name of listInvalidHandoffNames(workspaceRoot)) {
      const dir = path.join(root, name);
      warnings.push({
        kind: "handoff-invalid-name",
        message: `Handoff directory name is not a nanoid(21) entity id: ${name}`,
        path: dir,
        relPath: path.relative(workspaceRoot, dir),
      });
    }
  }

  for (const id of listHandoffIdsOnDisk(workspaceRoot)) {
    const propsFile = handoffPropsPath(workspaceRoot, id);
    const props = readPropsRecordSync(propsFile);
    if (!props) {
      continue;
    }
    const from = optionalMemberId(props.from);
    const to = optionalMemberId(props.to);
    const relatedProject = optionalMemberId(props.relatedProject);
    if (from && !memberDirExists(workspaceRoot, from)) {
      warnings.push({
        kind: "handoff-broken-ref",
        message: `handoff ${id} from points at missing member: ${from}`,
        path: propsFile,
        relPath: path.relative(workspaceRoot, propsFile),
      });
    }
    if (to && !memberDirExists(workspaceRoot, to)) {
      warnings.push({
        kind: "handoff-broken-ref",
        message: `handoff ${id} to points at missing member: ${to}`,
        path: propsFile,
        relPath: path.relative(workspaceRoot, propsFile),
      });
    }
    if (relatedProject) {
      const projectDir = path.join(
        hierarchyRoot(workspaceRoot),
        relatedProject,
      );
      if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
        warnings.push({
          kind: "handoff-broken-ref",
          message: `handoff ${id} relatedProject points at missing project: ${relatedProject}`,
          path: propsFile,
          relPath: path.relative(workspaceRoot, propsFile),
        });
      }
    }
    pushTimestampWarningsForProps(
      warnings,
      propsFile,
      workspaceRoot,
      `handoff ${id}`,
    );
  }
}

function pushTimestampWarningsForProps(
  warnings: DoctorWarning[],
  propsFile: string,
  workspaceRoot: string,
  label: string,
): void {
  if (!fs.existsSync(propsFile)) {
    return;
  }
  let raw: unknown;
  try {
    raw = evaluatePropsExportSync(fs.readFileSync(propsFile, "utf8"));
  } catch {
    return;
  }
  if (!raw || typeof raw !== "object") {
    return;
  }
  const props = raw as Record<string, unknown>;
  const missing: string[] = [];
  if (props.created === undefined) {
    missing.push("created");
  }
  if (props.updated === undefined) {
    missing.push("updated");
  }
  if (missing.length > 0) {
    warnings.push({
      kind: "props-timestamp-missing",
      message: `${label} missing system timestamp(s): ${missing.join(", ")}`,
      path: propsFile,
      relPath: path.relative(workspaceRoot, propsFile),
    });
  }
  for (const key of ["created", "updated"] as const) {
    if (props[key] !== undefined && !isIsoDateTimeZ(props[key])) {
      warnings.push({
        kind: "props-timestamp-malformed",
        message: `${label} ${key} is not ISO-8601 UTC (…Z)`,
        path: propsFile,
        relPath: path.relative(workspaceRoot, propsFile),
      });
    }
  }
}

function appendTimestampWarnings(
  workspaceRoot: string,
  warnings: DoctorWarning[],
): void {
  for (const id of listWikiNodeIdsOnDisk(workspaceRoot)) {
    pushTimestampWarningsForProps(
      warnings,
      path.join(wikiNodeDirPath(workspaceRoot, id), "props.ts"),
      workspaceRoot,
      `wiki/${id}`,
    );
  }
  const root = hierarchyRoot(workspaceRoot);
  if (!fs.existsSync(root)) {
    return;
  }
  for (const name of fs.readdirSync(root)) {
    const projectDir = path.join(root, name);
    if (!fs.statSync(projectDir).isDirectory() || parseId(name) === null) {
      continue;
    }
    pushTimestampWarningsForProps(
      warnings,
      path.join(projectDir, "project.ts"),
      workspaceRoot,
      `project ${name}`,
    );
    for (const child of fs.readdirSync(projectDir)) {
      if (child === ".pm" || parseId(child) === null) {
        continue;
      }
      const issueDir = path.join(projectDir, child);
      if (!fs.statSync(issueDir).isDirectory()) {
        continue;
      }
      pushTimestampWarningsForProps(
        warnings,
        path.join(issueDir, "props.ts"),
        workspaceRoot,
        `issue ${name}::${child}`,
      );
    }
  }
}

/**
 * Adopt a stray directory: allocate a fresh issue id, rename to that id, fill
 * props.ts + README.md. Adopted issues land as epics at the project root;
 * reparent afterwards with `issue move`.
 */
export function adoptStray(workspaceRoot: string, strayPath: string): AdoptResult {
  const abs = path.resolve(strayPath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error(`Not a directory: ${strayPath}`);
  }

  const entry = scanStrays(workspaceRoot).strays.find(
    (s) => path.normalize(s.path) === path.normalize(abs),
  );
  if (!entry) {
    throw new Error(
      `Path is not reported as a stray (already indexed or outside hierarchy): ${strayPath}`,
    );
  }
  if (!entry.adoptable || entry.projectId === undefined) {
    throw new Error(
      `Cannot adopt ${entry.relPath}: ${entry.message}. Move it directly under a project directory first.`,
    );
  }

  const projectDir = path.dirname(abs);
  if (!isValidProjectDir(projectDir)) {
    throw new Error(
      `Parent is not a valid project directory: ${path.relative(workspaceRoot, projectDir)}`,
    );
  }

  const base = path.basename(abs);
  const title =
    base
      .replace(/^[A-Za-z0-9_-]{21}-/, "")
      .replace(/^[a-z](?:[a-z0-9]|-[a-z0-9])*_[1-9]\d*-/, "")
      .replace(/^[a-z]{1,4}\d+-/, "")
      .replace(/^\d+-/, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "Untitled";

  const newId = allocateIssueId(projectDir);
  const dest = path.join(projectDir, newId);
  if (fs.existsSync(dest) && path.normalize(dest) !== path.normalize(abs)) {
    throw new Error(`Destination already exists: ${path.relative(workspaceRoot, dest)}`);
  }
  if (path.normalize(dest) !== path.normalize(abs)) {
    fs.renameSync(abs, dest);
  }

  const propsPath = path.join(dest, "props.ts");
  if (!fs.existsSync(propsPath)) {
    const now = nowIsoUtcZ();
    fs.writeFileSync(
      propsPath,
      writePropsTs(
        {
          title,
          level: "epic",
          parentId: null,
          status: DEFAULT_ISSUE_STATUS,
          priority: DEFAULT_ISSUE_PRIORITY,
          startDate: null,
          endDate: null,
          estimatePoint: 0,
          created: now,
          updated: now,
        },
        { satisfies: LEVEL_TYPE_NAME.epic },
      ),
      "utf8",
    );
  }

  const readmePath = path.join(dest, "README.md");
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, "", "utf8");
  }

  return {
    projectId: entry.projectId,
    issueId: newId,
    path: dest,
    relPath: path.relative(workspaceRoot, dest),
    ref: issueLinkSyntax(entry.projectId, newId),
  };
}
