/**
 * Workspace-level wiki custom fields: `wiki/custom-props.ts` + generated `wiki/schema.d.ts`.
 *
 * ↔ electron/core/domain/wiki.ts — WikiNode fields I/O
 * ↔ electron/core/infra/schema-dts.ts — writeWikiSchemaDts
 * ↔ electron/core/domain/custom-props.ts — issue sibling (per-project ladder)
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import { isValidEntityId, keyToKebab } from "../identity/dir-id.js";
import type {
  CustomPropDef,
  WikiCustomPropsSchema,
  WikiIncomingRef,
} from "../identity/types.js";
import {
  evaluatePropsExport,
  loadWikiNodeProps,
  writePropsTs,
} from "../infra/props-load.js";
import { writeWikiSchemaDts } from "../infra/schema-dts.js";

const PropDefZod = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum([
      "string",
      "number",
      "boolean",
      "date",
      "markdown",
      "wiki-node",
      "string-list",
    ]),
    help: z.string().optional(),
  })
  .transform((def) => {
    const help = def.help?.trim();
    if (!help) {
      const { help: _drop, ...rest } = def;
      return rest;
    }
    return { ...def, help };
  });

const SchemaZod = z.object({
  fields: z.array(PropDefZod).default([]),
});

export const WIKI_SYSTEM_PROP_KEYS = new Set([
  "id",
  "title",
  "description",
  "created",
  "updated",
  "createdBy",
  "body",
]);

export function emptyWikiCustomProps(): WikiCustomPropsSchema {
  return { fields: [] };
}

export function wikiCustomPropsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "wiki", "custom-props.ts");
}

export async function loadWikiCustomProps(
  workspaceRoot: string,
): Promise<WikiCustomPropsSchema> {
  const file = wikiCustomPropsPath(workspaceRoot);
  if (!fs.existsSync(file)) {
    return emptyWikiCustomProps();
  }
  const raw = await evaluatePropsExport(fs.readFileSync(file, "utf8"));
  if (raw && typeof raw === "object" && "id" in (raw as object)) {
    throw new Error("id must not appear in wiki/custom-props.ts");
  }
  return SchemaZod.parse(raw);
}

function assertWikiCustomKey(key: string): void {
  if (WIKI_SYSTEM_PROP_KEYS.has(key)) {
    throw new Error(`wiki custom props must not use reserved key ${key}`);
  }
  if (keyToKebab(key).toLowerCase() === "readme") {
    throw new Error(
      `wiki markdown custom prop key ${key} collides with README.md`,
    );
  }
}

export function writeWikiCustomProps(
  workspaceRoot: string,
  schema: WikiCustomPropsSchema,
): void {
  const seen = new Set<string>();
  for (const def of schema.fields) {
    assertWikiCustomKey(def.key);
    if (seen.has(def.key)) {
      throw new Error(`duplicate wiki custom prop key ${def.key}`);
    }
    seen.add(def.key);
  }
  const validated = SchemaZod.parse(schema);
  const wikiRoot = path.join(workspaceRoot, "wiki");
  fs.mkdirSync(wikiRoot, { recursive: true });
  fs.writeFileSync(
    wikiCustomPropsPath(workspaceRoot),
    writePropsTs(validated as unknown as Record<string, unknown>),
    "utf8",
  );
  writeWikiSchemaDts(workspaceRoot, validated);
}

function readText(file: string): string {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function valueIsPresent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  if (Array.isArray(value)) {
    return value.some((item) => valueIsPresent(item));
  }
  return true;
}

function uniqueTrimmedStrings(
  value: unknown,
  onNonString: "drop" | "throw",
  throwMessage: string,
): string[] {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (item === null || item === undefined) {
      continue;
    }
    if (typeof item !== "string") {
      if (onNonString === "throw") {
        throw new Error(throwMessage);
      }
      continue;
    }
    const token = item.trim();
    if (token === "" || seen.has(token)) {
      continue;
    }
    seen.add(token);
    out.push(token);
  }
  return out;
}

/**
 * Unique valid wiki-node ids. Invalid format is dropped (read path).
 */
export function normalizeWikiNodeIdList(value: unknown): string[] {
  return uniqueTrimmedStrings(value, "drop", "").filter(isValidEntityId);
}

/**
 * Unique valid wiki-node ids. Throws on non-string / invalid format (write path).
 */
export function parseWikiNodeIdList(value: unknown): string[] {
  const ids = uniqueTrimmedStrings(
    value,
    "throw",
    "wiki-node field values must be wiki-node ids",
  );
  for (const id of ids) {
    if (!isValidEntityId(id)) {
      throw new Error(`wiki-node field value is not a valid id: ${id}`);
    }
  }
  return ids;
}

/**
 * Unique free-text tokens. Non-strings are dropped (read path).
 */
export function normalizeStringList(value: unknown): string[] {
  return uniqueTrimmedStrings(value, "drop", "");
}

/**
 * Unique free-text tokens. Throws on non-string items (write path).
 */
export function parseStringList(value: unknown): string[] {
  return uniqueTrimmedStrings(
    value,
    "throw",
    "string-list field values must be strings",
  );
}

function defKeysOfType(
  schema: { fields?: CustomPropDef[] } | CustomPropDef[],
  type: CustomPropDef["type"],
): string[] {
  const fields = Array.isArray(schema) ? schema : (schema.fields ?? []);
  return fields.filter((d) => d.type === type).map((d) => d.key);
}

export function wikiNodeDefKeys(schema: {
  fields?: CustomPropDef[];
} | CustomPropDef[]): string[] {
  return defKeysOfType(schema, "wiki-node");
}

export function stringListDefKeys(schema: {
  fields?: CustomPropDef[];
} | CustomPropDef[]): string[] {
  return defKeysOfType(schema, "string-list");
}

function applyParsedListKeys(
  props: Record<string, unknown>,
  rest: Record<string, unknown>,
  keys: ReadonlySet<string>,
  parse: (value: unknown) => string[],
): void {
  for (const key of keys) {
    if (!(key in rest)) {
      continue;
    }
    const items = parse(rest[key]);
    delete rest[key];
    if (items.length === 0) {
      delete props[key];
    } else {
      props[key] = items;
    }
  }
}

/** Apply wiki-node / string-list keys from a fields patch (omit empty). */
export function applyWikiNodeFieldPatch(
  props: Record<string, unknown>,
  patchFields: Record<string, unknown>,
  wikiNodeKeys: ReadonlySet<string>,
  stringListKeys: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...patchFields };
  applyParsedListKeys(props, rest, wikiNodeKeys, parseWikiNodeIdList);
  applyParsedListKeys(props, rest, stringListKeys, parseStringList);
  Object.assign(props, rest);
  return props;
}

/** Drop empty list fields; keep unique tokens. Used when copying materialized [] back to disk. */
export function omitEmptyListFields(
  props: Record<string, unknown>,
  wikiNodeKeys: ReadonlySet<string>,
  stringListKeys: ReadonlySet<string>,
): void {
  for (const key of wikiNodeKeys) {
    if (!(key in props)) {
      continue;
    }
    const ids = normalizeWikiNodeIdList(props[key]);
    if (ids.length === 0) {
      delete props[key];
    } else {
      props[key] = ids;
    }
  }
  for (const key of stringListKeys) {
    if (!(key in props)) {
      continue;
    }
    const tokens = normalizeStringList(props[key]);
    if (tokens.length === 0) {
      delete props[key];
    } else {
      props[key] = tokens;
    }
  }
}

export function splitWikiNodeCustomFields(
  nodeDir: string,
  props: Record<string, unknown>,
  schema: WikiCustomPropsSchema,
): { fields: Record<string, unknown>; markdownFields: Record<string, string> } {
  const fields: Record<string, unknown> = {};
  const markdownFields: Record<string, string> = {};
  for (const def of schema.fields) {
    if (def.type === "markdown") {
      markdownFields[def.key] = readText(
        path.join(nodeDir, `${keyToKebab(def.key)}.md`),
      );
    } else if (def.type === "wiki-node") {
      fields[def.key] = normalizeWikiNodeIdList(props[def.key]);
    } else if (def.type === "string-list") {
      fields[def.key] = normalizeStringList(props[def.key]);
    } else if (def.key in props) {
      fields[def.key] = props[def.key];
    }
  }
  const system = new Set([
    ...WIKI_SYSTEM_PROP_KEYS,
    ...schema.fields.filter((d) => d.type === "markdown").map((d) => d.key),
  ]);
  for (const [k, v] of Object.entries(props)) {
    if (!system.has(k) && !(k in fields)) {
      fields[k] = v;
    }
  }
  return { fields, markdownFields };
}

/** Count wiki-nodes that still store a non-empty value for `key`. */
export async function countWikiFieldUsage(
  workspaceRoot: string,
  key: string,
): Promise<number> {
  const wikiRoot = path.join(workspaceRoot, "wiki");
  if (!fs.existsSync(wikiRoot)) {
    return 0;
  }
  let n = 0;
  const sidecar = `${keyToKebab(key)}.md`;
  for (const name of fs.readdirSync(wikiRoot)) {
    if (!isValidEntityId(name)) {
      continue;
    }
    const dir = path.join(wikiRoot, name);
    if (!fs.statSync(dir).isDirectory()) {
      continue;
    }
    const sidecarPath = path.join(dir, sidecar);
    if (fs.existsSync(sidecarPath) && valueIsPresent(readText(sidecarPath))) {
      n += 1;
      continue;
    }
    const propsFile = path.join(dir, "props.ts");
    if (!fs.existsSync(propsFile)) {
      continue;
    }
    try {
      const props = (await loadWikiNodeProps(
        fs.readFileSync(propsFile, "utf8"),
      )) as Record<string, unknown>;
      if (key in props && valueIsPresent(props[key])) {
        n += 1;
      }
    } catch {
      // Unreadable node — skip; doctor reports shape elsewhere.
    }
  }
  return n;
}

export function wikiMarkdownDefKeys(schema: WikiCustomPropsSchema): string[] {
  return schema.fields.filter((d) => d.type === "markdown").map((d) => d.key);
}

export function wikiCustomDefs(schema: WikiCustomPropsSchema): CustomPropDef[] {
  return schema.fields;
}

export type WikiNodeRefEdge = {
  fromId: string;
  fieldKey: string;
  targetId: string;
};

async function* iterateWikiNodeProps(
  workspaceRoot: string,
): AsyncGenerator<{ id: string; dir: string; props: Record<string, unknown> }> {
  const wikiRoot = path.join(workspaceRoot, "wiki");
  if (!fs.existsSync(wikiRoot)) {
    return;
  }
  for (const name of fs.readdirSync(wikiRoot)) {
    if (!isValidEntityId(name)) {
      continue;
    }
    const dir = path.join(wikiRoot, name);
    if (!fs.statSync(dir).isDirectory()) {
      continue;
    }
    const propsFile = path.join(dir, "props.ts");
    if (!fs.existsSync(propsFile)) {
      continue;
    }
    try {
      const props = (await loadWikiNodeProps(
        fs.readFileSync(propsFile, "utf8"),
      )) as Record<string, unknown>;
      yield { id: name, dir, props };
    } catch {
      // Unreadable node — skip; doctor reports shape elsewhere.
    }
  }
}

/** Every wiki-node custom-field id stored on disk (valid id format only). */
export async function listWikiNodeRefEdges(
  workspaceRoot: string,
): Promise<WikiNodeRefEdge[]> {
  const schema = await loadWikiCustomProps(workspaceRoot);
  const keys = wikiNodeDefKeys(schema);
  if (keys.length === 0) {
    return [];
  }
  const edges: WikiNodeRefEdge[] = [];
  for await (const node of iterateWikiNodeProps(workspaceRoot)) {
    for (const fieldKey of keys) {
      if (!(fieldKey in node.props)) {
        continue;
      }
      for (const targetId of normalizeWikiNodeIdList(node.props[fieldKey])) {
        edges.push({ fromId: node.id, fieldKey, targetId });
      }
    }
  }
  return edges;
}

export async function listWikiIncomingRefs(
  workspaceRoot: string,
  targetId: string,
): Promise<WikiIncomingRef[]> {
  const edges = await listWikiNodeRefEdges(workspaceRoot);
  return edges
    .filter((e) => e.targetId === targetId)
    .map(({ fromId, fieldKey }) => ({ fromId, fieldKey }));
}
