/**
 * Three-way sync helpers for detail draft vs baseline vs disk.
 * Field sets match persist write sets exactly (not system/structural fields).
 *
 * ↔ src/lib/bridge/pm-api.ts — editable slices appear on update* signatures
 * ↔ electron/main.ts — encodeStaleWriteMessage on IPC OCC failures
 * ↔ server/main.ts sendError — 409 stale-write JSON for HTTP OCC failures
 * ↔ src/lib/bridge/http-pm.ts — reconstruct StaleWriteError from 409 body
 * ↔ electron/core/wiki.ts — wiki OCC via WikiEditableSlice
 * ↔ electron/core/members.ts — member OCC via MemberEditableSlice
 * ↔ electron/core/handoffs.ts — handoff OCC via HandoffEditableSlice
 * Shared via @pm-core/detail-diff (not a third bridge).
 */

import type {
  Issue,
  IssuePriorityId,
  IssueStatusId,
  Project,
  WorkspaceMeta,
} from "./types.js";

export type FieldVerdict =
  | "unchanged"
  | "local-only"
  | "disk-only"
  | "converged"
  | "conflict";

export const ISSUE_EDITABLE_KEYS = [
  "title",
  "status",
  "priority",
  "startDate",
  "endDate",
  "blockedBy",
  "description",
  "assignee",
  "fields",
  "markdownFields",
] as const;

export type IssueEditableKey = (typeof ISSUE_EDITABLE_KEYS)[number];

export type IssueEditableSlice = {
  title: string;
  status: IssueStatusId;
  priority: IssuePriorityId;
  startDate: string | null;
  endDate: string | null;
  blockedBy: string[];
  description: string;
  assignee: string | null;
  fields: Record<string, unknown>;
  markdownFields: Record<string, string>;
};

export type ProjectEditableSlice = {
  title: string;
  description: string;
};

export type WorkspaceEditableSlice = {
  title: string;
  description: string;
};

export type WikiEditableSlice = {
  title: string;
  description: string;
  body: string;
};

export type MemberEditableSlice = {
  title: string;
  body: string;
  membership: string;
};

export type HandoffEditableSlice = {
  title: string;
  description: string;
  relatedProject: string;
  open: boolean;
  body: string;
  from: string;
  to: string;
};

/** Stable JSON for sync equality (sorted object keys; arrays preserve order). */
export function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = canonicalize(obj[key]);
  }
  return out;
}

export function equalsForSync(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

/**
 * Missing markdown / custom keys compare as empty string / absent.
 * Empty string and missing key are equal for sync (matches store empty-skip read).
 */
export function normalizeStringMap(
  map: Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!map) {
    return out;
  }
  for (const [k, v] of Object.entries(map)) {
    if (v === "") {
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function normalizeFieldsMap(
  map: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!map) {
    return {};
  }
  return canonicalize(map) as Record<string, unknown>;
}

export function pickIssueEditable(issue: Issue): IssueEditableSlice {
  return {
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    startDate: issue.startDate,
    endDate: issue.endDate,
    blockedBy: [...issue.blockedBy],
    description: issue.description,
    assignee: issue.assignee,
    fields: { ...issue.fields },
    markdownFields: { ...issue.markdownFields },
  };
}

export function pickProjectEditable(project: Project): ProjectEditableSlice {
  return {
    title: project.title,
    description: project.description,
  };
}

export function pickWorkspaceEditable(meta: WorkspaceMeta): WorkspaceEditableSlice {
  return {
    title: meta.title,
    description: meta.description,
  };
}

export function pickWikiEditable(node: {
  title: string;
  description: string;
  body: string;
}): WikiEditableSlice {
  return {
    title: node.title,
    description: node.description,
    body: node.body,
  };
}

export function pickMemberEditable(member: {
  title: string;
  body: string;
  membership: string;
}): MemberEditableSlice {
  return {
    title: member.title,
    body: member.body,
    membership: member.membership,
  };
}

export function pickHandoffEditable(handoff: {
  title: string;
  description: string;
  relatedProject: string;
  open: boolean;
  body: string;
  from: string;
  to: string;
}): HandoffEditableSlice {
  return {
    title: handoff.title,
    description: handoff.description,
    relatedProject: handoff.relatedProject,
    open: handoff.open,
    body: handoff.body,
    from: handoff.from,
    to: handoff.to,
  };
}

function classifyScalar(
  baseline: unknown,
  draft: unknown,
  disk: unknown,
): FieldVerdict {
  const draftEqBase = equalsForSync(draft, baseline);
  const diskEqBase = equalsForSync(disk, baseline);
  if (draftEqBase && diskEqBase) {
    return "unchanged";
  }
  if (draftEqBase && !diskEqBase) {
    return "disk-only";
  }
  if (!draftEqBase && diskEqBase) {
    return "local-only";
  }
  if (equalsForSync(draft, disk)) {
    return "converged";
  }
  return "conflict";
}

function allKeys(...maps: Array<Record<string, unknown>>): string[] {
  const keys = new Set<string>();
  for (const m of maps) {
    for (const k of Object.keys(m)) {
      keys.add(k);
    }
  }
  return [...keys].sort();
}

function classifyStringMap(
  baseline: Record<string, string>,
  draft: Record<string, string>,
  disk: Record<string, string>,
): Record<string, FieldVerdict> {
  const b = normalizeStringMap(baseline);
  const d = normalizeStringMap(draft);
  const k = normalizeStringMap(disk);
  const out: Record<string, FieldVerdict> = {};
  for (const key of allKeys(b, d, k)) {
    out[key] = classifyScalar(b[key] ?? "", d[key] ?? "", k[key] ?? "");
  }
  return out;
}

function classifyFieldsMap(
  baseline: Record<string, unknown>,
  draft: Record<string, unknown>,
  disk: Record<string, unknown>,
): Record<string, FieldVerdict> {
  const b = normalizeFieldsMap(baseline);
  const d = normalizeFieldsMap(draft);
  const k = normalizeFieldsMap(disk);
  const out: Record<string, FieldVerdict> = {};
  for (const key of allKeys(b, d, k)) {
    out[key] = classifyScalar(b[key], d[key], k[key]);
  }
  return out;
}

export type IssueClassifyResult = {
  scalars: {
    title: FieldVerdict;
    status: FieldVerdict;
    priority: FieldVerdict;
    startDate: FieldVerdict;
    endDate: FieldVerdict;
    blockedBy: FieldVerdict;
    description: FieldVerdict;
    assignee: FieldVerdict;
  };
  fields: Record<string, FieldVerdict>;
  markdownFields: Record<string, FieldVerdict>;
  conflictPaths: string[];
  hasLocalEdits: boolean;
  hasConflict: boolean;
  /** Draft with disk-only / converged fields taken from disk; conflicts keep draft. */
  mergedDraft: IssueEditableSlice;
  /** Baseline after absorbing disk for non-conflict takes. */
  nextBaseline: IssueEditableSlice;
};

function applyMapMerge(
  baseline: Record<string, string>,
  draft: Record<string, string>,
  disk: Record<string, string>,
  verdicts: Record<string, FieldVerdict>,
): { merged: Record<string, string>; nextBase: Record<string, string> } {
  const keys = allKeys(baseline, draft, disk);
  const merged: Record<string, string> = {};
  const nextBase: Record<string, string> = {};
  for (const key of keys) {
    const v = verdicts[key] ?? "unchanged";
    const b = baseline[key] ?? "";
    const d = draft[key] ?? "";
    const k = disk[key] ?? "";
    if (v === "disk-only" || v === "converged" || v === "unchanged") {
      merged[key] = k;
      nextBase[key] = k;
    } else if (v === "local-only") {
      merged[key] = d;
      nextBase[key] = b;
    } else {
      // conflict: keep draft; baseline stays until Reload / Keep editing
      merged[key] = d;
      nextBase[key] = b;
    }
  }
  return {
    merged: normalizeStringMap(merged),
    nextBase: normalizeStringMap(nextBase),
  };
}

function applyFieldsMerge(
  baseline: Record<string, unknown>,
  draft: Record<string, unknown>,
  disk: Record<string, unknown>,
  verdicts: Record<string, FieldVerdict>,
): {
  merged: Record<string, unknown>;
  nextBase: Record<string, unknown>;
} {
  const keys = allKeys(baseline, draft, disk);
  const merged: Record<string, unknown> = {};
  const nextBase: Record<string, unknown> = {};
  for (const key of keys) {
    const v = verdicts[key] ?? "unchanged";
    if (v === "disk-only" || v === "converged" || v === "unchanged") {
      if (key in disk) {
        merged[key] = disk[key];
        nextBase[key] = disk[key];
      }
    } else if (v === "local-only") {
      if (key in draft) {
        merged[key] = draft[key];
      }
      if (key in baseline) {
        nextBase[key] = baseline[key];
      }
    } else {
      if (key in draft) {
        merged[key] = draft[key];
      }
      if (key in baseline) {
        nextBase[key] = baseline[key];
      }
    }
  }
  return { merged, nextBase };
}

export function classifyIssue(
  baseline: IssueEditableSlice,
  draft: IssueEditableSlice,
  disk: IssueEditableSlice,
): IssueClassifyResult {
  const scalars = {
    title: classifyScalar(baseline.title, draft.title, disk.title),
    status: classifyScalar(baseline.status, draft.status, disk.status),
    priority: classifyScalar(baseline.priority, draft.priority, disk.priority),
    startDate: classifyScalar(baseline.startDate, draft.startDate, disk.startDate),
    endDate: classifyScalar(baseline.endDate, draft.endDate, disk.endDate),
    blockedBy: classifyScalar(
      baseline.blockedBy,
      draft.blockedBy,
      disk.blockedBy,
    ),
    description: classifyScalar(
      baseline.description,
      draft.description,
      disk.description,
    ),
    assignee: classifyScalar(baseline.assignee, draft.assignee, disk.assignee),
  };
  const fields = classifyFieldsMap(baseline.fields, draft.fields, disk.fields);
  const markdownFields = classifyStringMap(
    baseline.markdownFields,
    draft.markdownFields,
    disk.markdownFields,
  );

  const conflictPaths: string[] = [];
  let hasLocalEdits = false;
  for (const [key, v] of Object.entries(scalars) as Array<
    [keyof typeof scalars, FieldVerdict]
  >) {
    if (v === "conflict") {
      conflictPaths.push(key);
    }
    if (v === "local-only" || v === "conflict") {
      hasLocalEdits = true;
    }
  }
  for (const [key, v] of Object.entries(fields)) {
    if (v === "conflict") {
      conflictPaths.push(`fields.${key}`);
    }
    if (v === "local-only" || v === "conflict") {
      hasLocalEdits = true;
    }
  }
  for (const [key, v] of Object.entries(markdownFields)) {
    if (v === "conflict") {
      conflictPaths.push(`markdownFields.${key}`);
    }
    if (v === "local-only" || v === "conflict") {
      hasLocalEdits = true;
    }
  }

  const pickScalar = <T,>(
    key: keyof typeof scalars,
    b: T,
    d: T,
    k: T,
  ): { merged: T; nextBase: T } => {
    const v = scalars[key];
    if (v === "disk-only" || v === "converged" || v === "unchanged") {
      return { merged: k, nextBase: k };
    }
    if (v === "local-only") {
      return { merged: d, nextBase: b };
    }
    return { merged: d, nextBase: b };
  };

  const title = pickScalar("title", baseline.title, draft.title, disk.title);
  const status = pickScalar(
    "status",
    baseline.status,
    draft.status,
    disk.status,
  );
  const priority = pickScalar(
    "priority",
    baseline.priority,
    draft.priority,
    disk.priority,
  );
  const startDate = pickScalar(
    "startDate",
    baseline.startDate,
    draft.startDate,
    disk.startDate,
  );
  const endDate = pickScalar(
    "endDate",
    baseline.endDate,
    draft.endDate,
    disk.endDate,
  );
  const blockedBy = pickScalar(
    "blockedBy",
    baseline.blockedBy,
    draft.blockedBy,
    disk.blockedBy,
  );
  const description = pickScalar(
    "description",
    baseline.description,
    draft.description,
    disk.description,
  );
  const assignee = pickScalar(
    "assignee",
    baseline.assignee,
    draft.assignee,
    disk.assignee,
  );
  const fieldsMerge = applyFieldsMerge(
    baseline.fields,
    draft.fields,
    disk.fields,
    fields,
  );
  const mdMerge = applyMapMerge(
    baseline.markdownFields,
    draft.markdownFields,
    disk.markdownFields,
    markdownFields,
  );

  return {
    scalars,
    fields,
    markdownFields,
    conflictPaths,
    hasLocalEdits,
    hasConflict: conflictPaths.length > 0,
    mergedDraft: {
      title: title.merged,
      status: status.merged,
      priority: priority.merged,
      startDate: startDate.merged,
      endDate: endDate.merged,
      blockedBy: blockedBy.merged,
      description: description.merged,
      assignee: assignee.merged,
      fields: fieldsMerge.merged,
      markdownFields: mdMerge.merged,
    },
    nextBaseline: {
      title: title.nextBase,
      status: status.nextBase,
      priority: priority.nextBase,
      startDate: startDate.nextBase,
      endDate: endDate.nextBase,
      blockedBy: blockedBy.nextBase,
      description: description.nextBase,
      assignee: assignee.nextBase,
      fields: fieldsMerge.nextBase,
      markdownFields: mdMerge.nextBase,
    },
  };
}

export type SimpleClassifyResult<T extends Record<string, string | boolean>> = {
  scalars: { [K in keyof T]: FieldVerdict };
  conflictPaths: string[];
  hasLocalEdits: boolean;
  hasConflict: boolean;
  mergedDraft: T;
  nextBaseline: T;
};

function classifySimple<T extends Record<string, string | boolean>>(
  baseline: T,
  draft: T,
  disk: T,
  keys: Array<keyof T & string>,
): SimpleClassifyResult<T> {
  const scalars = {} as { [K in keyof T]: FieldVerdict };
  const conflictPaths: string[] = [];
  let hasLocalEdits = false;
  const merged = { ...draft };
  const nextBase = { ...baseline };
  for (const key of keys) {
    const v = classifyScalar(baseline[key], draft[key], disk[key]);
    scalars[key] = v;
    if (v === "conflict") {
      conflictPaths.push(key);
    }
    if (v === "local-only" || v === "conflict") {
      hasLocalEdits = true;
    }
    if (v === "disk-only" || v === "converged" || v === "unchanged") {
      merged[key] = disk[key];
      nextBase[key] = disk[key];
    }
  }
  return {
    scalars,
    conflictPaths,
    hasLocalEdits,
    hasConflict: conflictPaths.length > 0,
    mergedDraft: merged,
    nextBaseline: nextBase,
  };
}

export function classifyProject(
  baseline: ProjectEditableSlice,
  draft: ProjectEditableSlice,
  disk: ProjectEditableSlice,
): SimpleClassifyResult<ProjectEditableSlice> {
  return classifySimple(baseline, draft, disk, ["title", "description"]);
}

export function classifyWorkspace(
  baseline: WorkspaceEditableSlice,
  draft: WorkspaceEditableSlice,
  disk: WorkspaceEditableSlice,
): SimpleClassifyResult<WorkspaceEditableSlice> {
  return classifySimple(baseline, draft, disk, ["title", "description"]);
}

export function classifyWiki(
  baseline: WikiEditableSlice,
  draft: WikiEditableSlice,
  disk: WikiEditableSlice,
): SimpleClassifyResult<WikiEditableSlice> {
  return classifySimple(baseline, draft, disk, ["title", "description", "body"]);
}

export function classifyMember(
  baseline: MemberEditableSlice,
  draft: MemberEditableSlice,
  disk: MemberEditableSlice,
): SimpleClassifyResult<MemberEditableSlice> {
  return classifySimple(baseline, draft, disk, [
    "title",
    "body",
    "membership",
  ]);
}

export function classifyHandoff(
  baseline: HandoffEditableSlice,
  draft: HandoffEditableSlice,
  disk: HandoffEditableSlice,
): SimpleClassifyResult<HandoffEditableSlice> {
  return classifySimple(baseline, draft, disk, [
    "title",
    "description",
    "relatedProject",
    "open",
    "body",
    "from",
    "to",
  ]);
}

export function issueSlicesEqual(
  a: IssueEditableSlice,
  b: IssueEditableSlice,
): boolean {
  return (
    equalsForSync(a.title, b.title) &&
    equalsForSync(a.status, b.status) &&
    equalsForSync(a.priority, b.priority) &&
    equalsForSync(a.startDate, b.startDate) &&
    equalsForSync(a.endDate, b.endDate) &&
    equalsForSync(a.blockedBy, b.blockedBy) &&
    equalsForSync(a.description, b.description) &&
    equalsForSync(a.assignee, b.assignee) &&
    equalsForSync(normalizeFieldsMap(a.fields), normalizeFieldsMap(b.fields)) &&
    equalsForSync(
      normalizeStringMap(a.markdownFields),
      normalizeStringMap(b.markdownFields),
    )
  );
}

export function applyIssueEditable(
  issue: Issue,
  slice: IssueEditableSlice,
): Issue {
  return {
    ...issue,
    title: slice.title,
    status: slice.status,
    priority: slice.priority,
    startDate: slice.startDate,
    endDate: slice.endDate,
    blockedBy: [...slice.blockedBy],
    description: slice.description,
    assignee: slice.assignee,
    fields: { ...slice.fields },
    markdownFields: { ...slice.markdownFields },
  };
}

export class StaleWriteError extends Error {
  readonly code = "stale-write" as const;
  readonly conflictPaths: string[];

  constructor(message: string, conflictPaths: string[] = []) {
    super(message);
    this.name = "StaleWriteError";
    this.conflictPaths = conflictPaths;
  }
}

/** Encode for IPC / HTTP where custom Error fields may be stripped. */
export function encodeStaleWriteMessage(err: StaleWriteError): string {
  return `stale-write:${JSON.stringify(err.conflictPaths)}:${err.message}`;
}

export function parseStaleWrite(e: unknown): StaleWriteError | null {
  if (e instanceof StaleWriteError) {
    return e;
  }
  if (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: string }).code === "stale-write"
  ) {
    return new StaleWriteError(
      e instanceof Error
        ? e.message
        : String((e as { message?: string }).message ?? e),
      Array.isArray((e as { conflictPaths?: unknown }).conflictPaths)
        ? ((e as { conflictPaths: string[] }).conflictPaths)
        : [],
    );
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("stale-write:")) {
    const rest = msg.slice("stale-write:".length);
    if (rest.startsWith("[")) {
      const end = rest.indexOf("]:");
      if (end >= 0) {
        try {
          const paths = JSON.parse(rest.slice(0, end + 1)) as string[];
          return new StaleWriteError(rest.slice(end + 2), paths);
        } catch {
          return new StaleWriteError(msg, []);
        }
      }
    }
    return new StaleWriteError(msg, []);
  }
  if (
    msg.includes("changed on disk") &&
    msg.includes("Reload or keep editing")
  ) {
    return new StaleWriteError(msg, []);
  }
  return null;
}

export function isStaleWriteError(e: unknown): e is StaleWriteError {
  return parseStaleWrite(e) !== null;
}

/** Throw a form that survives Electron IPC invoke. */
export function throwStaleWriteForIpc(err: StaleWriteError): never {
  throw new Error(encodeStaleWriteMessage(err));
}
