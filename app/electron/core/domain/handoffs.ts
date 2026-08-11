/**
 * Workspace handoffs: `handoffs/<id>/{props.ts,README.md}`.
 * One directory = one sent handoff. from/to are member ids. No delete in v1.
 *
 * ↔ electron/core/sync/detail-diff.ts — OCC expected / StaleWriteError on updateHandoff
 * ↔ electron/main.ts — IPC encodeStaleWriteMessage on OCC
 * ↔ server/main.ts — HTTP twin PATCH /api/handoffs/:id
 * ↔ src/lib/bridge/pm-api.ts — updateHandoff expected option
 */
import fs from "node:fs";
import path from "node:path";

import { parseId, type EntityId } from "../identity/dir-id.js";
import {
  equalsForSync,
  pickHandoffEditable,
  StaleWriteError,
  type HandoffEditableSlice,
} from "../sync/detail-diff.js";
import { allocateHandoffId, handoffsRoot, hierarchyRoot } from "../identity/ids.js";
import { memberDirPath } from "./members.js";
import { loadHandoffProps, writePropsTs } from "../infra/props-load.js";
import { projectDirPath } from "./store.js";
import {
  isIsoDateTimeZ,
  nowIsoUtcZ,
  resolveTimestamps,
  stampOnWrite,
} from "../infra/timestamps.js";
import type {
  CreateHandoffInput,
  Handoff,
  HandoffMeta,
  HandoffPatch,
  HandoffSnapshot,
} from "../identity/types.js";

export function handoffsDir(workspaceRoot: string): string {
  return handoffsRoot(workspaceRoot);
}

export function handoffDirPath(workspaceRoot: string, id: EntityId): string {
  return path.join(handoffsRoot(workspaceRoot), id);
}

export function handoffPropsPath(workspaceRoot: string, id: EntityId): string {
  return path.join(handoffDirPath(workspaceRoot, id), "props.ts");
}

export function handoffReadmePath(workspaceRoot: string, id: EntityId): string {
  return path.join(handoffDirPath(workspaceRoot, id), "README.md");
}

function assertValidHandoffId(id: string): asserts id is EntityId {
  if (parseId(id) === null) {
    throw new Error(`Invalid handoff id: ${JSON.stringify(id)}`);
  }
}

function assertMemberExists(workspaceRoot: string, id: EntityId, field: string): void {
  const dir = memberDirPath(workspaceRoot, id);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Handoff ${field} member not found: ${id}`);
  }
}

function assertProjectExists(
  workspaceRoot: string,
  id: EntityId,
  field: string,
): void {
  const dir = projectDirPath(workspaceRoot, id);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Handoff ${field} project not found: ${id}`);
  }
}

function firstProjectIdOnDisk(workspaceRoot: string): EntityId | null {
  const root = hierarchyRoot(workspaceRoot);
  if (!fs.existsSync(root)) {
    return null;
  }
  for (const name of fs.readdirSync(root).sort()) {
    const full = path.join(root, name);
    if (!fs.statSync(full).isDirectory()) {
      continue;
    }
    const id = parseId(name);
    if (id) {
      return id;
    }
  }
  return null;
}

export function listHandoffIdsOnDisk(workspaceRoot: string): EntityId[] {
  const root = handoffsRoot(workspaceRoot);
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

export function listInvalidHandoffNames(workspaceRoot: string): string[] {
  const root = handoffsRoot(workspaceRoot);
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

export async function readHandoffMeta(
  workspaceRoot: string,
  id: EntityId,
): Promise<HandoffMeta | null> {
  assertValidHandoffId(id);
  const dir = handoffDirPath(workspaceRoot, id);
  const propsFile = handoffPropsPath(workspaceRoot, id);
  if (!fs.existsSync(dir) || !fs.existsSync(propsFile)) {
    return null;
  }
  const props = await loadHandoffProps(fs.readFileSync(propsFile, "utf8"));
  const record = props as Record<string, unknown>;
  const ts = resolveTimestamps(record);
  const hadDescription = typeof record.description === "string";
  const description = hadDescription ? (record.description as string) : "";
  const hadRelated =
    typeof record.relatedProject === "string" &&
    parseId(record.relatedProject) !== null;
  let relatedProject = hadRelated
    ? (record.relatedProject as EntityId)
    : null;
  if (!relatedProject) {
    relatedProject = firstProjectIdOnDisk(workspaceRoot);
  }
  if (!relatedProject) {
    throw new Error(
      `Handoff ${id} is missing relatedProject and no project exists to seed`,
    );
  }
  const hadOpen = typeof record.open === "boolean";
  const open = hadOpen ? (record.open as boolean) : true;
  if (ts.seeded || !hadDescription || !hadRelated || !hadOpen) {
    const next = { ...record };
    delete next.id;
    next.created = ts.created;
    next.updated = ts.updated;
    next.description = description;
    next.relatedProject = relatedProject;
    next.open = open;
    fs.writeFileSync(propsFile, writePropsTs(next), "utf8");
  }
  const from = props.from as EntityId;
  const to = props.to as EntityId;
  return {
    id,
    path: dir,
    relPath: path.relative(workspaceRoot, dir),
    title: props.title,
    description,
    relatedProject,
    open,
    from,
    to,
    created: ts.created,
    updated: ts.updated,
  };
}

export async function ensureHandoffs(
  workspaceRoot: string,
): Promise<HandoffSnapshot> {
  fs.mkdirSync(handoffsRoot(workspaceRoot), { recursive: true });
  return getHandoffSnapshot(workspaceRoot);
}

export async function getHandoffSnapshot(
  workspaceRoot: string,
): Promise<HandoffSnapshot> {
  const nodes: HandoffMeta[] = [];
  for (const id of listHandoffIdsOnDisk(workspaceRoot)) {
    const meta = await readHandoffMeta(workspaceRoot, id);
    if (meta) {
      nodes.push(meta);
    }
  }
  // Newest → oldest by created (send time).
  nodes.sort((a, b) => {
    if (a.created === b.created) {
      return b.id.localeCompare(a.id);
    }
    return a.created < b.created ? 1 : -1;
  });
  return {
    nodes,
    invalidNames: listInvalidHandoffNames(workspaceRoot),
  };
}

export async function getHandoff(
  workspaceRoot: string,
  id: EntityId,
): Promise<Handoff> {
  assertValidHandoffId(id);
  const meta = await readHandoffMeta(workspaceRoot, id);
  if (!meta) {
    throw new Error(`Handoff not found: ${id}`);
  }
  const body = fs.existsSync(handoffReadmePath(workspaceRoot, id))
    ? fs.readFileSync(handoffReadmePath(workspaceRoot, id), "utf8")
    : "";
  return { ...meta, body };
}

export async function createHandoff(
  workspaceRoot: string,
  input: CreateHandoffInput,
): Promise<Handoff> {
  await ensureHandoffs(workspaceRoot);
  const from = input.from;
  const to = input.to;
  if (!from || parseId(from) === null) {
    throw new Error("Handoff from (member id) is required");
  }
  if (!to || parseId(to) === null) {
    throw new Error("Handoff to (member id) is required");
  }
  assertMemberExists(workspaceRoot, from, "from");
  assertMemberExists(workspaceRoot, to, "to");
  const relatedProject = input.relatedProject;
  if (!relatedProject || parseId(relatedProject) === null) {
    throw new Error("Handoff relatedProject (project id) is required");
  }
  assertProjectExists(workspaceRoot, relatedProject, "relatedProject");
  const open = input.open !== undefined ? Boolean(input.open) : true;
  const title = (input.title?.trim() || "Untitled").slice(0, 120);
  const description = input.description !== undefined ? input.description : "";
  const id = allocateHandoffId(workspaceRoot);
  const body = input.body !== undefined ? input.body : "";
  const now = nowIsoUtcZ();
  const dir = handoffDirPath(workspaceRoot, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    handoffPropsPath(workspaceRoot, id),
    writePropsTs({
      title,
      description,
      relatedProject,
      open,
      from,
      to,
      created: now,
      updated: now,
    }),
    "utf8",
  );
  fs.writeFileSync(handoffReadmePath(workspaceRoot, id), body, "utf8");
  return getHandoff(workspaceRoot, id);
}

export async function updateHandoff(
  workspaceRoot: string,
  id: EntityId,
  patch: HandoffPatch,
  options: { expected?: HandoffEditableSlice } = {},
): Promise<Handoff> {
  assertValidHandoffId(id);
  const meta = await readHandoffMeta(workspaceRoot, id);
  if (!meta) {
    throw new Error(`Handoff not found: ${id}`);
  }
  const current = await getHandoff(workspaceRoot, id);
  if (options.expected) {
    const disk = pickHandoffEditable(current);
    const conflicts: string[] = [];
    if (
      patch.title !== undefined &&
      !equalsForSync(disk.title, options.expected.title)
    ) {
      conflicts.push("title");
    }
    if (
      patch.description !== undefined &&
      !equalsForSync(disk.description, options.expected.description)
    ) {
      conflicts.push("description");
    }
    if (
      patch.relatedProject !== undefined &&
      !equalsForSync(disk.relatedProject, options.expected.relatedProject)
    ) {
      conflicts.push("relatedProject");
    }
    if (
      patch.open !== undefined &&
      !equalsForSync(disk.open, options.expected.open)
    ) {
      conflicts.push("open");
    }
    if (
      patch.body !== undefined &&
      !equalsForSync(disk.body, options.expected.body)
    ) {
      conflicts.push("body");
    }
    if (
      patch.from !== undefined &&
      !equalsForSync(disk.from, options.expected.from)
    ) {
      conflicts.push("from");
    }
    if (
      patch.to !== undefined &&
      !equalsForSync(disk.to, options.expected.to)
    ) {
      conflicts.push("to");
    }
    if (conflicts.length > 0) {
      throw new StaleWriteError(
        `Handoff changed on disk (${conflicts.join(", ")}). Reload or keep editing.`,
        conflicts,
      );
    }
  }
  const propsFile = handoffPropsPath(workspaceRoot, id);
  const readmeFile = handoffReadmePath(workspaceRoot, id);
  let props: Record<string, unknown> = {
    title: meta.title,
    description: meta.description,
    relatedProject: meta.relatedProject,
    open: meta.open,
    from: meta.from,
    to: meta.to,
    created: meta.created,
    updated: meta.updated,
  };
  if (fs.existsSync(propsFile)) {
    try {
      props = {
        ...((await loadHandoffProps(
          fs.readFileSync(propsFile, "utf8"),
        )) as Record<string, unknown>),
      };
    } catch {
      // keep seeded
    }
  }

  const contentWrite =
    patch.title !== undefined ||
    patch.description !== undefined ||
    patch.relatedProject !== undefined ||
    patch.open !== undefined ||
    patch.body !== undefined ||
    patch.from !== undefined ||
    patch.to !== undefined;
  if (!contentWrite) {
    return getHandoff(workspaceRoot, id);
  }

  if (patch.body !== undefined) {
    fs.writeFileSync(readmeFile, patch.body, "utf8");
  }
  if (patch.title !== undefined) {
    const nextTitle = patch.title.trim();
    if (!nextTitle) {
      throw new Error("Handoff title is required.");
    }
    props.title = nextTitle;
  }
  if (patch.description !== undefined) {
    props.description = patch.description;
  } else if (typeof props.description !== "string") {
    props.description = meta.description;
  }
  if (patch.relatedProject !== undefined) {
    if (parseId(patch.relatedProject) === null) {
      throw new Error(
        `Invalid handoff relatedProject: ${String(patch.relatedProject)}`,
      );
    }
    assertProjectExists(workspaceRoot, patch.relatedProject, "relatedProject");
    props.relatedProject = patch.relatedProject;
  } else if (
    typeof props.relatedProject !== "string" ||
    parseId(props.relatedProject) === null
  ) {
    props.relatedProject = meta.relatedProject;
  }
  if (patch.open !== undefined) {
    props.open = Boolean(patch.open);
  } else if (typeof props.open !== "boolean") {
    props.open = meta.open;
  }
  if (patch.from !== undefined) {
    if (parseId(patch.from) === null) {
      throw new Error(`Invalid handoff from: ${String(patch.from)}`);
    }
    assertMemberExists(workspaceRoot, patch.from, "from");
    props.from = patch.from;
  }
  if (patch.to !== undefined) {
    if (parseId(patch.to) === null) {
      throw new Error(`Invalid handoff to: ${String(patch.to)}`);
    }
    assertMemberExists(workspaceRoot, patch.to, "to");
    props.to = patch.to;
  }

  const stamped = stampOnWrite({
    created: isIsoDateTimeZ(props.created) ? props.created : meta.created,
    updated: props.updated,
  });
  props.created = stamped.created;
  props.updated = stamped.updated;
  delete props.id;
  fs.writeFileSync(propsFile, writePropsTs(props), "utf8");
  return getHandoff(workspaceRoot, id);
}
