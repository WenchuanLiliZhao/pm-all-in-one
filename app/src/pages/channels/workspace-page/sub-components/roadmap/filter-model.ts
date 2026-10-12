/**
 * Roadmap condition list: property, comparison, value, joined by and / or.
 * Incomplete clauses do not participate. A custom field the issue does not
 * declare fails that clause.
 *
 * ↔ filter-panel.tsx — the sentence and the rows
 * ↔ index.tsx — kept issue rows; project rows stay, via visibleRowKeys
 */

export type FilterLevel = "epic" | "task" | "subtask";

export type FilterFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "markdown"
  | "wiki-node"
  | "string-list";

export type BuiltinPropId =
  | "startDate"
  | "endDate"
  | "created"
  | "updated"
  | "createdBy"
  | "assignee"
  | "status"
  | "priority";

export type FilterOp =
  | "before"
  | "after"
  | "is"
  | "isNot"
  | "eq"
  | "contains"
  | "empty"
  | "gt"
  | "lt";

export type FilterJoin = "and" | "or";

export type FilterProp =
  | { source: "builtin"; id: BuiltinPropId }
  | {
      source: "custom";
      projectId: string;
      level: FilterLevel;
      key: string;
      fieldType: FilterFieldType;
      label: string;
    };

export type FilterClause = {
  kind: "clause";
  id: string;
  prop: FilterProp | null;
  op: FilterOp | null;
  value: string;
};

export type FilterGroup = {
  kind: "group";
  id: string;
  join: FilterJoin;
  children: FilterNode[];
};

export type FilterNode = FilterClause | FilterGroup;

export type FilterSubject = {
  projectId: string;
  level: FilterLevel;
  status: string;
  priority: string;
  startDate: string | null;
  endDate: string | null;
  created: string;
  updated: string;
  assignee: string | null;
  createdBy: string | null;
  fields: Record<string, unknown>;
  markdownFields: Record<string, string>;
};

export type FilterSchema = Record<FilterLevel, { key: string }[]>;

export type FilterTree = {
  children: Record<string, string[]>;
  roots: string[];
};

export type FilterNames = {
  member: (id: string) => string;
  wiki: (id: string) => string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  todo: "Todo",
  "in-progress": "In progress",
  done: "Done",
  cancel: "Cancel",
};

const PRIORITY_LABEL: Record<string, string> = {
  "very-low": "Very low",
  low: "Low",
  medium: "Medium",
  high: "High",
  "very-high": "Very high",
};

const BUILTIN_LABEL: Record<BuiltinPropId, string> = {
  startDate: "Start date",
  endDate: "End date",
  created: "Created",
  updated: "Updated",
  createdBy: "Created by",
  assignee: "Assignee",
  status: "Status",
  priority: "Priority",
};

export function emptyFilter(): FilterGroup {
  return { kind: "group", id: "root", join: "and", children: [] };
}

export function blankClause(id: string): FilterClause {
  return { kind: "clause", id, prop: null, op: null, value: "" };
}

export function blankGroup(
  id: string,
  join: FilterJoin,
  clauseId: string,
): FilterGroup {
  return {
    kind: "group",
    id,
    join,
    children: [blankClause(clauseId)],
  };
}

export function builtinProps(): { id: BuiltinPropId; label: string }[] {
  return (Object.keys(BUILTIN_LABEL) as BuiltinPropId[]).map((id) => ({
    id,
    label: BUILTIN_LABEL[id],
  }));
}

export function propLabel(prop: FilterProp): string {
  if (prop.source === "builtin") {
    return BUILTIN_LABEL[prop.id];
  }
  return prop.label;
}

function fieldTypeOf(prop: FilterProp): FilterFieldType | "member" | "status" | "priority" {
  if (prop.source === "custom") {
    return prop.fieldType;
  }
  if (prop.id === "createdBy" || prop.id === "assignee") {
    return "member";
  }
  if (prop.id === "status") {
    return "status";
  }
  if (prop.id === "priority") {
    return "priority";
  }
  return "date";
}

export function opsFor(prop: FilterProp): FilterOp[] {
  const kind = fieldTypeOf(prop);
  switch (kind) {
    case "date":
      return ["before", "after"];
    case "member":
      return ["is"];
    case "status":
    case "priority":
      return ["is", "isNot"];
    case "string":
      return ["eq", "contains", "empty"];
    case "number":
      return ["gt", "lt", "eq"];
    case "boolean":
      return ["is"];
    case "markdown":
      return ["contains", "empty"];
    case "wiki-node":
      return ["is", "empty"];
    case "string-list":
      return ["contains"];
    default: {
      const _e: never = kind;
      return _e;
    }
  }
}

export function opLabel(op: FilterOp): string {
  switch (op) {
    case "before":
      return "before";
    case "after":
      return "after";
    case "is":
      return "is";
    case "isNot":
      return "is not";
    case "eq":
      return "equals";
    case "contains":
      return "contains";
    case "empty":
      return "is empty";
    case "gt":
      return "greater than";
    case "lt":
      return "less than";
    default: {
      const _e: never = op;
      return _e;
    }
  }
}

export function opNeedsValue(op: FilterOp): boolean {
  return op !== "empty";
}

export function clauseComplete(clause: FilterClause): boolean {
  if (!clause.prop || !clause.op) {
    return false;
  }
  if (!opNeedsValue(clause.op)) {
    return true;
  }
  return clause.value.trim().length > 0;
}

export function countClauses(node: FilterNode): number {
  if (node.kind === "clause") {
    return 1;
  }
  return node.children.reduce((n, child) => n + countClauses(child), 0);
}

export function filterIsActive(root: FilterGroup): boolean {
  const walk = (node: FilterNode): boolean => {
    if (node.kind === "clause") {
      return clauseComplete(node);
    }
    return node.children.some(walk);
  };
  return walk(root);
}

function dayKey(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return match ? match[1]! : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asBool(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

function asText(value: unknown): string {
  if (value == null) {
    return "";
  }
  return String(value);
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === "string" && value.trim()) {
    return [value];
  }
  return [];
}

function includesText(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function declared(schema: FilterSchema | undefined, level: FilterLevel, key: string): boolean {
  if (!schema) {
    return false;
  }
  return schema[level].some((def) => def.key === key);
}

function builtinRaw(issue: FilterSubject, id: BuiltinPropId): unknown {
  switch (id) {
    case "startDate":
      return issue.startDate;
    case "endDate":
      return issue.endDate;
    case "created":
      return issue.created;
    case "updated":
      return issue.updated;
    case "createdBy":
      return issue.createdBy;
    case "assignee":
      return issue.assignee;
    case "status":
      return issue.status;
    case "priority":
      return issue.priority;
    default: {
      const _e: never = id;
      return _e;
    }
  }
}

function customRaw(issue: FilterSubject, prop: Extract<FilterProp, { source: "custom" }>): unknown {
  if (prop.fieldType === "markdown") {
    return issue.markdownFields[prop.key] ?? "";
  }
  return issue.fields[prop.key];
}

function compare(op: FilterOp, raw: unknown, expected: string, kind: ReturnType<typeof fieldTypeOf>): boolean {
  if (op === "empty") {
    if (kind === "string" || kind === "markdown" || kind === "wiki-node") {
      return asText(raw).trim().length === 0;
    }
    if (kind === "string-list") {
      return asList(raw).length === 0;
    }
    return asText(raw).trim().length === 0;
  }
  if (op === "before" || op === "after") {
    const field = dayKey(asText(raw));
    const bound = dayKey(expected);
    if (!field || !bound) {
      return false;
    }
    return op === "before" ? field < bound : field > bound;
  }
  if (op === "gt" || op === "lt" || (op === "eq" && kind === "number")) {
    const field = asNumber(raw);
    const bound = asNumber(expected);
    if (field === null || bound === null) {
      return false;
    }
    if (op === "gt") {
      return field > bound;
    }
    if (op === "lt") {
      return field < bound;
    }
    return field === bound;
  }
  if (op === "eq") {
    return sameText(asText(raw), expected);
  }
  if (op === "contains") {
    if (kind === "string-list") {
      return asList(raw).some((item) => sameText(item, expected));
    }
    return includesText(asText(raw), expected);
  }
  if (op === "is" || op === "isNot") {
    let actual = "";
    if (kind === "boolean") {
      const flag = asBool(raw);
      if (flag === null) {
        return false;
      }
      actual = flag ? "true" : "false";
    } else {
      actual = asText(raw);
    }
    const hit = actual === expected;
    return op === "is" ? hit : !hit;
  }
  return false;
}

function clauseMatches(
  clause: FilterClause,
  issue: FilterSubject,
  schema: FilterSchema | undefined,
): boolean | "skip" {
  if (!clauseComplete(clause) || !clause.prop || !clause.op) {
    return "skip";
  }
  const prop = clause.prop;
  if (prop.source === "custom") {
    if (issue.projectId !== prop.projectId || issue.level !== prop.level) {
      return false;
    }
    if (!declared(schema, issue.level, prop.key)) {
      return false;
    }
  }
  const raw =
    prop.source === "builtin" ? builtinRaw(issue, prop.id) : customRaw(issue, prop);
  return compare(clause.op, raw, clause.value, fieldTypeOf(prop));
}

function evalNode(
  node: FilterNode,
  issue: FilterSubject,
  schema: FilterSchema | undefined,
): boolean | "skip" {
  if (node.kind === "clause") {
    return clauseMatches(node, issue, schema);
  }
  const parts = node.children.map((child) => evalNode(child, issue, schema));
  const live = parts.filter((part) => part !== "skip");
  if (live.length === 0) {
    return "skip";
  }
  return node.join === "and" ? live.every(Boolean) : live.some(Boolean);
}

export function issueMatches(
  issue: FilterSubject,
  schema: FilterSchema | undefined,
  root: FilterGroup,
): boolean {
  return evalNode(root, issue, schema) === true;
}

export function applyFilter(
  tree: FilterTree,
  issueAt: (key: string) => FilterSubject | null,
  schemaAt: (projectId: string) => FilterSchema | undefined,
  root: FilterGroup,
): { active: boolean; kept: Set<string> | null; matchCount: number } {
  if (!filterIsActive(root)) {
    return { active: false, kept: null, matchCount: 0 };
  }
  const matched = new Set<string>();
  const visit = (key: string) => {
    const issue = issueAt(key);
    if (issue && issueMatches(issue, schemaAt(issue.projectId), root)) {
      matched.add(key);
    }
    for (const child of tree.children[key] ?? []) {
      visit(child);
    }
  };
  for (const rootKey of tree.roots) {
    visit(rootKey);
  }
  const kept = new Set<string>();
  const mark = (key: string): boolean => {
    let hit = matched.has(key);
    for (const child of tree.children[key] ?? []) {
      if (mark(child)) {
        hit = true;
      }
    }
    if (hit) {
      kept.add(key);
    }
    return hit;
  };
  for (const rootKey of tree.roots) {
    mark(rootKey);
  }
  return { active: true, kept, matchCount: matched.size };
}

export type VisibleRowRef = { key: string; depth: number };

/**
 * Rows to draw. A project stays even when none of its issues match, because
 * the line is the frame of the roadmap. An epic stays only as an ancestor of
 * a match. Focus limits the sheet to one project. Collapse applies only when
 * no filter is hiding rows; a live filter keeps the path to each match.
 */
export function visibleRowKeys(args: {
  tree: FilterTree;
  isProject: (key: string) => boolean;
  projectIdOf: (key: string) => string;
  kept: Set<string> | null;
  focusProjectId: string | null;
  collapsed: ReadonlySet<string>;
}): VisibleRowRef[] {
  const { tree, isProject, projectIdOf, kept, focusProjectId, collapsed } = args;
  const rows: VisibleRowRef[] = [];

  const walk = (key: string, depth: number) => {
    if (isProject(key)) {
      if (focusProjectId && projectIdOf(key) !== focusProjectId) {
        return;
      }
      rows.push({ key, depth });
      const kids = tree.children[key] ?? [];
      if (kids.length === 0) {
        return;
      }
      if (kept === null && collapsed.has(key)) {
        return;
      }
      for (const child of kids) {
        if (kept && !kept.has(child)) {
          continue;
        }
        walk(child, depth + 1);
      }
      return;
    }
    if (focusProjectId && projectIdOf(key) !== focusProjectId) {
      return;
    }
    if (kept && !kept.has(key)) {
      return;
    }
    rows.push({ key, depth });
    const kids = tree.children[key] ?? [];
    if (kids.length === 0) {
      return;
    }
    if (kept === null && collapsed.has(key)) {
      return;
    }
    for (const child of kids) {
      if (kept && !kept.has(child)) {
        continue;
      }
      walk(child, depth + 1);
    }
  };

  for (const root of tree.roots) {
    walk(root, 0);
  }
  return rows;
}

function valuePhrase(
  prop: FilterProp,
  op: FilterOp,
  value: string,
  names: FilterNames,
): string {
  if (!opNeedsValue(op)) {
    return "";
  }
  if (!value.trim()) {
    return "…";
  }
  const kind = fieldTypeOf(prop);
  if (kind === "boolean") {
    return value === "true" ? "true" : "false";
  }
  if (kind === "status") {
    return STATUS_LABEL[value] ?? value;
  }
  if (kind === "priority") {
    return PRIORITY_LABEL[value] ?? value;
  }
  if (kind === "member") {
    return names.member(value);
  }
  if (kind === "wiki-node") {
    return names.wiki(value);
  }
  return value.trim();
}

function clausePhrase(clause: FilterClause, names: FilterNames): string {
  if (!clause.prop) {
    return "Incomplete condition";
  }
  const label = propLabel(clause.prop);
  if (!clause.op) {
    return `${label} …`;
  }
  const op = opLabel(clause.op);
  if (!opNeedsValue(clause.op)) {
    return `${label} ${op}`;
  }
  const value = valuePhrase(clause.prop, clause.op, clause.value, names);
  return `${label} ${op} ${value}`;
}

export function summarize(group: FilterGroup, names: FilterNames): string {
  const parts = group.children.map((child) => {
    if (child.kind === "clause") {
      return clausePhrase(child, names);
    }
    const inner = summarize(child, names);
    return inner ? `(${inner})` : "Incomplete condition";
  });
  if (parts.length === 0) {
    return "";
  }
  const head = group.join === "and" ? "Match all: " : "Match any: ";
  const glue = group.join === "and" ? ", and " : ", or ";
  return head + parts.join(glue);
}
