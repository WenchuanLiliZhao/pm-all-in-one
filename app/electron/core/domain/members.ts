/**
 * Workspace members: `members/<id>/{props.ts,README.md,avatar.<ext>}`.
 * Ids are opaque nanoid(21). No roster index. No delete — only membership.
 *
 * ↔ electron/core/sync/detail-diff.ts — OCC expected / StaleWriteError on updateMember
 * ↔ electron/main.ts — IPC encodeStaleWriteMessage on OCC
 * ↔ server/main.ts — HTTP twin PATCH /api/members/:id
 * ↔ src/lib/bridge/pm-api.ts — updateMember expected option
 */
import fs from "node:fs";
import path from "node:path";

import { parseId, type EntityId } from "../identity/dir-id.js";
import {
  equalsForSync,
  pickMemberEditable,
  StaleWriteError,
  type MemberEditableSlice,
} from "../sync/detail-diff.js";
import { allocateMemberId, membersRoot } from "../identity/ids.js";
import { loadMemberProps, writePropsTs } from "../infra/props-load.js";
import {
  isIsoDateTimeZ,
  nowIsoUtcZ,
  resolveTimestamps,
  stampOnWrite,
} from "../infra/timestamps.js";
import type {
  CreateMemberInput,
  Member,
  MemberMeta,
  MemberPatch,
  MemberSnapshot,
  Membership,
} from "../identity/types.js";

const AVATAR_STEM = "avatar";
const AVATAR_EXTS = [".jpeg", ".jpg", ".png", ".webp", ".gif"] as const;

export function membersDir(workspaceRoot: string): string {
  return membersRoot(workspaceRoot);
}

export function memberDirPath(workspaceRoot: string, id: EntityId): string {
  return path.join(membersRoot(workspaceRoot), id);
}

export function memberPropsPath(workspaceRoot: string, id: EntityId): string {
  return path.join(memberDirPath(workspaceRoot, id), "props.ts");
}

export function memberReadmePath(workspaceRoot: string, id: EntityId): string {
  return path.join(memberDirPath(workspaceRoot, id), "README.md");
}

function assertValidMemberId(id: string): asserts id is EntityId {
  if (parseId(id) === null) {
    throw new Error(`Invalid member id: ${JSON.stringify(id)}`);
  }
}

export function isMembership(v: unknown): v is Membership {
  return v === "involved" || v === "left";
}

/** Find `avatar.<ext>` in the member dir (files only). */
export function findMemberAvatarPath(
  workspaceRoot: string,
  id: EntityId,
): string | null {
  const dir = memberDirPath(workspaceRoot, id);
  if (!fs.existsSync(dir)) {
    return null;
  }
  for (const ext of AVATAR_EXTS) {
    const candidate = path.join(dir, `${AVATAR_STEM}${ext}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  // Also accept any avatar.* that is a file
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith(`${AVATAR_STEM}.`)) {
      continue;
    }
    const full = path.join(dir, name);
    if (fs.statSync(full).isFile()) {
      return full;
    }
  }
  return null;
}

/**
 * Copy a source image into `members/<id>/avatar.<ext>`.
 * Removes any previous avatar.* first.
 */
export function setMemberAvatar(
  workspaceRoot: string,
  id: EntityId,
  sourcePath: string,
): string {
  assertValidMemberId(id);
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    throw new Error(`Not a readable file: ${JSON.stringify(sourcePath)}`);
  }
  const dir = memberDirPath(workspaceRoot, id);
  if (!fs.existsSync(dir)) {
    throw new Error(`Member not found: ${id}`);
  }
  const ext = path.extname(sourcePath).toLowerCase() || ".jpeg";
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(`${AVATAR_STEM}.`)) {
      fs.unlinkSync(path.join(dir, name));
    }
  }
  const dest = path.join(dir, `${AVATAR_STEM}${ext}`);
  fs.copyFileSync(sourcePath, dest);
  return dest;
}

export function listMemberIdsOnDisk(workspaceRoot: string): EntityId[] {
  const root = membersRoot(workspaceRoot);
  if (!fs.existsSync(root)) {
    return [];
  }
  const ids: EntityId[] = [];
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    if (!fs.statSync(full).isDirectory()) {
      continue;
    }
    const id = parseId(name);
    if (id) {
      ids.push(id);
    }
  }
  return ids.sort();
}

export function listInvalidMemberNames(workspaceRoot: string): string[] {
  const root = membersRoot(workspaceRoot);
  if (!fs.existsSync(root)) {
    return [];
  }
  const bad: string[] = [];
  for (const name of fs.readdirSync(root)) {
    const full = path.join(root, name);
    if (!fs.statSync(full).isDirectory()) {
      continue;
    }
    if (parseId(name) === null) {
      bad.push(name);
    }
  }
  return bad.sort();
}

export async function readMemberMeta(
  workspaceRoot: string,
  id: EntityId,
): Promise<MemberMeta | null> {
  assertValidMemberId(id);
  const dir = memberDirPath(workspaceRoot, id);
  const propsFile = memberPropsPath(workspaceRoot, id);
  if (!fs.existsSync(dir) || !fs.existsSync(propsFile)) {
    return null;
  }
  const props = await loadMemberProps(fs.readFileSync(propsFile, "utf8"));
  const record = props as Record<string, unknown>;
  const ts = resolveTimestamps(record);
  if (ts.seeded) {
    const next = { ...record };
    delete next.id;
    next.created = ts.created;
    next.updated = ts.updated;
    if (!isMembership(next.membership)) {
      next.membership = "involved";
    }
    fs.writeFileSync(propsFile, writePropsTs(next), "utf8");
  }
  const membership: Membership = isMembership(props.membership)
    ? props.membership
    : "involved";
  return {
    id,
    path: dir,
    relPath: path.relative(workspaceRoot, dir),
    title: props.title,
    membership,
    avatarPath: findMemberAvatarPath(workspaceRoot, id),
    created: ts.created,
    updated: ts.updated,
  };
}

export async function ensureMembers(
  workspaceRoot: string,
): Promise<MemberSnapshot> {
  fs.mkdirSync(membersRoot(workspaceRoot), { recursive: true });
  return getMemberSnapshot(workspaceRoot);
}

export async function getMemberSnapshot(
  workspaceRoot: string,
): Promise<MemberSnapshot> {
  const nodes: MemberMeta[] = [];
  for (const id of listMemberIdsOnDisk(workspaceRoot)) {
    const meta = await readMemberMeta(workspaceRoot, id);
    if (meta) {
      nodes.push(meta);
    }
  }
  return {
    nodes,
    invalidNames: listInvalidMemberNames(workspaceRoot),
  };
}

export async function getMember(
  workspaceRoot: string,
  id: EntityId,
): Promise<Member> {
  assertValidMemberId(id);
  const meta = await readMemberMeta(workspaceRoot, id);
  if (!meta) {
    throw new Error(`Member not found: ${id}`);
  }
  const body = fs.existsSync(memberReadmePath(workspaceRoot, id))
    ? fs.readFileSync(memberReadmePath(workspaceRoot, id), "utf8")
    : "";
  return { ...meta, body };
}

/** Data URL for `<img src>` — null when no avatar. Dual-bridge friendly. */
export function getMemberAvatarDataUrl(
  workspaceRoot: string,
  id: EntityId,
): string | null {
  assertValidMemberId(id);
  const avatarPath = findMemberAvatarPath(workspaceRoot, id);
  if (!avatarPath) {
    return null;
  }
  const ext = path.extname(avatarPath).toLowerCase();
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
          ? "image/gif"
          : "image/jpeg";
  const buf = fs.readFileSync(avatarPath);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function createMember(
  workspaceRoot: string,
  input: CreateMemberInput = {},
): Promise<Member> {
  await ensureMembers(workspaceRoot);
  const title = (input.title?.trim() || "Untitled").slice(0, 120);
  const membership: Membership = isMembership(input.membership)
    ? input.membership
    : "involved";
  const id = allocateMemberId(workspaceRoot);
  const body = input.body !== undefined ? input.body : "";
  const now = nowIsoUtcZ();
  const dir = memberDirPath(workspaceRoot, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    memberPropsPath(workspaceRoot, id),
    writePropsTs({ title, membership, created: now, updated: now }),
    "utf8",
  );
  fs.writeFileSync(memberReadmePath(workspaceRoot, id), body, "utf8");
  return getMember(workspaceRoot, id);
}

export async function updateMember(
  workspaceRoot: string,
  id: EntityId,
  patch: MemberPatch,
  options: { expected?: MemberEditableSlice } = {},
): Promise<Member> {
  assertValidMemberId(id);
  const meta = await readMemberMeta(workspaceRoot, id);
  if (!meta) {
    throw new Error(`Member not found: ${id}`);
  }
  const current = await getMember(workspaceRoot, id);
  if (options.expected) {
    const disk = pickMemberEditable(current);
    const conflicts: string[] = [];
    if (
      patch.title !== undefined &&
      !equalsForSync(disk.title, options.expected.title)
    ) {
      conflicts.push("title");
    }
    if (
      patch.body !== undefined &&
      !equalsForSync(disk.body, options.expected.body)
    ) {
      conflicts.push("body");
    }
    if (
      patch.membership !== undefined &&
      !equalsForSync(disk.membership, options.expected.membership)
    ) {
      conflicts.push("membership");
    }
    if (conflicts.length > 0) {
      throw new StaleWriteError(
        `Member changed on disk (${conflicts.join(", ")}). Reload or keep editing.`,
        conflicts,
      );
    }
  }
  const propsFile = memberPropsPath(workspaceRoot, id);
  const readmeFile = memberReadmePath(workspaceRoot, id);
  let props: Record<string, unknown> = {
    title: meta.title,
    membership: meta.membership,
    created: meta.created,
    updated: meta.updated,
  };
  if (fs.existsSync(propsFile)) {
    try {
      props = {
        ...((await loadMemberProps(
          fs.readFileSync(propsFile, "utf8"),
        )) as Record<string, unknown>),
      };
    } catch {
      // keep seeded
    }
  }

  const contentWrite =
    patch.title !== undefined ||
    patch.body !== undefined ||
    patch.membership !== undefined;
  if (!contentWrite) {
    return getMember(workspaceRoot, id);
  }

  if (patch.body !== undefined) {
    fs.writeFileSync(readmeFile, patch.body, "utf8");
  }
  if (patch.title !== undefined) {
    const nextTitle = patch.title.trim();
    if (!nextTitle) {
      throw new Error("Member title is required.");
    }
    props.title = nextTitle;
  }
  if (patch.membership !== undefined) {
    if (!isMembership(patch.membership)) {
      throw new Error(`Invalid membership: ${String(patch.membership)}`);
    }
    props.membership = patch.membership;
  }

  const stamped = stampOnWrite({
    created: isIsoDateTimeZ(props.created) ? props.created : meta.created,
    updated: props.updated,
  });
  props.created = stamped.created;
  props.updated = stamped.updated;
  delete props.id;
  fs.writeFileSync(propsFile, writePropsTs(props), "utf8");
  return getMember(workspaceRoot, id);
}

/**
 * Migration helper: set createdBy / assignee on existing nodes without bumping
 * `updated`. This is not a normal edit.
 */
export async function backfillMemberRefs(
  workspaceRoot: string,
  options: {
    createdBy: EntityId;
    assignee?: EntityId | null;
  },
): Promise<{
  projects: number;
  issues: number;
  wikiNodes: number;
}> {
  assertValidMemberId(options.createdBy);
  if (options.assignee != null) {
    assertValidMemberId(options.assignee);
  }
  const { listProjects, listIssues } = await import("./store.js");
  const { listWikiNodeIdsOnDisk, wikiNodeDirPath } = await import("./wiki.js");

  let projects = 0;
  let issues = 0;
  let wikiNodes = 0;

  for (const project of await listProjects(workspaceRoot)) {
    const propsFile = path.join(project.path, "project.ts");
    const raw = await loadMemberPropsForBackfill(propsFile);
    if (raw) {
      raw.createdBy = options.createdBy;
      // preserve created/updated exactly
      fs.writeFileSync(propsFile, writePropsTs(raw), "utf8");
      projects += 1;
    }
  }

  for (const issue of await listIssues(workspaceRoot)) {
    const propsFile = path.join(issue.path, "props.ts");
    if (!fs.existsSync(propsFile)) {
      continue;
    }
    const { loadIssueProps } = await import("../infra/props-load.js");
    const { LEVEL_TYPE_NAME } = await import("../infra/schema-dts.js");
    const props = {
      ...((await loadIssueProps(
        fs.readFileSync(propsFile, "utf8"),
      )) as Record<string, unknown>),
    };
    props.createdBy = options.createdBy;
    if (options.assignee !== undefined) {
      props.assignee = options.assignee;
    }
    // keep level / parentId / timestamps / satisfies
    fs.writeFileSync(
      propsFile,
      writePropsTs(props, { satisfies: LEVEL_TYPE_NAME[issue.level] }),
      "utf8",
    );
    issues += 1;
  }

  for (const id of listWikiNodeIdsOnDisk(workspaceRoot)) {
    const propsFile = path.join(wikiNodeDirPath(workspaceRoot, id), "props.ts");
    const raw = await loadMemberPropsForBackfill(propsFile);
    if (raw) {
      raw.createdBy = options.createdBy;
      fs.writeFileSync(propsFile, writePropsTs(raw), "utf8");
      wikiNodes += 1;
    }
  }

  return { projects, issues, wikiNodes };
}

async function loadMemberPropsForBackfill(
  propsFile: string,
): Promise<Record<string, unknown> | null> {
  if (!fs.existsSync(propsFile)) {
    return null;
  }
  const { evaluatePropsExport } = await import("../infra/props-load.js");
  const raw = await evaluatePropsExport(fs.readFileSync(propsFile, "utf8"));
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return { ...(raw as Record<string, unknown>) };
}
