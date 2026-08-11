import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { z } from "zod";

import { deleteViewOrder, isReservedViewKey } from "./view-orders.js";

export type ViewKind = "table" | "list";

export interface WorkspaceView {
  id: string;
  name: string;
  kind: ViewKind;
}

export interface ViewsFile {
  views: WorkspaceView[];
}

export interface CreateViewInput {
  name?: string;
  kind?: ViewKind;
}

export interface UpdateViewInput {
  name?: string;
  kind?: ViewKind;
}

const ViewZod = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["table", "list"]),
});

const ViewsFileZod = z.object({
  views: z.array(ViewZod),
});

export function viewsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".pm", "views.json");
}

export function defaultViewsFile(): ViewsFile {
  return { views: [] };
}

function writeViewsFile(workspaceRoot: string, data: ViewsFile): void {
  const file = viewsPath(workspaceRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** Ensure `.pm/views.json` exists. Missing/corrupt → empty custom views. */
export function ensureViews(workspaceRoot: string): WorkspaceView[] {
  const file = viewsPath(workspaceRoot);
  if (!fs.existsSync(file)) {
    const seeded = defaultViewsFile();
    writeViewsFile(workspaceRoot, seeded);
    return seeded.views;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    const parsed = ViewsFileZod.parse(raw);
    return parsed.views;
  } catch {
    const seeded = defaultViewsFile();
    writeViewsFile(workspaceRoot, seeded);
    return seeded.views;
  }
}

export function listViews(workspaceRoot: string): WorkspaceView[] {
  return ensureViews(workspaceRoot);
}

export function createView(
  workspaceRoot: string,
  input: CreateViewInput = {},
): WorkspaceView {
  const views = ensureViews(workspaceRoot);
  let id = nanoid(10);
  while (isReservedViewKey(id) || views.some((v) => v.id === id)) {
    id = nanoid(10);
  }
  const view: WorkspaceView = {
    id,
    name: (input.name?.trim() || "New view").slice(0, 80),
    kind: input.kind ?? "list",
  };
  writeViewsFile(workspaceRoot, { views: [...views, view] });
  return view;
}

export function updateView(
  workspaceRoot: string,
  viewId: string,
  patch: UpdateViewInput,
): WorkspaceView {
  const views = ensureViews(workspaceRoot);
  const idx = views.findIndex((v) => v.id === viewId);
  if (idx < 0) {
    throw new Error(`View not found: ${viewId}`);
  }
  const current = views[idx]!;
  const next: WorkspaceView = {
    ...current,
    name:
      patch.name !== undefined
        ? patch.name.trim().slice(0, 80) || current.name
        : current.name,
    kind: patch.kind ?? current.kind,
  };
  const copy = [...views];
  copy[idx] = next;
  writeViewsFile(workspaceRoot, { views: copy });
  return next;
}

export function deleteView(workspaceRoot: string, viewId: string): boolean {
  const views = ensureViews(workspaceRoot);
  const next = views.filter((v) => v.id !== viewId);
  if (next.length === views.length) {
    return false;
  }
  writeViewsFile(workspaceRoot, { views: next });
  deleteViewOrder(workspaceRoot, viewId);
  return true;
}
