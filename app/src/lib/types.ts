/**
 * Zone 2 IPC payload types for the renderer (hand-mirrored; keep shapes in sync).
 * ↔ electron/core/types.ts — core SoT splits EntityId / ladder / doctor elsewhere
 * ↔ electron/src/lib/types.ts — orphan Electron-root twin of this file
 */

import type { IssuePriorityId } from "./issue-priority";
import type { IssueStatusId } from "./issue-status";

export type EntityId = string;

export type IssueLevel = "epic" | "task" | "subtask";

export type {
  IssueStatusCategory,
  IssueStatusId,
  IssueStatusDef,
} from "./issue-status";

export type {
  IssuePriorityId,
  IssuePriorityDef,
} from "./issue-priority";

export type MetaFieldType = "string" | "number" | "boolean" | "date" | "markdown";

export type LadderViolationKind =
  | "level-missing"
  | "self-parent"
  | "missing-parent"
  | "cycle"
  | "root-not-epic"
  | "ladder-break";

export interface LadderViolation {
  kind: LadderViolationKind;
  message: string;
  expectedLevel: IssueLevel | null;
}

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
  path: string;
  relPath: string;
  title: string;
  description: string;
  /** ISO-8601 UTC; immutable after create */
  created: string;
  /** ISO-8601 UTC; app-managed on write */
  updated: string;
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
  assignee: EntityId | null;
  createdBy: EntityId | null;
  fields: Record<string, unknown>;
  markdownFields: Record<string, string>;
  /** Stated level vs stated placement disagree; never silently repaired. */
  violations: LadderViolation[];
}

export type IssueRefKey = string;

export function issueRefKey(projectId: string, issueId: string): IssueRefKey {
  return `${projectId}::${issueId}`;
}

export interface TreeNode {
  kind: "project" | "issue";
  key: string;
  projectId: string;
  issueId?: EntityId;
  level?: IssueLevel;
  title: string;
  /** Ladder violation on this issue — surfaced as a badge in the tree. */
  hasViolation?: boolean;
}

export interface IssueTree {
  byId: Record<string, TreeNode>;
  children: Record<string, string[]>;
  roots: string[];
}

export interface IssueCreateInput {
  projectId: EntityId;
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
  assignee?: EntityId | null;
  fields?: Record<string, unknown>;
  markdownFields?: Record<string, string>;
}

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
  strays?: DoctorReport;
}

export type StrayKind = "invalid-name" | "missing-props" | "bare-numeric";

export interface StrayEntry {
  path: string;
  relPath: string;
  kind: StrayKind;
  message: string;
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

/** Wiki sidebar / wiki-nodes — keep in sync with electron/core/types. */
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
  created: string;
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

export type Membership = "involved" | "left";

export interface Member {
  id: EntityId;
  path: string;
  relPath: string;
  body: string;
  title: string;
  membership: Membership;
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
