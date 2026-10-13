/**
 * Persisted pane width. Kept out of `index.tsx` so the handle module
 * exports only a component and Vite can fast-refresh it.
 *
 * ↔ pane-width.ts
 * ↔ index.tsx
 */
import { useCallback, useRef, useState } from "react";
import {
  clampPaneWidth,
  resolvePaneBounds,
  writeStoredPaneWidth,
  type PaneWidthSpec,
} from "./pane-width";

export type PaneWidthController = {
  width: number;
  min: number;
  max: number;
  fallback: number;
  setWidth: (next: number) => number;
  persist: () => void;
  reset: () => void;
};

export function usePaneWidth(spec: PaneWidthSpec): PaneWidthController {
  const [model, setModel] = useState(() => resolvePaneBounds(spec));
  const widthRef = useRef(model.width);
  const limitsRef = useRef({
    min: model.min,
    max: model.max,
    fallback: model.fallback,
  });

  const setWidth = useCallback((next: number) => {
    const { min, max } = limitsRef.current;
    const clamped = clampPaneWidth(next, min, max);
    widthRef.current = clamped;
    setModel((current) =>
      current.width === clamped ? current : { ...current, width: clamped },
    );
    return clamped;
  }, []);

  const persist = useCallback(() => {
    writeStoredPaneWidth(spec.storageKey, widthRef.current);
  }, [spec.storageKey]);

  const reset = useCallback(() => {
    const next = clampPaneWidth(
      limitsRef.current.fallback,
      limitsRef.current.min,
      limitsRef.current.max,
    );
    widthRef.current = next;
    setModel((current) =>
      current.width === next ? current : { ...current, width: next },
    );
    writeStoredPaneWidth(spec.storageKey, next);
  }, [spec.storageKey]);

  return {
    width: model.width,
    min: model.min,
    max: model.max,
    fallback: model.fallback,
    setWidth,
    persist,
    reset,
  };
}
