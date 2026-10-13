/**
 * Machine-local pane widths. Length bounds live in `global-styles/layout.scss`;
 * the px numbers here are the same lengths at a 16px root (table title is rem).
 *
 * ↔ src/global-styles/layout.scss
 * ↔ components/ui/pane-resize/use-pane-width.ts
 * ↔ components/ui/pane-resize/index.tsx
 */
export type PaneWidthSpec = {
  storageKey: string;
  defaultToken: string;
  minToken: string;
  maxToken: string;
  defaultPx: number;
  minPx: number;
  maxPx: number;
};

export const PANE_WIDTH = {
  wikiRail: {
    storageKey: "pm.layout.wiki-rail-width",
    defaultToken: "--layout--wiki-rail-width",
    minToken: "--layout--wiki-rail-min",
    maxToken: "--layout--wiki-rail-max",
    defaultPx: 280,
    minPx: 200,
    maxPx: 480,
  },
  detail: {
    storageKey: "pm.layout.detail-width",
    defaultToken: "--layout--detail-width",
    minToken: "--layout--detail-min",
    maxToken: "--layout--detail-max",
    defaultPx: 320,
    minPx: 320,
    maxPx: 640,
  },
  terminal: {
    storageKey: "pm.layout.terminal-width",
    defaultToken: "--layout--terminal-width",
    minToken: "--layout--terminal-min",
    maxToken: "--layout--terminal-max",
    defaultPx: 280,
    minPx: 280,
    maxPx: 640,
  },
  roadmapLabel: {
    storageKey: "pm.roadmap.label-width",
    defaultToken: "--layout--roadmap-label-width",
    minToken: "--layout--roadmap-label-min",
    maxToken: "--layout--roadmap-label-max",
    defaultPx: 280,
    minPx: 180,
    maxPx: 480,
  },
  tableTitle: {
    storageKey: "pm.layout.table-title-width",
    defaultToken: "--layout--table-title-width",
    minToken: "--layout--table-title-min",
    maxToken: "--layout--table-title-max",
    defaultPx: 352,
    minPx: 256,
    maxPx: 448,
  },
} as const satisfies Record<string, PaneWidthSpec>;

export type ResolvedPaneBounds = {
  min: number;
  max: number;
  fallback: number;
  width: number;
};

/** `320px` / `22rem` → px. Anything else (empty, `var(...)`) is null. */
export function parseCssLength(raw: string, rootFontPx: number): number | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  if (value.endsWith("rem")) {
    return n * rootFontPx;
  }
  if (value.endsWith("px")) {
    return n;
  }
  return null;
}

export function clampPaneWidth(value: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.min(hi, Math.max(lo, Math.round(value)));
}

export function readCssPx(token: string, fallback: number): number {
  if (typeof document === "undefined") {
    return fallback;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token);
  const root = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  const parsed = parseCssLength(raw, Number.isFinite(root) ? root : 16);
  return parsed === null ? fallback : parsed;
}

export function readStoredPaneWidth(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const safeFallback = clampPaneWidth(fallback, min, max);
  if (typeof localStorage === "undefined") {
    return safeFallback;
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return safeFallback;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return safeFallback;
    }
    return clampPaneWidth(n, min, max);
  } catch {
    return safeFallback;
  }
}

export function writeStoredPaneWidth(key: string, width: number): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(key, String(Math.round(width)));
  } catch {
    // private mode / disabled storage
  }
}

export function resolvePaneBounds(spec: PaneWidthSpec): ResolvedPaneBounds {
  const min = Math.round(readCssPx(spec.minToken, spec.minPx));
  const max = Math.round(readCssPx(spec.maxToken, spec.maxPx));
  const fallback = readCssPx(spec.defaultToken, spec.defaultPx);
  return {
    min,
    max,
    fallback: clampPaneWidth(fallback, min, max),
    width: readStoredPaneWidth(spec.storageKey, fallback, min, max),
  };
}
