/**
 * Shared types for local-pm data layer (main + renderer via IPC).
 * ↔ src/lib/types.ts — renderer hand-mirror (superset / inlined doctor+ladder shapes)
 * Do not collapse the two files — core owns EntityId via dir-id, ladder, doctor modules.
 */

// Type-only, so the cycle with ladder.ts is erased at build time.
import type { LadderViolation } from "./ladder.js";
import type { EntityId } from "./dir-id.js";
import type { IssuePriorityId } from "./issue-priority.js";
import type { IssueStatusId } from "./issue-status.js";

export type { EntityId } from "./dir-id.js";

export type IssueLevel = "epic" | "task" | "subtask";

export type {
  IssueStatusCategory,
  IssueStatusId,
  IssueStatusDef,
} from "./issue-status.js";

export type {
  IssuePriorityId,
  IssuePriorityDef,
} from "./issue-priority.js";

export type MetaFieldType = "string" | "number" | "boolean" | "date" | "markdown";

export interface CustomPropDef {
  key: string;
  label: string;
  type: MetaFieldType;
  /** Optional field contract (“What is this”); omit when empty. */
  help?: string;
}

export interface CustomPropsSchema {
  epic: CustomPropDef[];
  task: CustomPropDef[];
  subtask: CustomPropDef[];
}

export interface Project {
  id: EntityId;
  /** Absolute directory path */
  path: string;
  /** Relative path from workspace root */
  relPath: string;
  title: string;
  description: string;
  /** ISO-8601 UTC; immutable after create */
  created: string;
  /** ISO-8601 UTC; app-managed on write */
  updated: string;
  /** System field: creating member id, or null when unknown / CLI without me. */
  createdBy: EntityId | null;
}

export interface Issue {
  projectId: EntityId;
  id: EntityId;
  level: IssueLevel;
  /** null = top-level issue directly under the project. */
  parentId: EntityId | null;
  path: string;
  relPath: string;
  title: string;
  /** Built-in status id (draft / todo / in-progress / done / cancel). */
  status: IssueStatusId;
  /** Built-in priority id (very-low / low / medium / high / very-high). */
  priority: IssuePriorityId;
  startDate: string | null;
  endDate: string | null;
  /**
   * Same-project issue ids that must complete before this one (hard deps).
   * Orthogonal to `parentId`. Empty when none.
   */
  blockedBy: EntityId[];
  description: string;
  /** ISO-8601 UTC; immutable after create */
  created: string;
  /** ISO-8601 UTC; app-managed on write */
  updated: string;
  /** Who should do this; null = unassigned. */
  assignee: EntityId | null;
  /** System field: creating member id, or null when unknown / CLI without me. */
  createdBy: EntityId | null;
  /** Non-markdown custom field values */
  fields: Record<string, unknown>;
  /** Markdown custom fields: key → file contents (may be empty if not yet created) */
  markdownFields: Record<string, string>;
  /** Stated level vs stated placement disagree; never silently repaired. */
  violations: LadderViolation[];
}

export type IssueRefKey = string; // `${projectId}::${issueId}`

export function issueRefKey(projectId: EntityId, issueId: EntityId): IssueRefKey {
  return `${projectId}::${issueId}`;
}

export interface TreeNode {
  kind: "project" | "issue";
  /** project id as string, or `${projectId}::${issueId}` */
  key: string;
  projectId: EntityId;
  issueId?: EntityId;
  level?: IssueLevel;
  title: string;
  /** Ladder violation on this issue — surfaced as a badge in the tree. */
  hasViolation?: boolean;
}

export interface IssueTree {
  /** Composite or project keys → node */
  byId: Record<string, TreeNode>;
  /** parent key → child keys (project roots use parent "") */
  children: Record<string, string[]>;
  roots: string[];
}

export interface IssueCreateInput {
  projectId: EntityId;
  /** null = create epic under project */
  parentIssueId: EntityId | null;
  title?: string;
}

export interface IssuePatch {
  title?: string;
  status?: IssueStatusId;
  priority?: IssuePriorityId;
  startDate?: string | null;
  endDate?: string | null;
  blockedBy?: EntityId[];
  description?: string;
  /** Set or clear assignee. createdBy is system — not patchable. */
  assignee?: EntityId | null;
  fields?: Record<string, unknown>;
  markdownFields?: Record<string, string>;
}

/** Injected write actor — never a module singleton. */
export interface WriteActorOptions {
  actorMemberId?: EntityId | null;
}

export interface ProjectCreateInput {
  title?: string;
}

export interface ProjectPatch {
  title?: string;
  description?: string;
}

export interface MoveIssueInput {
  projectId: EntityId;
  issueId: EntityId;
  newParentIssueId: EntityId | null;
}

export interface WorkspaceMeta {
  title: string;
  /** ISO date YYYY-MM-DD */
  createdDate: string;
  /** README.md body */
  description: string;
}

export type WorkspacePatch = Partial<
  Pick<WorkspaceMeta, "title" | "description">
>;

export interface WorkspaceSnapshot {
  root: string;
  meta: WorkspaceMeta;
  projects: Project[];
  issues: Issue[];
  tree: IssueTree;
}

export type ViewKind = "table" | "list";

export interface WorkspaceView {
  id: string;
  name: string;
  kind: ViewKind;
}

export interface ViewOrder {
  roots: string[];
  children: Record<string, string[]>;
}

export type ViewOrdersFile = Record<string, ViewOrder>;

export interface CreateViewInput {
  name?: string;
  kind?: ViewKind;
}

export interface UpdateViewInput {
  name?: string;
  kind?: ViewKind;
}

/** Wiki sidebar / wiki-nodes — mirror of wiki.ts public shapes for IPC. */
export type WikiSidebarRefNode = {
  type: "ref";
  id: string;
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

export interface WikiNode {
  id: string;
  path: string;
  relPath: string;
  body: string;
  title: string;
  /** Short blurb; required key, may be "". */
  description: string;
  /** ISO-8601 UTC; immutable after create */
  created: string;
  /** ISO-8601 UTC; app-managed on write */
  updated: string;
  createdBy: EntityId | null;
}

export interface WikiNodeMeta {
  id: string;
  path: string;
  relPath: string;
  title: string;
  description: string;
  created: string;
  updated: string;
  createdBy: EntityId | null;
}

/** Membership is current state only — not interval history. */
export type Membership = "involved" | "left";

export interface Member {
  id: EntityId;
  path: string;
  relPath: string;
  body: string;
  title: string;
  membership: Membership;
  /** Absolute path to avatar.<ext> when present; else null. */
  avatarPath: string | null;
  created: string;
  updated: string;
}

export interface MemberMeta {
  id: EntityId;
  path: string;
  relPath: string;
  title: string;
  membership: Membership;
  avatarPath: string | null;
  created: string;
  updated: string;
}

export interface MemberSnapshot {
  nodes: MemberMeta[];
  invalidNames: string[];
}

export interface CreateMemberInput {
  title?: string;
  body?: string;
  membership?: Membership;
}

export interface MemberPatch {
  title?: string;
  body?: string;
  membership?: Membership;
}

/** Sent collaboration handoff (workspace-level; not wiki / issue). */
export interface Handoff {
  id: EntityId;
  path: string;
  relPath: string;
  body: string;
  title: string;
  /** Short blurb; required key, may be "". */
  description: string;
  /** Related project id (required). */
  relatedProject: EntityId;
  /** true = open, false = closed. */
  open: boolean;
  /** Initiator member id. */
  from: EntityId;
  /** Counterpart member id. */
  to: EntityId;
  created: string;
  updated: string;
}

export interface HandoffMeta {
  id: EntityId;
  path: string;
  relPath: string;
  title: string;
  description: string;
  relatedProject: EntityId;
  open: boolean;
  from: EntityId;
  to: EntityId;
  created: string;
  updated: string;
}

export interface HandoffSnapshot {
  nodes: HandoffMeta[];
  invalidNames: string[];
}

export interface CreateHandoffInput {
  title?: string;
  description?: string;
  relatedProject: EntityId;
  /** Defaults to true (open). */
  open?: boolean;
  body?: string;
  from: EntityId;
  to: EntityId;
}

export interface HandoffPatch {
  title?: string;
  description?: string;
  relatedProject?: EntityId;
  open?: boolean;
  body?: string;
  from?: EntityId;
  to?: EntityId;
}

export interface WikiSnapshot {
  sidebar: WikiSidebarNode[];
  nodes: WikiNodeMeta[];
  /**
   * Ids on disk not in Contents. After getWiki reconcile this is always [];
   * doctor still reports wiki-unlisted for hand-edited orphans.
   */
  unlisted: string[];
  broken: string[];
  invalidNames: string[];
}

export interface CreateWikiNodeInput {
  title?: string;
  description?: string;
  /** Insert under this Contents ref as child when found; else root append. */
  parentId?: string | null;
  body?: string;
  /** Optional create-time actor; same as WriteActorOptions.actorMemberId. */
  actorMemberId?: EntityId | null;
}

export interface WikiNodePatch {
  title?: string;
  description?: string;
  body?: string;
}

export type WikiSidebarMove = "up" | "down" | "indent" | "outdent";

/**
 * Absolute Contents placement. `index` is on the PRE-removal tree;
 * same-parent moves adjust when oldIndex < index.
 */
export interface WikiSidebarPlacement {
  /** null = Contents root */
  parentId: string | null;
  index: number;
}

/** @deprecated Prefer WikiSidebarPlacement */
export type WikiSidebarTarget = WikiSidebarPlacement;
