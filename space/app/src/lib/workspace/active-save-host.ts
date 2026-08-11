/**
 * Single active save host for Cmd/Ctrl+S dispatch.
 *
 * AutosaveDoc hosts register DetailSaveController save; ExplicitForm hosts
 * register their local save. Only one host is current (last register wins;
 * unregister restores previous if stacked, or clears).
 *
 * ↔ space/handoff/save-leave-contracts.md — AutosaveDoc vs ExplicitForm
 * ↔ space/app/src/lib/workspace/detail-save.ts — AutosaveDoc controller
 * ↔ space/app/src/pages/channels/workspace-page/route.tsx — Cmd+S listener
 */

export type ActiveSaveHost = {
  /** Explicit save / flush (Save button / Cmd+S). */
  save: () => boolean | Promise<boolean>;
  /** True when local edits are not confirmed on disk. */
  hasUnsaved: () => boolean;
  /**
   * ExplicitForm / interim manual docs: prompt on tab close.
   * AutosaveDoc uses workspace-context flush beforeunload instead.
   */
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
