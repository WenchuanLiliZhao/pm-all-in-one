/**
 * AutosaveDoc leave: flush then proceed; stay when flush cannot complete.
 *
 * ↔ dogfood @wiki-n8_7zg25NlxwdV6nIBVcD — AutosaveDoc leave
 * ↔ app/src/lib/workspace/detail-save.ts — flush()
 */
import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";

type Options = {
  when: boolean;
  flush: () => Promise<boolean>;
};

export function useAutosaveLeaveFlush({ when, flush }: Options): void {
  const blocker = useBlocker(when);
  const flushRef = useRef(flush);
  flushRef.current = flush;
  const runningRef = useRef(false);

  useEffect(() => {
    if (blocker.state !== "blocked" || runningRef.current) {
      return;
    }
    runningRef.current = true;
    void (async () => {
      try {
        const ok = await flushRef.current();
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
}
