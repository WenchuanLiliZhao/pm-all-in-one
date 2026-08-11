import { z } from "zod";

import { ENTITY_ID_RE } from "./dir-id.js";
import { esbuild } from "./esbuild-runtime.js";

/** Optional on read so legacy files load; writers always emit both. */
const SystemTimestampsZod = {
  created: z.string().optional(),
  updated: z.string().optional(),
};

const OptionalMemberIdZod = z
  .string()
  .regex(ENTITY_ID_RE, "must be a nanoid(21) entity id")
  .nullable()
  .optional();

const ProjectPropsZod = z
  .object({
    title: z.string().min(1),
    createdBy: OptionalMemberIdZod,
    ...SystemTimestampsZod,
  })
  .passthrough()
  .refine((o) => !("id" in o), { message: "id must not appear in project.ts" });

const IssuePropsZod = z
  .object({
    title: z.string().min(1),
    /**
     * Optional on read so one hand-edited file cannot break the whole
     * workspace; the store raises a `level-missing` violation instead. Every
     * write emits it.
     */
    level: z.preprocess((v) => {
      // Legacy musical ranks → canonical Agile ranks; story → task read alias.
      if (v === "concerto") return "epic";
      if (v === "movement") return "task";
      if (v === "phrase") return "subtask";
      if (v === "story") return "task";
      return v;
    }, z.enum(["epic", "task", "subtask"]).optional()),
    /** Sole authority for the tree. null = top-level issue under the project. */
    parentId: z
      .string()
      .regex(ENTITY_ID_RE, "parentId must be a nanoid(21) entity id")
      .nullable()
      .optional(),
    /** Optional on read; missing/unknown → draft in the store. Writers emit. */
    status: z.string().optional(),
    /** Optional on read; missing/unknown → medium in the store. Writers emit. */
    priority: z.string().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
    estimatePoint: z.number().optional(),
    blockedBy: z.array(z.string()).optional(),
    assignee: OptionalMemberIdZod,
    createdBy: OptionalMemberIdZod,
    ...SystemTimestampsZod,
  })
  .passthrough()
  .refine((o) => !("id" in o), { message: "id must not appear in props.ts" });

const WikiNodePropsZod = z
  .object({
    title: z.string().min(1),
    /** Required on write; optional on read so legacy files load then seed "". */
    description: z.string().optional(),
    createdBy: OptionalMemberIdZod,
    ...SystemTimestampsZod,
  })
  .passthrough()
  .refine((o) => !("id" in o), { message: "id must not appear in wiki-node props.ts" });

const MemberPropsZod = z
  .object({
    title: z.string().min(1),
    membership: z.enum(["involved", "left"]).optional(),
    ...SystemTimestampsZod,
  })
  .passthrough()
  .refine((o) => !("id" in o), { message: "id must not appear in member props.ts" });

const RequiredMemberIdZod = z
  .string()
  .regex(ENTITY_ID_RE, "must be a nanoid(21) entity id");

const HandoffPropsZod = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    /** Optional on read for legacy seed; writers always emit. */
    relatedProject: RequiredMemberIdZod.optional(),
    open: z.boolean().optional(),
    from: RequiredMemberIdZod,
    to: RequiredMemberIdZod,
    ...SystemTimestampsZod,
  })
  .passthrough()
  .refine((o) => !("id" in o), { message: "id must not appear in handoff props.ts" });

export type WikiNodePropsFile = z.infer<typeof WikiNodePropsZod>;
export type MemberPropsFile = z.infer<typeof MemberPropsZod>;
export type HandoffPropsFile = z.infer<typeof HandoffPropsZod>;

export async function loadWikiNodeProps(source: string): Promise<WikiNodePropsFile> {
  const raw = await evaluatePropsExport(source);
  if (raw && typeof raw === "object" && "id" in (raw as object)) {
    throw new Error("id must not appear in wiki-node props.ts");
  }
  return WikiNodePropsZod.parse(raw);
}

export async function loadMemberProps(source: string): Promise<MemberPropsFile> {
  const raw = await evaluatePropsExport(source);
  if (raw && typeof raw === "object" && "id" in (raw as object)) {
    throw new Error("id must not appear in member props.ts");
  }
  return MemberPropsZod.parse(raw);
}

export async function loadHandoffProps(source: string): Promise<HandoffPropsFile> {
  const raw = await evaluatePropsExport(source);
  if (raw && typeof raw === "object" && "id" in (raw as object)) {
    throw new Error("id must not appear in handoff props.ts");
  }
  return HandoffPropsZod.parse(raw);
}

const IsoDateZod = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "createdDate must be YYYY-MM-DD");

const WorkspacePropsZod = z
  .object({
    title: z.string().min(1),
    createdDate: IsoDateZod,
  })
  .passthrough()
  .refine((o) => !("id" in o), {
    message: "id must not appear in workspace.ts",
  });

export type ProjectPropsFile = z.infer<typeof ProjectPropsZod>;
export type IssuePropsFile = z.infer<typeof IssuePropsZod>;
export type WorkspacePropsFile = z.infer<typeof WorkspacePropsZod>;

async function evaluatePropsExport(source: string): Promise<unknown> {
  const result = await esbuild.transform(source, {
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

export { evaluatePropsExport };

export function evaluatePropsExportSync(source: string): unknown {
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

export async function loadProjectProps(source: string): Promise<ProjectPropsFile> {
  const raw = await evaluatePropsExport(source);
  if (raw && typeof raw === "object" && "id" in (raw as object)) {
    throw new Error("id must not appear in project.ts");
  }
  return ProjectPropsZod.parse(raw);
}

export async function loadIssueProps(source: string): Promise<IssuePropsFile> {
  const raw = await evaluatePropsExport(source);
  if (raw && typeof raw === "object" && "id" in (raw as object)) {
    throw new Error("id must not appear in props.ts");
  }
  return IssuePropsZod.parse(raw);
}

export async function loadWorkspaceProps(
  source: string,
): Promise<WorkspacePropsFile> {
  const raw = await evaluatePropsExport(source);
  if (raw && typeof raw === "object" && "id" in (raw as object)) {
    throw new Error("id must not appear in workspace.ts");
  }
  return WorkspacePropsZod.parse(raw);
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
      ([k]) => k !== "id",
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

export interface WritePropsOptions {
  /**
   * Type from the project's generated `schema.d.ts` to check the object
   * against. `import type` is erased by the esbuild transform above, so the
   * loader (which has no `require`) never sees an import.
   */
  satisfies?: string;
}

export function writePropsTs(
  props: Record<string, unknown>,
  options: WritePropsOptions = {},
): string {
  const { id: _drop, ...rest } = props;
  const body = `export const props = ${serializeValue(rest, 0)} as const`;
  if (!options.satisfies) {
    return `${body};\n`;
  }
  return `import type { ${options.satisfies} } from "../schema";\n\n${body} satisfies ${options.satisfies};\n`;
}
