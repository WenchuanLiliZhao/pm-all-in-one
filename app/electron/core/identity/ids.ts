import fs from "node:fs";
import path from "node:path";

import { nanoid } from "nanoid";

import {
  ENTITY_ID_LENGTH,
  isValidEntityId,
  type EntityId,
} from "./dir-id.js";

const ALLOCATE_RETRIES = 8;

export function hierarchyRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, "issue-hierarchy");
}

export function workspacePmDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".pm");
}

export function wikiRoot(workspaceRoot: string): string {
  const wiki = path.join(workspaceRoot, "wiki");
  const doc = path.join(workspaceRoot, "doc");
  if (!fs.existsSync(wiki) && fs.existsSync(doc) && fs.statSync(doc).isDirectory()) {
    fs.renameSync(doc, wiki);
  }
  return wiki;
}

export function membersRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, "members");
}

export function handoffsRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, "handoffs");
}

/**
 * Draw a unique nanoid(21) that does not already exist as a child of
 * `parentDir`. Collision probability is negligible; exists-check is belt-and-suspenders.
 */
export function allocateEntityId(parentDir: string): EntityId {
  fs.mkdirSync(parentDir, { recursive: true });
  for (let i = 0; i < ALLOCATE_RETRIES; i++) {
    const id = nanoid(ENTITY_ID_LENGTH);
    if (!isValidEntityId(id)) {
      continue;
    }
    const full = path.join(parentDir, id);
    if (!fs.existsSync(full)) {
      return id;
    }
  }
  throw new Error(
    `Failed to allocate a unique entity id under ${JSON.stringify(parentDir)} after ${ALLOCATE_RETRIES} attempts.`,
  );
}

export function allocateProjectId(workspaceRoot: string): EntityId {
  return allocateEntityId(hierarchyRoot(workspaceRoot));
}

export function allocateIssueId(projectDir: string): EntityId {
  return allocateEntityId(projectDir);
}

export function allocateWikiNodeId(workspaceRoot: string): EntityId {
  return allocateEntityId(wikiRoot(workspaceRoot));
}

export function allocateMemberId(workspaceRoot: string): EntityId {
  return allocateEntityId(membersRoot(workspaceRoot));
}

export function allocateHandoffId(workspaceRoot: string): EntityId {
  return allocateEntityId(handoffsRoot(workspaceRoot));
}
