// ↔ src/lib/bridge/pm-api.ts — PmApi contract SoT
// ↔ electron/preload.cts — window.pm when running under Electron
// ↔ src/lib/bridge/http-pm.ts — createHttpPmApi when no preload
import type {
  AdoptResult,
  CreateViewInput,
  CustomPropsSchema,
  DoctorReport,
  Issue,
  IssueCreateInput,
  IssuePatch,
  IssueTree,
  MoveIssueInput,
  Project,
  ProjectCreateInput,
  ProjectPatch,
  StrayEntry,
  UpdateViewInput,
  ViewOrder,
  ViewOrdersFile,
  WorkspaceMeta,
  WorkspacePatch,
  WorkspaceSnapshot,
  WorkspaceView,
} from "./types";
import { createHttpPmApi } from "./bridge/http-pm";
import type {
  CreateWorkspaceOptions,
  NodeRef,
  PmApi,
} from "./bridge/pm-api";

export type {
  AdoptResult,
  CreateViewInput,
  CustomPropsSchema,
  DoctorReport,
  Issue,
  IssueCreateInput,
  IssuePatch,
  IssueTree,
  MoveIssueInput,
  Project,
  ProjectCreateInput,
  ProjectPatch,
  StrayEntry,
  UpdateViewInput,
  ViewOrder,
  ViewOrdersFile,
  WorkspaceMeta,
  WorkspacePatch,
  WorkspaceSnapshot,
  WorkspaceView,
};

export type { CreateWorkspaceOptions, NodeRef, PmApi };

declare global {
  interface Window {
    pm?: PmApi;
  }
}

let httpPmSingleton: PmApi | null = null;

export function getPm(): PmApi {
  if (window.pm) {
    return window.pm;
  }
  if (!httpPmSingleton) {
    httpPmSingleton = createHttpPmApi();
  }
  return httpPmSingleton;
}

export function isWebPm(): boolean {
  return !window.pm;
}
