import fs from "node:fs";
import path from "node:path";

import { defsForLevel, loadCustomProps, writeCustomProps, emptyCustomProps } from "./custom-props.js";
import {
  compareIds,
  isBareNumericDir,
  isGluedLegacyId,
  isShardedLegacyId,
  isValidEntityId,
  keyToKebab,
  parseId,
  parseIssueRefKey,
  type EntityId,
} from "../identity/dir-id.js";
import {
  allocateIssueId,
  allocateProjectId,
  ensureDirWithGitkeep,
  hierarchyRoot,
} from "../identity/ids.js";
import { resolveActorMemberId } from "../workspace/local-config.js";
import {
  descendantsOf,
  depthFromParents,
  isIssueLevel,
  levelAtDepth,
  nextLevel,
  planMove,
  validateLadder,
  type LadderRow,
} from "../identity/ladder.js";
import {
  loadIssueProps,
  loadProjectProps,
  writePropsTs,
  type IssuePropsFile,
} from "../infra/props-load.js";
import {
  DEFAULT_ISSUE_PRIORITY,
  isIssuePriorityId,
  normalizeIssuePriority,
} from "../identity/issue-priority.js";
import {
  DEFAULT_ISSUE_STATUS,
  isIssueStatusId,
  normalizeIssueStatus,
} from "../identity/issue-status.js";
import { LEVEL_TYPE_NAME } from "../infra/schema-dts.js";
import {
  assertValidBlockedBy,
  normalizeBlockedBy,
  pruneDeletedFromBlockedBy,
} from "../identity/deps.js";
import {
  equalsForSync,
  normalizeStringMap,
  pickIssueEditable,
  pickProjectEditable,
  StaleWriteError,
  type IssueEditableSlice,
  type ProjectEditableSlice,
} from "../sync/detail-diff.js";
import {
  nowIsoUtcZ,
  resolveTimestamps,
  stampOnWrite,
  stripTimestampKeys,
} from "../infra/timestamps.js";
import {
  issueRefKey,
  type CustomPropsSchema,
  type Issue,
  type IssueCreateInput,
  type IssueLevel,
  type IssuePatch,
  type MoveIssueInput,
  type Project,
  type ProjectCreateInput,
  type ProjectPatch,
  type WriteActorOptions,
} from "../identity/types.js";

function readText(file: string): string {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function optionalMemberId(value: unknown): EntityId | null {
  if (typeof value === "string" && isValidEntityId(value)) {
    return value;
  }
  return null;
}

/** Valid entity-id child directories, sorted lexicographically. Anything else is doctor's problem. */
function listIdChildDirs(dir: string): Array<{ id: EntityId; name: string }> {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out: Array<{ id: EntityId; name: string }> = [];
  for (const name of fs.readdirSync(dir)) {
    if (name === ".pm") {
      continue;
    }
    const id = parseId(name);
    if (id === null) {
      continue;
    }
    if (!fs.statSync(path.join(dir, name)).isDirectory()) {
      continue;
    }
    out.push({ id, name });
  }
  return out.sort((a, b) => compareIds(a.id, b.id));
}

export function projectDirPath(workspaceRoot: string, projectId: EntityId): string {
  return path.join(hierarchyRoot(workspaceRoot), projectId);
}

/** `@issue-<p>::<i>` to a path by joining ids. No index needed. */
export function issueDirPath(
  workspaceRoot: string,
  projectId: EntityId,
  issueId: EntityId,
): string {
  return path.join(projectDirPath(workspaceRoot, projectId), issueId);
}

export function isValidWorkspace(root: string): boolean {
  return (
    fs.existsSync(path.join(root, "issue-hierarchy")) &&
    fs.existsSync(path.join(root, ".pm"))
  );
}

/**
 * Project directories from the old `<id>-<slug>/` layout. There is no
 * compatibility path: a legacy workspace must be converted, and saying so
 * beats reading it as a pile of strays.
 */
export function legacyLayoutDirs(root: string): string[] {
  const hierarchy = hierarchyRoot(root);
  if (!fs.existsSync(hierarchy)) {
    return [];
  }
  return fs
    .readdirSync(hierarchy)
    .filter((name) => {
      if (name === ".pm" || parseId(name) !== null) {
        return false;
      }
      const dir = path.join(hierarchy, name);
      return (
        fs.statSync(dir).isDirectory() &&
        /^\d+-/.test(name) &&
        fs.existsSync(path.join(dir, "project.ts"))
      );
    })
    .sort();
}

function bareNumericLayoutDirs(root: string): string[] {
  const hierarchy = hierarchyRoot(root);
  if (!fs.existsSync(hierarchy)) {
    return [];
  }
  return fs
    .readdirSync(hierarchy)
    .filter((name) => {
      if (name === ".pm" || !isBareNumericDir(name)) {
        return false;
      }
      return fs.statSync(path.join(hierarchy, name)).isDirectory();
    })
    .sort();
}

function gluedLegacyLayoutDirs(root: string): string[] {
  const hierarchy = hierarchyRoot(root);
  if (!fs.existsSync(hierarchy)) {
    return [];
  }
  return fs
    .readdirSync(hierarchy)
    .filter((name) => {
      if (name === ".pm" || !isGluedLegacyId(name)) {
        return false;
      }
      return fs.statSync(path.join(hierarchy, name)).isDirectory();
    })
    .sort();
}

function shardedLegacyLayoutDirs(root: string): string[] {
  const hierarchy = hierarchyRoot(root);
  if (!fs.existsSync(hierarchy)) {
    return [];
  }
  return fs
    .readdirSync(hierarchy)
    .filter((name) => {
      if (name === ".pm" || !isShardedLegacyId(name)) {
        return false;
      }
      return fs.statSync(path.join(hierarchy, name)).isDirectory();
    })
    .sort();
}

export function assertSupportedLayout(root: string): void {
  const legacy = legacyLayoutDirs(root);
  if (legacy.length > 0) {
    throw new Error(
      `Workspace uses the old nested <id>-<slug>/ layout (${legacy.join(", ")}). ` +
        "Issues now live flat at issue-hierarchy/<projectId>/<issueId>/ with parentId in props.ts. Convert it before opening.",
    );
  }
  const bare = bareNumericLayoutDirs(root);
  if (bare.length > 0) {
    throw new Error(
      `Workspace uses pre-token bare numeric ids (${bare.join(", ")}). ` +
        "Ids are now opaque nanoid(21) tokens. Rebuild or re-scaffold the workspace; there is no dual-format path.",
    );
  }
  const glued = gluedLegacyLayoutDirs(root);
  if (glued.length > 0) {
    throw new Error(
      `Workspace uses pre-token glued shard ids (${glued.join(", ")}). ` +
        "Ids are now opaque nanoid(21) tokens. Rebuild or re-scaffold the workspace; there is no dual-format path.",
    );
  }
  const sharded = shardedLegacyLayoutDirs(root);
  if (sharded.length > 0) {
    throw new Error(
      `Workspace uses legacy <handle>_<seq> ids (${sharded.join(", ")}). ` +
        "Ids are now opaque nanoid(21) tokens. Rebuild or re-scaffold the workspace; there is no dual-format path.",
    );
  }
}

export async function listProjects(workspaceRoot: string): Promise<Project[]> {
  const root = hierarchyRoot(workspaceRoot);
  const projects: Project[] = [];
  for (const { id, name } of listIdChildDirs(root)) {
    const dir = path.join(root, name);
    const propsFile = path.join(dir, "project.ts");
    if (!fs.existsSync(propsFile)) {
      continue;
    }
    const props = await loadProjectProps(fs.readFileSync(propsFile, "utf8"));
    const record = props as Record<string, unknown>;
    const ts = resolveTimestamps(record);
    const hasLegacyColor = "color" in record;
    if (ts.seeded || hasLegacyColor) {
      const next = { ...record };
      delete next.color;
      delete next.id;
      next.created = ts.created;
      next.updated = ts.updated;
      fs.writeFileSync(propsFile, writePropsTs(next), "utf8");
    }
    projects.push({
      id,
      path: dir,
      relPath: path.join("issue-hierarchy", name),
      title: props.title,
      description: readText(path.join(dir, "README.md")),
      created: ts.created,
      updated: ts.updated,
      createdBy: optionalMemberId(record.createdBy),
    });
  }
  return projects.sort((a, b) => compareIds(a.id, b.id));
}

/** One issue directory as read from disk, before its level is settled. */
interface RawIssue {
  id: EntityId;
  dir: string;
  props: IssuePropsFile;
  parentId: EntityId | null;
  statedLevel: IssueLevel | null;
}

async function readRawIssue(
  issueDir: string,
  id: EntityId,
): Promise<RawIssue | null> {
  const propsFile = path.join(issueDir, "props.ts");
  if (!fs.existsSync(propsFile)) {
    return null;
  }
  const props = await loadIssueProps(fs.readFileSync(propsFile, "utf8"));
  const parentId =
    typeof props.parentId === "string" && parseId(props.parentId) !== null
      ? props.parentId
      : null;
  return {
    id,
    dir: issueDir,
    props,
    parentId,
    statedLevel: isIssueLevel(props.level) ? props.level : null,
  };
}

async function readProjectRawIssues(projectDir: string): Promise<RawIssue[]> {
  const out: RawIssue[] = [];
  for (const { id, name } of listIdChildDirs(projectDir)) {
    const raw = await readRawIssue(path.join(projectDir, name), id);
    if (raw) {
      out.push(raw);
    }
  }
  return out;
}

/**
 * Settle levels. props.ts is authoritative because level decides which custom
 * props schema an issue's data is read against; only a file that states no
 * level falls back to the depth its parent chain implies.
 */
function resolveLevels(raws: readonly RawIssue[]): Map<EntityId, IssueLevel> {
  const parents = new Map<string, string | null>();
  for (const raw of raws) {
    parents.set(raw.id, raw.parentId);
  }
  const depths = depthFromParents(parents);
  const levels = new Map<EntityId, IssueLevel>();
  for (const raw of raws) {
    if (raw.statedLevel) {
      levels.set(raw.id, raw.statedLevel);
      continue;
    }
    const depth = depths.get(raw.id) ?? null;
    levels.set(raw.id, (depth === null ? null : levelAtDepth(depth)) ?? "epic");
  }
  return levels;
}

function toIssue(
  workspaceRoot: string,
  projectId: EntityId,
  raw: RawIssue,
  level: IssueLevel,
  custom: CustomPropsSchema,
): Issue {
  const props = raw.props;
  const violations: Issue["violations"] = [];
  if (!raw.statedLevel) {
    violations.push({
      kind: "level-missing",
      message: `props.ts has no level; reading it as a ${level} based on its parent chain.`,
      expectedLevel: level,
    });
  }

  const defs = defsForLevel(custom, level);
  const fields: Record<string, unknown> = {};
  const markdownFields: Record<string, string> = {};
  for (const def of defs) {
    if (def.type === "markdown") {
      markdownFields[def.key] = readText(
        path.join(raw.dir, `${keyToKebab(def.key)}.md`),
      );
    } else if (def.key in props) {
      fields[def.key] = (props as Record<string, unknown>)[def.key];
    }
  }
  const system = new Set([
    "title",
    "level",
    "parentId",
    "status",
    "priority",
    "startDate",
    "endDate",
    "blockedBy",
    "assignee",
    "createdBy",
    "created",
    "updated",
    "id",
    // Legacy drop: ignore leftover estimatePoint on disk (do not map to fields).
    "estimatePoint",
    ...defs.filter((d) => d.type === "markdown").map((d) => d.key),
  ]);
  for (const [k, v] of Object.entries(props)) {
    if (!system.has(k) && !(k in fields)) {
      fields[k] = v;
    }
  }

  const ts = resolveTimestamps(props as Record<string, unknown>);
  const status = normalizeIssueStatus(
    (props as Record<string, unknown>).status,
  );
  const priority = normalizeIssuePriority(
    (props as Record<string, unknown>).priority,
  );
  if (ts.seeded) {
    const next: Record<string, unknown> = {
      ...(props as Record<string, unknown>),
      created: ts.created,
      updated: ts.updated,
      status,
      priority,
    };
    delete next.id;
    delete next.estimatePoint;
    fs.writeFileSync(
      path.join(raw.dir, "props.ts"),
      writePropsTs(next, { satisfies: LEVEL_TYPE_NAME[level] }),
      "utf8",
    );
  }

  return {
    projectId,
    id: raw.id,
    level,
    parentId: raw.parentId,
    path: raw.dir,
    relPath: path.relative(workspaceRoot, raw.dir),
    title: props.title,
    status,
    priority,
    startDate: props.startDate ?? null,
    endDate: props.endDate ?? null,
    blockedBy: (() => {
      try {
        return normalizeBlockedBy(
          (props as Record<string, unknown>).blockedBy,
        );
      } catch {
        // Soft on read: doctor / write path will surface bad values.
        return [];
      }
    })(),
    description: readText(path.join(raw.dir, "README.md")),
    created: ts.created,
    updated: ts.updated,
    assignee: optionalMemberId((props as Record<string, unknown>).assignee),
    createdBy: optionalMemberId((props as Record<string, unknown>).createdBy),
    fields,
    markdownFields,
    violations,
  };
}

function toLadderRows(projectId: EntityId, issues: readonly Issue[]): LadderRow[] {
  return issues.map((issue) => ({
    key: issueRefKey(projectId, issue.id),
    level: issue.level,
    parentKey:
      issue.parentId === null ? null : issueRefKey(projectId, issue.parentId),
  }));
}

function attachViolations(issues: Issue[], rows: readonly LadderRow[]): void {
  const report = validateLadder(rows);
  for (const issue of issues) {
    const found = report.get(issueRefKey(issue.projectId, issue.id));
    if (found) {
      issue.violations.push(...found);
    }
  }
}

/** All issues in one project, with levels settled and violations attached. */
async function listProjectIssues(
  workspaceRoot: string,
  project: Project,
): Promise<{ issues: Issue[]; rows: LadderRow[] }> {
  const custom = await loadCustomProps(project.path);
  const raws = await readProjectRawIssues(project.path);
  const levels = resolveLevels(raws);
  const issues = raws.map((raw) =>
    toIssue(workspaceRoot, project.id, raw, levels.get(raw.id)!, custom),
  );
  const rows = toLadderRows(project.id, issues);
  attachViolations(issues, rows);
  return { issues, rows };
}

export async function listIssues(workspaceRoot: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  for (const project of await listProjects(workspaceRoot)) {
    const scoped = await listProjectIssues(workspaceRoot, project);
    issues.push(...scoped.issues);
  }
  return issues;
}

export async function getProject(
  workspaceRoot: string,
  projectId: EntityId,
): Promise<Project> {
  const p = (await listProjects(workspaceRoot)).find((x) => x.id === projectId);
  if (!p) {
    throw new Error(`Project not found: ${projectId}`);
  }
  return p;
}

/**
 * Ancestor chain of one issue, walking up by `parentId`. Bounded by chain
 * length, so a single issue can be validated without scanning the project.
 */
async function ancestorChain(
  projectDir: string,
  startId: EntityId,
): Promise<RawIssue[]> {
  const chain: RawIssue[] = [];
  const seen = new Set<EntityId>();
  let cursor: EntityId | null = startId;
  while (cursor !== null && !seen.has(cursor)) {
    seen.add(cursor);
    const raw = await readRawIssue(path.join(projectDir, cursor), cursor);
    if (!raw) {
      break;
    }
    chain.push(raw);
    cursor = raw.parentId;
  }
  return chain;
}

export async function getIssue(
  workspaceRoot: string,
  projectId: EntityId,
  issueId: EntityId,
): Promise<Issue> {
  const project = await getProject(workspaceRoot, projectId);
  const issueDir = issueDirPath(workspaceRoot, projectId, issueId);
  const raw = await readRawIssue(issueDir, issueId);
  if (!raw) {
    throw new Error(`Issue not found: ${projectId}::${issueId}`);
  }

  const chain = await ancestorChain(project.path, issueId);
  const levels = resolveLevels(chain);
  const custom = await loadCustomProps(project.path);
  const issue = toIssue(
    workspaceRoot,
    projectId,
    raw,
    levels.get(issueId)!,
    custom,
  );

  // Every violation kind depends only on this issue and its ancestors, so the
  // chain is enough — no need to read the rest of the project.
  const chainIssues = chain.map((link) =>
    toIssue(workspaceRoot, projectId, link, levels.get(link.id)!, custom),
  );
  attachViolations([issue], toLadderRows(projectId, chainIssues));
  return issue;
}

export async function createProject(
  workspaceRoot: string,
  input: ProjectCreateInput = {},
  actor: WriteActorOptions = {},
): Promise<Project> {
  const id = allocateProjectId(workspaceRoot);
  const title = input.title?.trim() || "New Project";
  const dir = projectDirPath(workspaceRoot, id);
  fs.mkdirSync(path.join(dir, ".pm"), { recursive: true });
  const now = nowIsoUtcZ();
  const createdBy = resolveActorMemberId(workspaceRoot, actor.actorMemberId);
  fs.writeFileSync(
    path.join(dir, "project.ts"),
    writePropsTs({
      title,
      created: now,
      updated: now,
      ...(createdBy ? { createdBy } : {}),
    }),
    "utf8",
  );
  fs.writeFileSync(path.join(dir, "README.md"), "", "utf8");
  writeCustomProps(dir, emptyCustomProps());
  return getProject(workspaceRoot, id);
}

export type UpdateWriteOptions<T> = {
  /** Refuse the write when disk editable content differs from this baseline. */
  expected?: T;
};

function assertProjectBaseline(
  disk: Project,
  expected: ProjectEditableSlice,
  patch: ProjectPatch,
): void {
  const current = pickProjectEditable(disk);
  const conflicts: string[] = [];
  if (
    patch.title !== undefined &&
    !equalsForSync(current.title, expected.title)
  ) {
    conflicts.push("title");
  }
  if (
    patch.description !== undefined &&
    !equalsForSync(current.description, expected.description)
  ) {
    conflicts.push("description");
  }
  if (conflicts.length > 0) {
    throw new StaleWriteError(
      `Project changed on disk (${conflicts.join(", ")}). Reload or keep editing.`,
      conflicts,
    );
  }
}

function assertIssueBaseline(
  disk: Issue,
  expected: IssueEditableSlice,
  patch: IssuePatch,
): void {
  const current = pickIssueEditable(disk);
  const conflicts: string[] = [];
  const check = (pathKey: string, touched: boolean, a: unknown, b: unknown) => {
    if (touched && !equalsForSync(a, b)) {
      conflicts.push(pathKey);
    }
  };
  check("title", patch.title !== undefined, current.title, expected.title);
  check("status", patch.status !== undefined, current.status, expected.status);
  check(
    "priority",
    patch.priority !== undefined,
    current.priority,
    expected.priority,
  );
  check(
    "startDate",
    patch.startDate !== undefined,
    current.startDate,
    expected.startDate,
  );
  check(
    "endDate",
    patch.endDate !== undefined,
    current.endDate,
    expected.endDate,
  );
  check(
    "blockedBy",
    patch.blockedBy !== undefined,
    current.blockedBy,
    expected.blockedBy,
  );
  check(
    "description",
    patch.description !== undefined,
    current.description,
    expected.description,
  );
  check(
    "assignee",
    patch.assignee !== undefined,
    current.assignee,
    expected.assignee,
  );
  if (patch.fields !== undefined) {
    for (const key of new Set([
      ...Object.keys(patch.fields),
      ...Object.keys(expected.fields),
      ...Object.keys(current.fields),
    ])) {
      if (!(key in patch.fields)) {
        continue;
      }
      check(
        `fields.${key}`,
        true,
        current.fields[key],
        expected.fields[key],
      );
    }
  }
  if (patch.markdownFields !== undefined) {
    const curMd = normalizeStringMap(current.markdownFields);
    const expMd = normalizeStringMap(expected.markdownFields);
    for (const key of Object.keys(patch.markdownFields)) {
      check(
        `markdownFields.${key}`,
        true,
        curMd[key] ?? "",
        expMd[key] ?? "",
      );
    }
  }
  if (conflicts.length > 0) {
    throw new StaleWriteError(
      `Issue changed on disk (${conflicts.join(", ")}). Reload or keep editing.`,
      conflicts,
    );
  }
}

export async function updateProject(
  workspaceRoot: string,
  projectId: EntityId,
  patch: ProjectPatch,
  options: UpdateWriteOptions<ProjectEditableSlice> = {},
): Promise<Project> {
  const project = await getProject(workspaceRoot, projectId);
  if (options.expected) {
    assertProjectBaseline(project, options.expected, patch);
  }
  const props = await loadProjectProps(
    fs.readFileSync(path.join(project.path, "project.ts"), "utf8"),
  );
  const nextTitle = (patch.title !== undefined ? patch.title : props.title)
    .trim();
  if (!nextTitle) {
    throw new Error("Project title is required.");
  }
  const contentWrite =
    patch.title !== undefined ||
    patch.description !== undefined;
  const stamped = contentWrite
    ? stampOnWrite(props as Record<string, unknown>)
    : resolveTimestamps(props as Record<string, unknown>);
  const next = {
    ...props,
    title: nextTitle,
    created: stamped.created,
    updated: stamped.updated,
  } as Record<string, unknown>;
  delete next.id;
  delete next.color;
  fs.writeFileSync(
    path.join(project.path, "project.ts"),
    writePropsTs(next),
    "utf8",
  );
  if (patch.description !== undefined) {
    fs.writeFileSync(path.join(project.path, "README.md"), patch.description, "utf8");
  }
  // Renaming a title never renames the directory: the directory name is the id.
  return getProject(workspaceRoot, projectId);
}

export type DeleteOptions = {
  /** When true, remove the issue and all its descendants. Default false. */
  cascade?: boolean;
};

export async function deleteProject(
  workspaceRoot: string,
  projectId: EntityId,
  options: DeleteOptions = {},
): Promise<void> {
  const project = await getProject(workspaceRoot, projectId);
  const { issues } = await listProjectIssues(workspaceRoot, project);
  if (issues.length > 0 && !options.cascade) {
    throw new Error(
      `Cannot delete project ${projectId}: has ${issues.length} issue(s). Pass cascade: true (or CLI --force) to remove the whole tree.`,
    );
  }
  fs.rmSync(project.path, { recursive: true, force: true });
  ensureDirWithGitkeep(hierarchyRoot(workspaceRoot));
}

export async function createIssue(
  workspaceRoot: string,
  input: IssueCreateInput,
  actor: WriteActorOptions = {},
): Promise<Issue> {
  const project = await getProject(workspaceRoot, input.projectId);
  let level: IssueLevel = "epic";

  if (input.parentIssueId !== null) {
    const parent = await getIssue(
      workspaceRoot,
      input.projectId,
      input.parentIssueId,
    );
    const childLevel = nextLevel(parent.level);
    if (childLevel === null) {
      throw new Error("Cannot create child under subtask");
    }
    level = childLevel;
  }

  const id = allocateIssueId(project.path);
  const title = input.title?.trim() || `New ${level}`;
  const issueDir = path.join(project.path, id);
  const now = nowIsoUtcZ();
  const createdBy = resolveActorMemberId(workspaceRoot, actor.actorMemberId);
  fs.mkdirSync(issueDir, { recursive: true });
  fs.writeFileSync(
    path.join(issueDir, "props.ts"),
    writePropsTs(
      {
        title,
        level,
        parentId: input.parentIssueId,
        status: DEFAULT_ISSUE_STATUS,
        priority: DEFAULT_ISSUE_PRIORITY,
        startDate: null,
        endDate: null,
        blockedBy: [],
        assignee: null,
        created: now,
        updated: now,
        ...(createdBy ? { createdBy } : {}),
      },
      { satisfies: LEVEL_TYPE_NAME[level] },
    ),
    "utf8",
  );
  fs.writeFileSync(path.join(issueDir, "README.md"), "", "utf8");
  return getIssue(workspaceRoot, input.projectId, id);
}

export async function updateIssue(
  workspaceRoot: string,
  projectId: EntityId,
  issueId: EntityId,
  patch: IssuePatch,
  options: UpdateWriteOptions<IssueEditableSlice> = {},
): Promise<Issue> {
  const issue = await getIssue(workspaceRoot, projectId, issueId);
  if (options.expected) {
    assertIssueBaseline(issue, options.expected, patch);
  }
  const props = await loadIssueProps(
    fs.readFileSync(path.join(issue.path, "props.ts"), "utf8"),
  );
  const nextTitle = String(patch.title !== undefined ? patch.title : props.title)
    .trim();
  if (!nextTitle) {
    throw new Error("Issue title is required.");
  }
  if (patch.status !== undefined && !isIssueStatusId(patch.status)) {
    throw new Error(`Invalid issue status: ${String(patch.status)}`);
  }
  if (patch.priority !== undefined && !isIssuePriorityId(patch.priority)) {
    throw new Error(`Invalid issue priority: ${String(patch.priority)}`);
  }
  const safeFields = stripTimestampKeys(patch.fields);
  if (safeFields) {
    delete safeFields.status;
    delete safeFields.priority;
    delete safeFields.level;
    delete safeFields.parentId;
    delete safeFields.title;
    delete safeFields.startDate;
    delete safeFields.endDate;
    delete safeFields.blockedBy;
    delete safeFields.assignee;
    delete safeFields.createdBy;
  }
  if (patch.assignee !== undefined && patch.assignee !== null) {
    if (!isValidEntityId(patch.assignee)) {
      throw new Error(`Invalid assignee: ${JSON.stringify(patch.assignee)}`);
    }
  }
  const nextStatus =
    patch.status !== undefined
      ? patch.status
      : normalizeIssueStatus(props.status);
  const nextPriority =
    patch.priority !== undefined
      ? patch.priority
      : normalizeIssuePriority(props.priority);
  const nextAssignee =
    patch.assignee !== undefined
      ? patch.assignee
      : optionalMemberId(props.assignee);
  const nextCreatedBy = optionalMemberId(props.createdBy);
  let nextBlockedBy = issue.blockedBy;
  if (patch.blockedBy !== undefined) {
    nextBlockedBy = normalizeBlockedBy(patch.blockedBy);
    const project = await getProject(workspaceRoot, projectId);
    const { issues: siblings } = await listProjectIssues(workspaceRoot, project);
    assertValidBlockedBy(
      siblings.map((i) => ({ id: i.id, blockedBy: i.blockedBy })),
      issueId,
      nextBlockedBy,
    );
  }
  const next: Record<string, unknown> = {
    ...props,
    ...issue.fields,
    title: nextTitle,
    status: nextStatus,
    priority: nextPriority,
    startDate:
      patch.startDate !== undefined ? patch.startDate : (props.startDate ?? null),
    endDate: patch.endDate !== undefined ? patch.endDate : (props.endDate ?? null),
    blockedBy: nextBlockedBy,
    assignee: nextAssignee,
  };
  // Drop legacy estimatePoint if still present on disk.
  delete next.estimatePoint;
  if (nextCreatedBy) {
    next.createdBy = nextCreatedBy;
  } else {
    delete next.createdBy;
  }
  if (safeFields) {
    Object.assign(next, safeFields);
  }
  // Structural, not custom fields: only create/move may set these.
  next.level = issue.level;
  next.parentId = issue.parentId;
  next.status = nextStatus;
  next.priority = nextPriority;
  next.assignee = nextAssignee;
  // createdBy is system — never accept from patch/fields
  if (nextCreatedBy) {
    next.createdBy = nextCreatedBy;
  } else {
    delete next.createdBy;
  }
  // Strip markdown keys from props.ts (they live in files)
  const custom = await loadCustomProps(
    (await getProject(workspaceRoot, projectId)).path,
  );
  for (const def of defsForLevel(custom, issue.level)) {
    if (def.type === "markdown") {
      delete next[def.key];
    }
  }
  delete next.id;

  const contentWrite =
    patch.title !== undefined ||
    patch.status !== undefined ||
    patch.priority !== undefined ||
    patch.startDate !== undefined ||
    patch.endDate !== undefined ||
    patch.blockedBy !== undefined ||
    patch.description !== undefined ||
    patch.assignee !== undefined ||
    (safeFields !== undefined && Object.keys(safeFields).length > 0) ||
    (patch.markdownFields !== undefined &&
      Object.keys(patch.markdownFields).length > 0);
  const stamped = contentWrite
    ? stampOnWrite({
        created: props.created,
        updated: props.updated,
      } as Record<string, unknown>)
    : resolveTimestamps(props as Record<string, unknown>);
  next.created = stamped.created;
  next.updated = stamped.updated;

  fs.writeFileSync(
    path.join(issue.path, "props.ts"),
    writePropsTs(next, { satisfies: LEVEL_TYPE_NAME[issue.level] }),
    "utf8",
  );

  if (patch.description !== undefined) {
    fs.writeFileSync(path.join(issue.path, "README.md"), patch.description, "utf8");
  }

  if (patch.markdownFields) {
    for (const [key, body] of Object.entries(patch.markdownFields)) {
      const file = path.join(issue.path, `${keyToKebab(key)}.md`);
      if (body === "" && !fs.existsSync(file)) {
        continue;
      }
      fs.writeFileSync(file, body, "utf8");
    }
  }

  // Title changes never rename the directory: the directory name is the id.
  return getIssue(workspaceRoot, projectId, issueId);
}

export async function deleteIssue(
  workspaceRoot: string,
  projectId: EntityId,
  issueId: EntityId,
  options: DeleteOptions = {},
): Promise<void> {
  const project = await getProject(workspaceRoot, projectId);
  const { issues, rows } = await listProjectIssues(workspaceRoot, project);
  const target = issues.find((i) => i.id === issueId);
  if (!target) {
    throw new Error(`Issue not found: ${projectId}::${issueId}`);
  }
  const key = issueRefKey(projectId, issueId);
  const doomed = descendantsOf(rows, key);
  if (doomed.length > 0 && !options.cascade) {
    throw new Error(
      `Cannot delete ${projectId}::${issueId}: has children. Pass cascade: true (or CLI --force) to remove the whole tree.`,
    );
  }

  const deletedIds = new Set<EntityId>([issueId]);
  for (const childKey of doomed) {
    const parsed = parseIssueRefKey(childKey);
    if (parsed) {
      deletedIds.add(parsed.issueId);
    }
  }

  // Prune hard-deps pointing at doomed issues before removing directories.
  for (const other of issues) {
    if (deletedIds.has(other.id)) {
      continue;
    }
    const next = pruneDeletedFromBlockedBy(other.blockedBy, deletedIds);
    if (next.length === other.blockedBy.length) {
      continue;
    }
    const props = await loadIssueProps(
      fs.readFileSync(path.join(other.path, "props.ts"), "utf8"),
    );
    const stamped = stampOnWrite(props as Record<string, unknown>);
    const written: Record<string, unknown> = {
      ...props,
      blockedBy: next,
      created: stamped.created,
      updated: stamped.updated,
      status: normalizeIssueStatus(props.status),
      priority: normalizeIssuePriority(props.priority),
    };
    delete written.id;
    fs.writeFileSync(
      path.join(other.path, "props.ts"),
      writePropsTs(written, { satisfies: LEVEL_TYPE_NAME[other.level] }),
      "utf8",
    );
  }

  // Flat storage has no subtree to unlink in one call, so delete deepest-first:
  // an interrupted cascade then leaves detached children rather than a parent
  // whose children silently outlive it. Either way doctor reports it.
  const pathByKey = new Map(
    issues.map((i) => [issueRefKey(projectId, i.id), i.path] as const),
  );
  for (const childKey of [...doomed].reverse()) {
    const dir = pathByKey.get(childKey);
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  fs.rmSync(target.path, { recursive: true, force: true });
}

/** Rewrite only `level` and `parentId` in an issue's props.ts. */
async function writePlacement(
  issuePath: string,
  patch: { level?: IssueLevel; parentId?: EntityId | null },
): Promise<void> {
  const file = path.join(issuePath, "props.ts");
  const props = await loadIssueProps(fs.readFileSync(file, "utf8"));
  const next: Record<string, unknown> = { ...props };
  if (patch.level !== undefined) {
    next.level = patch.level;
  }
  if (patch.parentId !== undefined) {
    next.parentId = patch.parentId;
  }
  delete next.id;
  const stamped = stampOnWrite(props as Record<string, unknown>);
  next.created = stamped.created;
  next.updated = stamped.updated;
  next.status = normalizeIssueStatus(next.status);
  next.priority = normalizeIssuePriority(next.priority);
  const level = isIssueLevel(next.level) ? next.level : "epic";
  fs.writeFileSync(file, writePropsTs(next, { satisfies: LEVEL_TYPE_NAME[level] }), "utf8");
}

export async function moveIssue(
  workspaceRoot: string,
  input: MoveIssueInput,
): Promise<Issue> {
  const project = await getProject(workspaceRoot, input.projectId);
  const { issues, rows } = await listProjectIssues(workspaceRoot, project);
  const issue = issues.find((i) => i.id === input.issueId);
  if (!issue) {
    throw new Error(`Issue not found: ${input.projectId}::${input.issueId}`);
  }
  if (
    input.newParentIssueId !== null &&
    !issues.some((i) => i.id === input.newParentIssueId)
  ) {
    throw new Error(
      `Parent not found in project ${input.projectId}: ${input.newParentIssueId}. Issues cannot move across projects.`,
    );
  }

  const key = issueRefKey(input.projectId, input.issueId);
  const newParentKey =
    input.newParentIssueId === null
      ? null
      : issueRefKey(input.projectId, input.newParentIssueId);

  // Rejects cycles, subtask parents, and subtrees that would not fit; returns
  // the level rewrites the subtree needs so the ladder still holds.
  const changes = planMove(rows, key, newParentKey);
  const pathByKey = new Map(
    issues.map((i) => [issueRefKey(input.projectId, i.id), i.path] as const),
  );
  const levelByKey = new Map(changes.map((c) => [c.key, c.to] as const));

  // No directory moves: reparenting is a field edit, so paths stay valid and
  // anything holding `issue-hierarchy/<p>/<i>` keeps working.
  await writePlacement(issue.path, {
    level: levelByKey.get(key) ?? issue.level,
    parentId: input.newParentIssueId,
  });
  for (const change of changes) {
    if (change.key === key) {
      continue;
    }
    const dir = pathByKey.get(change.key);
    if (dir) {
      await writePlacement(dir, { level: change.to });
    }
  }

  return getIssue(workspaceRoot, input.projectId, input.issueId);
}

export async function getCustomPropsForProject(
  workspaceRoot: string,
  projectId: EntityId,
): Promise<CustomPropsSchema> {
  const project = await getProject(workspaceRoot, projectId);
  return loadCustomProps(project.path);
}

export async function updateCustomPropsForProject(
  workspaceRoot: string,
  projectId: EntityId,
  schema: CustomPropsSchema,
): Promise<CustomPropsSchema> {
  const project = await getProject(workspaceRoot, projectId);
  writeCustomProps(project.path, schema);
  return loadCustomProps(project.path);
}
