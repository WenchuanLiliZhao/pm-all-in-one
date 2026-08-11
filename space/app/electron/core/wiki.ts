/**
 * Workspace documentation: `wiki/<id>/{props.ts,README.md}` + `wiki/sidebar.ts` nav SoT.
 * Ids are opaque nanoid(21) tokens (never renamed). See space/important-notes/nodes.md.
 *
 * ↔ electron/core/detail-diff.ts — OCC expected / StaleWriteError on updateWikiNode
 * ↔ electron/main.ts — IPC encodeStaleWriteMessage on OCC
 * ↔ server/main.ts — HTTP twin PATCH /api/wiki/:id
 * ↔ src/lib/bridge/pm-api.ts — updateWikiNode expected option
 */
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import { isValidEntityId, parseId, type EntityId } from "./dir-id.js";
import { allocateWikiNodeId } from "./ids.js";
import { resolveActorMemberId } from "./local-config.js";
import {
  equalsForSync,
  pickWikiEditable,
  StaleWriteError,
  type WikiEditableSlice,
} from "./detail-diff.js";
import {
  evaluatePropsExport,
  loadWikiNodeProps,
  writePropsTs,
} from "./props-load.js";
import {
  isIsoDateTimeZ,
  nowIsoUtcZ,
  resolveTimestamps,
  stampOnWrite,
} from "./timestamps.js";

function optionalMemberId(value: unknown): EntityId | null {
  if (typeof value === "string" && isValidEntityId(value)) {
    return value;
  }
  return null;
}

/** Nav entry pointing at a wiki-node. Disk may still say `page`; normalize on read. */
export type WikiSidebarRefNode = {
  type: "ref";
  id: EntityId;
  label?: string;
  children?: WikiSidebarNode[];
};

/** @deprecated Use WikiSidebarRefNode */
export type WikiSidebarPageNode = WikiSidebarRefNode;

export type WikiSidebarGroupNode = {
  type: "group";
  title: string;
  children: WikiSidebarNode[];
};

export type WikiSidebarLinkNode = {
  type: "link";
  label: string;
  href: string;
};

export type WikiSidebarNode =
  | WikiSidebarRefNode
  | WikiSidebarGroupNode
  | WikiSidebarLinkNode;

export class WikiSidebarUnreadableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WikiSidebarUnreadableError";
  }
}

export type SidebarReadResult =
  | { ok: true; nodes: WikiSidebarNode[] }
  | { ok: false; reason: string };

export interface WikiNode {
  id: EntityId;
  /** Absolute directory path */
  path: string;
  relPath: string;
  body: string;
  title: string;
  /** Short blurb; required key, may be "". */
  description: string;
  created: string;
  updated: string;
  createdBy: EntityId | null;
}

export interface WikiNodeMeta {
  id: EntityId;
  path: string;
  relPath: string;
  title: string;
  description: string;
  created: string;
  updated: string;
  createdBy: EntityId | null;
}

export interface WikiSnapshot {
  sidebar: WikiSidebarNode[];
  nodes: WikiNodeMeta[];
  /**
   * Ids on disk not in Contents. After getWikiSnapshot reconcile this is
   * always []; doctor still reports wiki-unlisted for hand-edited orphans.
   */
  unlisted: string[];
  /** Sidebar ref ids with no file. */
  broken: string[];
  /** Non-id `.md` leftovers (legacy kebab slugs, etc.). */
  invalidNames: string[];
}

export interface CreateWikiNodeInput {
  title?: string;
  description?: string;
  /** Insert under this Contents ref as child when found; else root append. */
  parentId?: EntityId | null;
  body?: string;
  /** Optional create-time actor; falls back to `.pm/local.json` `me`. */
  actorMemberId?: EntityId | null;
}

export interface WikiNodePatch {
  title?: string;
  description?: string;
  body?: string;
}

const SidebarRefZod: z.ZodType<WikiSidebarRefNode> = z.lazy(() =>
  z.object({
    type: z.literal("ref"),
    id: z.string().min(1),
    label: z.string().optional(),
    children: z.array(SidebarNodeZod).optional(),
  }),
);

const SidebarGroupZod: z.ZodType<WikiSidebarGroupNode> = z.lazy(() =>
  z.object({
    type: z.literal("group"),
    title: z.string().min(1),
    children: z.array(SidebarNodeZod),
  }),
);

const SidebarLinkZod = z.object({
  type: z.literal("link"),
  label: z.string().min(1),
  href: z.string().min(1),
});

const SidebarNodeZod: z.ZodType<WikiSidebarNode> = z.lazy(() =>
  z.union([SidebarRefZod, SidebarGroupZod, SidebarLinkZod]),
);

/**
 * Old workspaces wrote `type: "ref"`; normalize to `ref` before Zod.
 * Recurses into children of ref/group nodes.
 */
export function normalizeSidebarTags(raw: unknown): unknown {
  if (!Array.isArray(raw)) {
    return raw;
  }
  return raw.map((node) => {
    if (!node || typeof node !== "object") {
      return node;
    }
    const n = node as Record<string, unknown>;
    const type = n.type === "page" ? "ref" : n.type;
    if (type === "ref") {
      const children = n.children;
      const next: Record<string, unknown> = { ...n, type: "ref" };
      if (Array.isArray(children)) {
        next.children = normalizeSidebarTags(children);
      } else {
        delete next.children;
      }
      return next;
    }
    if (type === "group") {
      return {
        ...n,
        type: "group",
        children: Array.isArray(n.children)
          ? normalizeSidebarTags(n.children)
          : [],
      };
    }
    return { ...n, type };
  });
}

const SidebarFileZod = z.array(SidebarNodeZod);

/**
 * One-shot: rename legacy `doc/` → `wiki/`.
 */
export function migrateDocDirToWiki(workspaceRoot: string): void {
  const wiki = path.join(workspaceRoot, "wiki");
  const doc = path.join(workspaceRoot, "doc");
  if (!fs.existsSync(wiki) && fs.existsSync(doc) && fs.statSync(doc).isDirectory()) {
    fs.renameSync(doc, wiki);
  }
}

export function wikiDir(workspaceRoot: string): string {
  migrateDocDirToWiki(workspaceRoot);
  return path.join(workspaceRoot, "wiki");
}

export function sidebarPath(workspaceRoot: string): string {
  return path.join(wikiDir(workspaceRoot), "sidebar.ts");
}

export function wikiNodeDirPath(workspaceRoot: string, id: EntityId): string {
  return path.join(wikiDir(workspaceRoot), id);
}

export function wikiNodePropsPath(workspaceRoot: string, id: EntityId): string {
  return path.join(wikiNodeDirPath(workspaceRoot, id), "props.ts");
}

export function wikiNodeReadmePath(workspaceRoot: string, id: EntityId): string {
  return path.join(wikiNodeDirPath(workspaceRoot, id), "README.md");
}

/** @deprecated Prefer wikiNodeReadmePath; kept for callers checking legacy flat files. */
export function wikiNodeLegacyFilePath(workspaceRoot: string, id: EntityId): string {
  return path.join(wikiDir(workspaceRoot), `${id}.md`);
}

export function assertValidWikiNodeId(id: string): asserts id is EntityId {
  if (parseId(id) === null) {
    throw new Error(
      `Invalid wiki-node id "${id}": expected nanoid(21) entity id.`,
    );
  }
}

export function titleFromBody(body: string, id: EntityId): string {
  const m = /^#\s+(.+)$/m.exec(body);
  const heading = m?.[1]?.trim();
  return heading || id;
}

function isWikiNodeDir(workspaceRoot: string, id: EntityId): boolean {
  const dir = wikiNodeDirPath(workspaceRoot, id);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return false;
  }
  return (
    fs.existsSync(wikiNodePropsPath(workspaceRoot, id)) ||
    fs.existsSync(wikiNodeReadmePath(workspaceRoot, id))
  );
}

/**
 * One-shot: `wiki/<id>.md` → `wiki/<id>/{props.ts,README.md}`.
 * Prefers existing dir; removes leftover flat file after migrate.
 */
export function migrateLegacyFlatWikiNodes(workspaceRoot: string): void {
  const dir = wikiDir(workspaceRoot);
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".md")) {
      continue;
    }
    const id = name.slice(0, -3);
    if (parseId(id) === null) {
      continue;
    }
    const flat = path.join(dir, name);
    if (!fs.statSync(flat).isFile()) {
      continue;
    }
    const body = fs.readFileSync(flat, "utf8");
    const destDir = wikiNodeDirPath(workspaceRoot, id);
    const propsFile = wikiNodePropsPath(workspaceRoot, id);
    const readmeFile = wikiNodeReadmePath(workspaceRoot, id);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    if (!fs.existsSync(readmeFile)) {
      fs.writeFileSync(readmeFile, body, "utf8");
    }
    if (!fs.existsSync(propsFile)) {
      const now = nowIsoUtcZ();
      const title = titleFromBody(body, id);
      fs.writeFileSync(
        propsFile,
        writePropsTs({ title, description: "", created: now, updated: now }),
        "utf8",
      );
    }
    fs.unlinkSync(flat);
  }
}

function evaluatePropsExportSync(source: string): unknown {
  const result = esbuild.transformSync(source, {
    loader: "ts",
    format: "cjs",
    target: "node20",
  });
  const factory = new Function(
    "exports",
    "module",
    `${result.code}\n; return module.exports.props ?? exports.props;`,
  );
  const exports: Record<string, unknown> = {};
  const module = { exports };
  const props = factory(exports, module);
  if (props === undefined) {
    throw new Error("Expected `export const props = { ... }`");
  }
  return props;
}

function serializeValue(value: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  const padIn = "  ".repeat(indent + 1);
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((v) => `${padIn}${serializeValue(v, indent + 1)}`);
    return `[\n${items.join(",\n")}\n${pad}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) {
      return "{}";
    }
    const lines = entries.map(
      ([k, v]) => `${padIn}${JSON.stringify(k)}: ${serializeValue(v, indent + 1)}`,
    );
    return `{\n${lines.join(",\n")}\n${pad}}`;
  }
  return "null";
}

function writeSidebarTsSource(nodes: WikiSidebarNode[]): string {
  return `export const props = ${serializeValue(nodes, 0)} as const;\n`;
}

function persistSidebar(workspaceRoot: string, nodes: WikiSidebarNode[]): void {
  const file = sidebarPath(workspaceRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, writeSidebarTsSource(nodes), "utf8");
}

export function defaultWikiSidebar(): WikiSidebarNode[] {
  return [];
}

function parseSidebarRaw(raw: unknown): WikiSidebarNode[] {
  return SidebarFileZod.parse(normalizeSidebarTags(raw));
}

export function readSidebarResultSync(
  workspaceRoot: string,
): SidebarReadResult {
  const file = sidebarPath(workspaceRoot);
  if (!fs.existsSync(file)) {
    return { ok: true, nodes: defaultWikiSidebar() };
  }
  try {
    const raw = evaluatePropsExportSync(fs.readFileSync(file, "utf8"));
    return { ok: true, nodes: parseSidebarRaw(raw) };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function readSidebarResult(
  workspaceRoot: string,
): Promise<SidebarReadResult> {
  const file = sidebarPath(workspaceRoot);
  if (!fs.existsSync(file)) {
    return { ok: true, nodes: defaultWikiSidebar() };
  }
  try {
    const raw = await evaluatePropsExport(fs.readFileSync(file, "utf8"));
    return { ok: true, nodes: parseSidebarRaw(raw) };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Throws if sidebar.ts exists but is unreadable — never treat as empty for mutators. */
export function requireReadableSidebarSync(
  workspaceRoot: string,
): WikiSidebarNode[] {
  const result = readSidebarResultSync(workspaceRoot);
  if (!result.ok) {
    throw new WikiSidebarUnreadableError(
      `wiki/sidebar.ts is unreadable: ${result.reason}`,
    );
  }
  return result.nodes;
}

export async function requireReadableSidebar(
  workspaceRoot: string,
): Promise<WikiSidebarNode[]> {
  const result = await readSidebarResult(workspaceRoot);
  if (!result.ok) {
    throw new WikiSidebarUnreadableError(
      `wiki/sidebar.ts is unreadable: ${result.reason}`,
    );
  }
  return result.nodes;
}

/** Soft read for snapshot/UI: unreadable → empty array (doctor reports separately). */
export function readSidebarSync(workspaceRoot: string): WikiSidebarNode[] {
  const result = readSidebarResultSync(workspaceRoot);
  return result.ok ? result.nodes : defaultWikiSidebar();
}

export async function readSidebar(
  workspaceRoot: string,
): Promise<WikiSidebarNode[]> {
  const result = await readSidebarResult(workspaceRoot);
  return result.ok ? result.nodes : defaultWikiSidebar();
}

export function listWikiNodeIdsOnDisk(workspaceRoot: string): EntityId[] {
  migrateLegacyFlatWikiNodes(workspaceRoot);
  const dir = wikiDir(workspaceRoot);
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out: EntityId[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (name === "sidebar.ts" || name.startsWith(".")) {
      continue;
    }
    if (parseId(name) === null) {
      continue;
    }
    if (isWikiNodeDir(workspaceRoot, name)) {
      out.push(name);
    }
  }
  return out.sort();
}

/**
 * Non-id leftovers: flat `*.md` with invalid basename, or invalid directory names.
 */
export function listInvalidWikiNodeNames(workspaceRoot: string): string[] {
  const dir = wikiDir(workspaceRoot);
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (name === "sidebar.ts" || name.startsWith(".")) {
      continue;
    }
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isFile() && name.endsWith(".md")) {
      const base = name.slice(0, -3);
      if (parseId(base) === null) {
        out.push(base);
      }
      continue;
    }
    if (st.isDirectory() && parseId(name) === null) {
      out.push(name);
    }
  }
  return out.sort();
}

export function collectSidebarWikiNodeIds(nodes: WikiSidebarNode[]): EntityId[] {
  const out: EntityId[] = [];
  const walk = (list: WikiSidebarNode[]) => {
    for (const node of list) {
      if (node.type === "ref") {
        out.push(node.id);
        if (node.children) {
          walk(node.children);
        }
      } else if (node.type === "group") {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return out;
}

function removeIdFromSidebar(
  nodes: WikiSidebarNode[],
  id: EntityId,
): WikiSidebarNode[] {
  const next: WikiSidebarNode[] = [];
  for (const node of nodes) {
    if (node.type === "ref") {
      if (node.id === id) {
        if (node.children?.length) {
          next.push(...removeIdFromSidebar(node.children, id));
        }
        continue;
      }
      next.push({
        ...node,
        children: node.children
          ? removeIdFromSidebar(node.children, id)
          : undefined,
      });
      continue;
    }
    if (node.type === "group") {
      const children = removeIdFromSidebar(node.children, id);
      if (children.length === 0) {
        continue;
      }
      next.push({ ...node, children });
      continue;
    }
    next.push(node);
  }
  return next;
}

function insertPageNode(
  nodes: WikiSidebarNode[],
  page: WikiSidebarRefNode,
  parentId: EntityId | null | undefined,
): WikiSidebarNode[] {
  if (!parentId) {
    return [...nodes, page];
  }
  let inserted = false;
  const walk = (list: WikiSidebarNode[]): WikiSidebarNode[] =>
    list.map((node) => {
      if (node.type === "ref" && node.id === parentId) {
        inserted = true;
        return {
          ...node,
          children: [...(node.children ?? []), page],
        };
      }
      if (node.type === "ref" && node.children) {
        return { ...node, children: walk(node.children) };
      }
      if (node.type === "group") {
        return { ...node, children: walk(node.children) };
      }
      return node;
    });
  const next = walk(nodes);
  return inserted ? next : [...nodes, page];
}

async function readWikiNodeMeta(
  workspaceRoot: string,
  id: EntityId,
): Promise<WikiNodeMeta | null> {
  if (!isWikiNodeDir(workspaceRoot, id)) {
    return null;
  }
  const dir = wikiNodeDirPath(workspaceRoot, id);
  const propsFile = wikiNodePropsPath(workspaceRoot, id);
  const readmeFile = wikiNodeReadmePath(workspaceRoot, id);
  const body = fs.existsSync(readmeFile)
    ? fs.readFileSync(readmeFile, "utf8")
    : "";
  let title = titleFromBody(body, id);
  let description = "";
  let created = nowIsoUtcZ();
  let updated = created;
  let createdBy: EntityId | null = null;
  if (fs.existsSync(propsFile)) {
    try {
      const props = await loadWikiNodeProps(fs.readFileSync(propsFile, "utf8"));
      title = props.title.trim() || title;
      const record = props as Record<string, unknown>;
      const ts = resolveTimestamps(record);
      created = ts.created;
      updated = ts.updated;
      createdBy = optionalMemberId(record.createdBy);
      const hadDescription = typeof record.description === "string";
      description = hadDescription ? (record.description as string) : "";
      if (ts.seeded || !hadDescription) {
        fs.writeFileSync(
          propsFile,
          writePropsTs({
            title,
            description,
            created,
            updated,
            ...(createdBy ? { createdBy } : {}),
          }),
          "utf8",
        );
      }
    } catch {
      // Fall back to body-derived title + seeded timestamps.
    }
  } else {
    fs.writeFileSync(
      propsFile,
      writePropsTs({ title, description: "", created, updated }),
      "utf8",
    );
  }
  if (!fs.existsSync(readmeFile)) {
    fs.writeFileSync(readmeFile, "", "utf8");
  }
  return {
    id,
    path: dir,
    relPath: path.relative(workspaceRoot, dir),
    title,
    description,
    created,
    updated,
    createdBy,
  };
}

/** Ensure `wiki/` + empty `sidebar.ts` exist; migrate legacy flat wiki-nodes. */
export async function ensureWiki(workspaceRoot: string): Promise<WikiSnapshot> {
  const dir = wikiDir(workspaceRoot);
  fs.mkdirSync(dir, { recursive: true });
  migrateLegacyFlatWikiNodes(workspaceRoot);
  const file = sidebarPath(workspaceRoot);
  if (!fs.existsSync(file)) {
    persistSidebar(workspaceRoot, defaultWikiSidebar());
  }
  return getWikiSnapshot(workspaceRoot);
}

async function buildWikiSnapshot(
  workspaceRoot: string,
  sidebar: WikiSidebarNode[],
): Promise<WikiSnapshot> {
  const onDisk = listWikiNodeIdsOnDisk(workspaceRoot);
  const listed = new Set(collectSidebarWikiNodeIds(sidebar));
  const nodes: WikiNodeMeta[] = [];
  for (const id of onDisk) {
    const meta = await readWikiNodeMeta(workspaceRoot, id);
    if (meta) {
      nodes.push(meta);
    }
  }
  const unlisted = onDisk.filter((s) => !listed.has(s));
  const broken = [...listed].filter((s) => !onDisk.includes(s));
  const invalidNames = listInvalidWikiNodeNames(workspaceRoot);
  return { sidebar, nodes, unlisted, broken, invalidNames };
}

/**
 * Append every on-disk wiki-node missing from Contents to the Contents root.
 * Idempotent. Used by getWikiSnapshot so the app always sees the invariant.
 */
async function reconcileUnlistedIntoContents(
  workspaceRoot: string,
  sidebar: WikiSidebarNode[],
): Promise<WikiSidebarNode[]> {
  const onDisk = listWikiNodeIdsOnDisk(workspaceRoot);
  const listed = new Set(collectSidebarWikiNodeIds(sidebar));
  const unlisted = onDisk.filter((id) => !listed.has(id));
  if (unlisted.length === 0) {
    return sidebar;
  }
  let next = sidebar;
  for (const id of unlisted) {
    const meta = await readWikiNodeMeta(workspaceRoot, id);
    const page: WikiSidebarRefNode = {
      type: "ref",
      id,
      label: meta?.title,
    };
    next = insertPageNode(next, page, null);
  }
  persistSidebar(workspaceRoot, next);
  return next;
}

export async function getWikiSnapshot(
  workspaceRoot: string,
): Promise<WikiSnapshot> {
  migrateLegacyFlatWikiNodes(workspaceRoot);
  let sidebar = await readSidebar(workspaceRoot);
  sidebar = await reconcileUnlistedIntoContents(workspaceRoot, sidebar);
  return buildWikiSnapshot(workspaceRoot, sidebar);
}

export async function getWikiNode(
  workspaceRoot: string,
  id: EntityId,
): Promise<WikiNode> {
  assertValidWikiNodeId(id);
  migrateLegacyFlatWikiNodes(workspaceRoot);
  const meta = await readWikiNodeMeta(workspaceRoot, id);
  if (!meta) {
    throw new Error(`Wiki-node not found: ${id}`);
  }
  const body = fs.existsSync(wikiNodeReadmePath(workspaceRoot, id))
    ? fs.readFileSync(wikiNodeReadmePath(workspaceRoot, id), "utf8")
    : "";
  return {
    ...meta,
    body,
  };
}

export async function createWikiNode(
  workspaceRoot: string,
  input: CreateWikiNodeInput = {},
): Promise<WikiNode> {
  await ensureWiki(workspaceRoot);
  const title = (input.title?.trim() || "Untitled").slice(0, 120);
  const description = input.description !== undefined ? input.description : "";
  const id = allocateWikiNodeId(workspaceRoot);
  const body = input.body !== undefined ? input.body : "";
  const now = nowIsoUtcZ();
  const createdBy = resolveActorMemberId(workspaceRoot, input.actorMemberId);
  const dir = wikiNodeDirPath(workspaceRoot, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    wikiNodePropsPath(workspaceRoot, id),
    writePropsTs({
      title,
      description,
      created: now,
      updated: now,
      ...(createdBy ? { createdBy } : {}),
    }),
    "utf8",
  );
  fs.writeFileSync(wikiNodeReadmePath(workspaceRoot, id), body, "utf8");

  const sidebar = await requireReadableSidebar(workspaceRoot);
  const pageNode: WikiSidebarRefNode = { type: "ref", id, label: title };
  const next = insertPageNode(sidebar, pageNode, input.parentId ?? null);
  persistSidebar(workspaceRoot, next);

  return getWikiNode(workspaceRoot, id);
}

export async function updateWikiNode(
  workspaceRoot: string,
  id: EntityId,
  patch: WikiNodePatch,
  options: { expected?: WikiEditableSlice } = {},
): Promise<WikiNode> {
  assertValidWikiNodeId(id);
  migrateLegacyFlatWikiNodes(workspaceRoot);
  const meta = await readWikiNodeMeta(workspaceRoot, id);
  if (!meta) {
    throw new Error(`Wiki-node not found: ${id}`);
  }
  const current = await getWikiNode(workspaceRoot, id);
  if (options.expected) {
    const disk = pickWikiEditable(current);
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
      patch.body !== undefined &&
      !equalsForSync(disk.body, options.expected.body)
    ) {
      conflicts.push("body");
    }
    if (conflicts.length > 0) {
      throw new StaleWriteError(
        `Wiki-node changed on disk (${conflicts.join(", ")}). Reload or keep editing.`,
        conflicts,
      );
    }
  }
  const propsFile = wikiNodePropsPath(workspaceRoot, id);
  const readmeFile = wikiNodeReadmePath(workspaceRoot, id);
  let props: Record<string, unknown> = {
    title: meta.title,
    description: meta.description,
    created: meta.created,
    updated: meta.updated,
  };
  if (fs.existsSync(propsFile)) {
    try {
      props = {
        ...((await loadWikiNodeProps(fs.readFileSync(propsFile, "utf8"))) as Record<
          string,
          unknown
        >),
      };
    } catch {
      // keep seeded props
    }
  }
  // createdBy is system — preserve from disk; never accept from patch.
  const nextCreatedBy =
    optionalMemberId(props.createdBy) ?? meta.createdBy;

  const contentWrite =
    patch.title !== undefined ||
    patch.description !== undefined ||
    patch.body !== undefined;
  if (!contentWrite) {
    return getWikiNode(workspaceRoot, id);
  }

  if (patch.body !== undefined) {
    fs.writeFileSync(readmeFile, patch.body, "utf8");
  }
  if (patch.title !== undefined) {
    const nextTitle = patch.title.trim();
    if (!nextTitle) {
      throw new Error("Wiki-node title is required.");
    }
    props.title = nextTitle;
  }
  if (patch.description !== undefined) {
    props.description = patch.description;
  } else if (typeof props.description !== "string") {
    props.description = meta.description;
  }

  // Ignore any hand-set created/updated on disk for the stamp; keep disk created.
  const stamped = stampOnWrite({
    created: isIsoDateTimeZ(props.created) ? props.created : meta.created,
    updated: props.updated,
  });
  props.created = stamped.created;
  props.updated = stamped.updated;
  delete props.id;
  if (nextCreatedBy) {
    props.createdBy = nextCreatedBy;
  } else {
    delete props.createdBy;
  }
  fs.writeFileSync(propsFile, writePropsTs(props), "utf8");

  // Keep sidebar label in sync when title changes (if listed in Contents).
  if (patch.title !== undefined) {
    const sidebarResult = await readSidebarResult(workspaceRoot);
    if (!sidebarResult.ok) {
      throw new WikiSidebarUnreadableError(
        `wiki/sidebar.ts is unreadable: ${sidebarResult.reason}`,
      );
    }
    const sidebar = sidebarResult.nodes;
    if (collectSidebarWikiNodeIds(sidebar).includes(id)) {
      const relabel = (nodes: WikiSidebarNode[]): WikiSidebarNode[] =>
        nodes.map((node) => {
          if (node.type === "ref") {
            return {
              ...node,
              label: node.id === id ? String(props.title) : node.label,
              children: node.children ? relabel(node.children) : undefined,
            };
          }
          if (node.type === "group") {
            return { ...node, children: relabel(node.children) };
          }
          return node;
        });
      persistSidebar(workspaceRoot, relabel(sidebar));
    }
  }

  return getWikiNode(workspaceRoot, id);
}

export async function deleteWikiNode(
  workspaceRoot: string,
  id: EntityId,
  options: { removeFile?: boolean } = {},
): Promise<boolean> {
  assertValidWikiNodeId(id);
  const removeFile = options.removeFile !== false;
  const sidebar = await requireReadableSidebar(workspaceRoot);
  persistSidebar(workspaceRoot, removeIdFromSidebar(sidebar, id));
  const dir = wikiNodeDirPath(workspaceRoot, id);
  const legacy = wikiNodeLegacyFilePath(workspaceRoot, id);
  let removed = false;
  if (removeFile && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    removed = true;
  }
  if (removeFile && fs.existsSync(legacy)) {
    fs.unlinkSync(legacy);
    removed = true;
  }
  return removed || (!fs.existsSync(dir) && !fs.existsSync(legacy));
}

export async function setWikiSidebar(
  workspaceRoot: string,
  nodes: WikiSidebarNode[],
): Promise<WikiSidebarNode[]> {
  await ensureWiki(workspaceRoot);
  const parsed = parseSidebarRaw(nodes);
  for (const id of collectSidebarWikiNodeIds(parsed)) {
    assertValidWikiNodeId(id);
  }
  persistSidebar(workspaceRoot, parsed);
  return requireReadableSidebar(workspaceRoot);
}

export type WikiSidebarMove = "up" | "down" | "indent" | "outdent";

/**
 * Absolute Contents placement. `index` is computed on the PRE-removal tree;
 * same-parent moves adjust when oldIndex < index.
 */
export type WikiSidebarPlacement = {
  /** null = Contents root */
  parentId: EntityId | null;
  index: number;
};

/** Collect ref ids under a node (not including the node itself). */
function collectDescendantRefIds(node: WikiSidebarRefNode): EntityId[] {
  const out: EntityId[] = [];
  const walk = (list: WikiSidebarNode[] | undefined) => {
    if (!list) {
      return;
    }
    for (const child of list) {
      if (child.type === "ref") {
        out.push(child.id);
        walk(child.children);
      } else if (child.type === "group") {
        walk(child.children);
      }
    }
  };
  walk(node.children);
  return out;
}

/**
 * Detach a ref with its subtree intact (unlike removeIdFromSidebar which hoists).
 * Mutates `sidebar` in place after cloneSidebar.
 */
function detachRefSubtree(
  sidebar: WikiSidebarNode[],
  id: EntityId,
): { node: WikiSidebarRefNode; parent: WikiSidebarNode[]; oldIndex: number } {
  const loc = findPageLocation(sidebar, id);
  if (!loc?.parent) {
    throw new Error(`Page not in sidebar: ${id}`);
  }
  const [node] = loc.parent.splice(loc.index, 1);
  if (!node || node.type !== "ref") {
    throw new Error(`Page not in sidebar: ${id}`);
  }
  return { node, parent: loc.parent, oldIndex: loc.index };
}

function resolveTargetList(
  sidebar: WikiSidebarNode[],
  parentId: EntityId | null,
): WikiSidebarNode[] {
  if (parentId === null) {
    return sidebar;
  }
  const loc = findPageLocation(sidebar, parentId);
  if (!loc || loc.node.type !== "ref") {
    throw new Error(`Contents parent not found: ${parentId}`);
  }
  if (!loc.node.children) {
    loc.node.children = [];
  }
  return loc.node.children;
}

export async function moveWikiNodeToSidebarPosition(
  workspaceRoot: string,
  id: EntityId,
  placement: WikiSidebarPlacement,
): Promise<WikiSnapshot> {
  assertValidWikiNodeId(id);
  const sidebar = cloneSidebar(await requireReadableSidebar(workspaceRoot));
  const locBefore = findPageLocation(sidebar, id);
  if (!locBefore?.parent) {
    throw new Error(`Page not in sidebar: ${id}`);
  }

  if (placement.parentId !== null) {
    assertValidWikiNodeId(placement.parentId);
  }
  if (placement.parentId === id) {
    throw new Error("Cannot move a Contents entry into its own subtree.");
  }
  if (
    placement.parentId !== null &&
    collectDescendantRefIds(locBefore.node).includes(placement.parentId)
  ) {
    throw new Error("Cannot move a Contents entry into its own subtree.");
  }

  const { node, parent: sourceList, oldIndex } = detachRefSubtree(sidebar, id);
  const targetList = resolveTargetList(sidebar, placement.parentId);
  const sameParentArray = sourceList === targetList;

  let finalIndex = Number.isFinite(placement.index)
    ? Math.floor(placement.index)
    : 0;
  if (sameParentArray && oldIndex < placement.index) {
    finalIndex = placement.index - 1;
  }
  finalIndex = Math.max(0, Math.min(finalIndex, targetList.length));
  targetList.splice(finalIndex, 0, node);

  persistSidebar(workspaceRoot, sidebar);
  return getWikiSnapshot(workspaceRoot);
}

type FlatLoc = {
  parent: WikiSidebarNode[] | null;
  index: number;
  node: WikiSidebarRefNode;
  parentPage: WikiSidebarRefNode | null;
  root: WikiSidebarNode[];
};

function findPageLocation(
  root: WikiSidebarNode[],
  id: EntityId,
): FlatLoc | null {
  const search = (
    list: WikiSidebarNode[],
    parentPage: WikiSidebarRefNode | null,
  ): FlatLoc | null => {
    for (let i = 0; i < list.length; i++) {
      const node = list[i]!;
      if (node.type === "ref") {
        if (node.id === id) {
          return { parent: list, index: i, node, parentPage, root };
        }
        if (node.children) {
          const hit = search(node.children, node);
          if (hit) {
            return hit;
          }
        }
      } else if (node.type === "group") {
        const hit = search(node.children, parentPage);
        if (hit) {
          return hit;
        }
      }
    }
    return null;
  };
  return search(root, null);
}

function cloneSidebar(nodes: WikiSidebarNode[]): WikiSidebarNode[] {
  return JSON.parse(JSON.stringify(nodes)) as WikiSidebarNode[];
}

export async function moveWikiNodeInSidebar(
  workspaceRoot: string,
  id: EntityId,
  move: WikiSidebarMove,
): Promise<WikiSnapshot> {
  assertValidWikiNodeId(id);
  const sidebar = cloneSidebar(await requireReadableSidebar(workspaceRoot));
  const loc = findPageLocation(sidebar, id);
  if (!loc || !loc.parent) {
    throw new Error(`Page not in sidebar: ${id}`);
  }
  const { parent, index, node } = loc;

  if (move === "up" && index > 0) {
    const prev = parent[index - 1]!;
    parent[index - 1] = node;
    parent[index] = prev;
  } else if (move === "down" && index < parent.length - 1) {
    const next = parent[index + 1]!;
    parent[index + 1] = node;
    parent[index] = next;
  } else if (move === "indent" && index > 0) {
    const prev = parent[index - 1]!;
    if (prev.type !== "ref") {
      return getWikiSnapshot(workspaceRoot);
    }
    parent.splice(index, 1);
    prev.children = [...(prev.children ?? []), node];
  } else if (move === "outdent" && loc.parentPage) {
    const outerLoc = findPageLocation(sidebar, loc.parentPage.id);
    if (!outerLoc?.parent) {
      return getWikiSnapshot(workspaceRoot);
    }
    parent.splice(index, 1);
    outerLoc.parent.splice(outerLoc.index + 1, 0, node);
  }

  persistSidebar(workspaceRoot, sidebar);
  return getWikiSnapshot(workspaceRoot);
}
