/**
 * Path SoT for Outlet children that fill the workspace viewport and own
 * their own overflow (`.pageScroll` stops being the scroller).
 *
 * Members: WikiShell routes + `/w/roadmap` + `/w/table`.
 * Detail companion: `needsFillDetailScroll` — only Roadmap / Table, where
 * the center child is a fill board/table and the detail aside must scroll.
 *
 * ↔ route.tsx — `layoutClass` uses both helpers
 * ↔ styles.module.scss — `.layoutFillViewport` / `.layoutFillDetail`
 * ↔ components/wiki-shell/is-wiki-shell-path.ts — WikiShell subset only
 * ↔ sub-components/roadmap/styles.module.scss — `.board` fills the box
 * ↔ styles.module.scss `.tablePage` + sub-components/issue-table — Table fills
 */
import { matchPath } from "react-router-dom";
import { isWikiShellPath } from "@/components/wiki-shell";

const FILL_BOARD_PATTERNS: Array<{ path: string; end: boolean }> = [
  { path: "/w/roadmap", end: true },
  { path: "/w/table", end: true },
];

function matchesAny(
  pathname: string,
  patterns: Array<{ path: string; end: boolean }>,
): boolean {
  return patterns.some((pattern) => Boolean(matchPath(pattern, pathname)));
}

/** True when the Outlet child must fill height and own overflow. */
export function isFillViewportPath(pathname: string): boolean {
  return isWikiShellPath(pathname) || matchesAny(pathname, FILL_BOARD_PATTERNS);
}

/**
 * True when the detail aside scrolls inside the fill-viewport row
 * (Roadmap / Table). Do not apply to WikiShell routes.
 */
export function needsFillDetailScroll(pathname: string): boolean {
  return matchesAny(pathname, FILL_BOARD_PATTERNS);
}
