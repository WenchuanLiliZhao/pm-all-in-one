/**
 * Explicit-save leave guard: Save / Discard / Cancel via confirmUnsavedLeave.
 *
 * ↔ dogfood @wiki-n8_7zg25NlxwdV6nIBVcD — ExplicitDoc leave
 * ↔ src/lib/workspace/unsaved-leave.ts — resolveUnsavedLeave
 * ↔ src/lib/bridge/pm-api.ts — confirmUnsavedLeave
 */
import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import {
  resolveUnsavedLeave,
  type ResolveUnsavedLeaveOpts,
} from "@/lib/workspace/unsaved-leave";

type Options = {
  /** Coarse React dirty flag — arms the blocker when true. */
  when: boolean;
  /**
   * Sync unsaved check (controller.hasUnsavedWork). Preferred on navigate so
   * discard/save that already cleared the controller do not double-prompt.
   */
  hasUnsaved?: () => boolean;
  save: () => Promise<boolean>;
  onDiscard?: () => void;
  title?: string;
  message?: string;
  detail?: string;
};

export function useUnsavedLeaveGuard({
  when,
  hasUnsaved,
  save,
  onDiscard,
  title,
  message,
  detail,
}: Options): void {
  const optsRef = useRef<ResolveUnsavedLeaveOpts>({
    save,
    onDiscard,
    title,
    message,
    detail,
  });
  optsRef.current = { save, onDiscard, title, message, detail };
  const hasUnsavedRef = useRef(hasUnsaved);
  hasUnsavedRef.current = hasUnsaved;
  const whenRef = useRef(when);
  whenRef.current = when;
  const runningRef = useRef(false);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (
      currentLocation.pathname === nextLocation.pathname &&
      currentLocation.search === nextLocation.search &&
      currentLocation.hash === nextLocation.hash
    ) {
      return false;
    }
    if (!whenRef.current) {
      return false;
    }
    if (hasUnsavedRef.current) {
      return hasUnsavedRef.current();
    }
    return true;
  });

  useEffect(() => {
    if (blocker.state !== "blocked" || runningRef.current) {
      return;
    }
    runningRef.current = true;
    void (async () => {
      try {
        const ok = await resolveUnsavedLeave(optsRef.current);
        if (ok) {
          blocker.proceed();
        } else {
          blocker.reset();
        }
      } catch {
        blocker.reset();
      } finally {
        runningRef.current = false;
      }
    })();
  }, [blocker]);

  useEffect(() => {
    if (!when) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (hasUnsavedRef.current && !hasUnsavedRef.current()) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);
}
