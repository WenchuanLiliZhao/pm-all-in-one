/**
 * ExplicitForm / interim manual-doc leave guard: Stay / Discard via confirmDangerous.
 *
 * ↔ dogfood @wiki-n8_7zg25NlxwdV6nIBVcD — ExplicitForm leave
 * ↔ app/src/lib/bridge/pm-api.ts — confirmDangerous
 */
import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { getPm } from "@/lib/bridge";

type Options = {
  when: boolean;
  /** Called when user chooses Discard so local dirty state can reset. */
  onDiscard?: () => void;
  title?: string;
  message?: string;
};

export function useDiscardLeaveGuard({
  when,
  onDiscard,
  title = "Discard unsaved changes?",
  message = "You have unsaved changes. Leave and discard them?",
}: Options): void {
  const blocker = useBlocker(when);
  const onDiscardRef = useRef(onDiscard);
  onDiscardRef.current = onDiscard;
  const confirmingRef = useRef(false);

  const confirmLeave = useCallback(async (): Promise<boolean> => {
    return getPm().confirmDangerous({
      title,
      message,
      detail: "Stay to keep editing, or discard to leave without saving.",
    });
  }, [title, message]);

  useEffect(() => {
    if (blocker.state !== "blocked" || confirmingRef.current) {
      return;
    }
    confirmingRef.current = true;
    void (async () => {
      try {
        const ok = await confirmLeave();
        if (ok) {
          onDiscardRef.current?.();
          blocker.proceed();
        } else {
          blocker.reset();
        }
      } catch {
        blocker.reset();
      } finally {
        confirmingRef.current = false;
      }
    })();
  }, [blocker, confirmLeave]);

  useEffect(() => {
    if (!when) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);
}
