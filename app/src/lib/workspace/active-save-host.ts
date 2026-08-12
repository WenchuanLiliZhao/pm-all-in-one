/**
 * Single active save host for Cmd/Ctrl+S dispatch.
 *
 * ExplicitDoc / ExplicitForm hosts register their save(). Only one host is
 * current (last register wins; unregister restores previous if stacked, or clears).
 *
 * ↔ dogfood @wiki-n8_7zg25NlxwdV6nIBVcD — ExplicitDoc
 * ↔ app/src/lib/workspace/detail-save.ts — ExplicitDoc controller
 * ↔ app/src/pages/channels/workspace-page/route.tsx — Cmd+S listener
 */

export type ActiveSaveHost = {
  /** Explicit save (Save button / Cmd+S / leave-Save). */
  save: () => boolean | Promise<boolean>;
  /** True when local edits are not confirmed on disk. */
  hasUnsaved: () => boolean;
  /** When true, hosts may also arm tab-close prompts (see leave guard). */
  promptBeforeUnload?: boolean;
};

type Entry = ActiveSaveHost;

const stack: Entry[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) {
    l();
  }
}

export function registerActiveSaveHost(host: ActiveSaveHost): () => void {
  stack.push(host);
  notify();
  return () => {
    const i = stack.lastIndexOf(host);
    if (i >= 0) {
      stack.splice(i, 1);
      notify();
    }
  };
}

export function getActiveSaveHost(): ActiveSaveHost | null {
  return stack.length > 0 ? stack[stack.length - 1]! : null;
}

/** Subscribe to host stack changes (for beforeunload wiring). */
export function subscribeActiveSaveHost(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
