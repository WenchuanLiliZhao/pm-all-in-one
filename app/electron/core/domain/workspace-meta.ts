import fs from "node:fs";
import path from "node:path";

import {
  equalsForSync,
  pickWorkspaceEditable,
  StaleWriteError,
  type WorkspaceEditableSlice,
} from "../sync/detail-diff.js";
import { loadWorkspaceProps, writePropsTs } from "../infra/props-load.js";
import type { WorkspaceMeta, WorkspacePatch } from "../identity/types.js";

export function workspacePropsPath(root: string): string {
  return path.join(root, "workspace.ts");
}

export function workspaceReadmePath(root: string): string {
  return path.join(root, "README.md");
}

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultWorkspaceTitle(root: string): string {
  const base = path.basename(path.resolve(root));
  return base.trim() || "Workspace";
}

export function defaultWorkspaceMeta(
  root: string,
  title?: string,
): WorkspaceMeta {
  const trimmed = title?.trim();
  return {
    title: trimmed || defaultWorkspaceTitle(root),
    createdDate: todayIsoDate(),
    description: "",
  };
}

/** Write workspace.ts + README.md from a full meta object. */
export function writeWorkspaceMeta(root: string, meta: WorkspaceMeta): void {
  fs.writeFileSync(
    workspacePropsPath(root),
    writePropsTs({
      title: meta.title,
      createdDate: meta.createdDate,
    }),
    "utf8",
  );
  fs.writeFileSync(workspaceReadmePath(root), meta.description, "utf8");
}

/**
 * Ensure root workspace.ts + README.md exist.
 * Missing files are seeded from folder basename + today's date.
 */
export async function ensureWorkspaceMeta(root: string): Promise<WorkspaceMeta> {
  const propsFile = workspacePropsPath(root);
  const readmeFile = workspaceReadmePath(root);
  const defaults = defaultWorkspaceMeta(root);

  if (!fs.existsSync(propsFile)) {
    writeWorkspaceMeta(root, {
      ...defaults,
      description: fs.existsSync(readmeFile)
        ? fs.readFileSync(readmeFile, "utf8")
        : "",
    });
    return readWorkspaceMeta(root);
  }

  if (!fs.existsSync(readmeFile)) {
    fs.writeFileSync(readmeFile, "", "utf8");
  }

  return readWorkspaceMeta(root);
}

export async function readWorkspaceMeta(root: string): Promise<WorkspaceMeta> {
  const propsFile = workspacePropsPath(root);
  if (!fs.existsSync(propsFile)) {
    throw new Error(`Missing workspace.ts at ${root}`);
  }
  const props = await loadWorkspaceProps(fs.readFileSync(propsFile, "utf8"));
  const description = fs.existsSync(workspaceReadmePath(root))
    ? fs.readFileSync(workspaceReadmePath(root), "utf8")
    : "";
  return {
    title: props.title,
    createdDate: props.createdDate,
    description,
  };
}

export async function updateWorkspaceMeta(
  root: string,
  patch: WorkspacePatch,
  options: { expected?: WorkspaceEditableSlice } = {},
): Promise<WorkspaceMeta> {
  const current = await ensureWorkspaceMeta(root);
  if (options.expected) {
    const disk = pickWorkspaceEditable(current);
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
    if (conflicts.length > 0) {
      throw new StaleWriteError(
        `Workspace changed on disk (${conflicts.join(", ")}). Reload or keep editing.`,
        conflicts,
      );
    }
  }
  const next: WorkspaceMeta = {
    title: patch.title !== undefined ? patch.title : current.title,
    // createdDate is immutable after workspace creation.
    createdDate: current.createdDate,
    description:
      patch.description !== undefined ? patch.description : current.description,
  };
  if (!next.title.trim()) {
    throw new Error("Workspace title is required.");
  }
  writeWorkspaceMeta(root, next);
  return readWorkspaceMeta(root);
}
