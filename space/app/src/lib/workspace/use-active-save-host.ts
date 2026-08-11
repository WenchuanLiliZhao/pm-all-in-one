/**
 * Register the current surface as the Cmd+S / leave save host.
 *
 * ↔ space/app/src/lib/workspace/active-save-host.ts
 */
import { useEffect } from "react";
import {
  registerActiveSaveHost,
  type ActiveSaveHost,
} from "@/lib/workspace/active-save-host";

export function useActiveSaveHost(host: ActiveSaveHost | null): void {
  const save = host?.save;
  const hasUnsaved = host?.hasUnsaved;
  const promptBeforeUnload = host?.promptBeforeUnload;

  useEffect(() => {
    if (!save || !hasUnsaved) {
      return;
    }
    return registerActiveSaveHost({
      save,
      hasUnsaved,
      promptBeforeUnload,
    });
  }, [save, hasUnsaved, promptBeforeUnload]);
}
