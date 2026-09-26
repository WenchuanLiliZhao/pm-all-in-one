/**
 * The body file of a node. One name for Home, project, issue, wiki-node,
 * member, and handoff: `body.md` next to the props file.
 *
 * It used to be `README.md`. That name carried two meanings in one tree —
 * a node body (no `#` title; the app renders the title) and an ordinary
 * README under `assets/` (starts with a `#` title) — and agents mixed them
 * up. `body.md` is the product's own word for this file (`--body` on the
 * handoff CLI), and `README.md` keeps its ordinary meaning everywhere.
 *
 * ↔ ../workspace/migrate-body.ts — one-shot rename of legacy README.md bodies
 * ↔ ../workspace/doctor.ts — body-legacy-readme warning
 * ↔ ../../workspace-template/.pm/agent.md — the rule agents read
 */
import path from "node:path";

export const BODY_FILE = "body.md";

/** The pre-rename body name. Read only by the migration and by doctor. */
export const LEGACY_BODY_FILE = "README.md";

export function bodyPath(nodeDir: string): string {
  return path.join(nodeDir, BODY_FILE);
}
