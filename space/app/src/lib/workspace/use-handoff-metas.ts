/**
 * Lightweight handoff meta list for @ mention autocomplete / chips.
 * Not a full provider — collaboration cards keep their own snapshot.
 */
import { useCallback, useEffect, useState } from "react";
import { getPm } from "@/lib/bridge";
import type { HandoffMeta } from "@/lib/types";

export function useHandoffMetas(): HandoffMeta[] {
  const [nodes, setNodes] = useState<HandoffMeta[]>([]);

  const refresh = useCallback(async () => {
    try {
      const snap = await getPm().getHandoffs();
      setNodes(snap.nodes);
    } catch {
      setNodes([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return nodes;
}
