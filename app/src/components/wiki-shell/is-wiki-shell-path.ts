/**
 * Path SoT for routes that render `<WikiShell>` as the Outlet child.
 *
 * Fill-viewport membership is broader: WikiShell ∪ Roadmap ∪ Table lives in
 * `pages/channels/workspace-page/is-fill-viewport-path.ts`. This file is only
 * the WikiShell subset.
 *
 * ↔ pages/channels/workspace-page/is-fill-viewport-path.ts — composes this
 * ↔ pages/channels/workspace-page/route.tsx — layout via isFillViewportPath
 * ↔ pages/channels/workspace-page/styles.module.scss — `.layoutFillViewport`
 * ↔ components/wiki-shell/styles.module.scss — `.shell` fills that box
 */
import { matchPath } from "react-router-dom";

const WIKI_SHELL_PATTERNS: Array<string | { path: string; end: boolean }> = [
  "/w/home",
  { path: "/w/wiki", end: true },
  "/w/wiki/:wikiNodeId",
  { path: "/w/members", end: true },
  "/w/members/:memberId",
  { path: "/w/handoffs", end: true },
  "/w/handoffs/:handoffId",
  "/w/settings/*",
  "/w/projects/:projectId/settings",
];

/** True when `pathname` is a WikiShell route (Home / wiki / members / handoffs / settings). */
export function isWikiShellPath(pathname: string): boolean {
  return WIKI_SHELL_PATTERNS.some((pattern) =>
    Boolean(
      typeof pattern === "string"
        ? matchPath({ path: pattern, end: true }, pathname)
        : matchPath(pattern, pathname),
    ),
  );
}
