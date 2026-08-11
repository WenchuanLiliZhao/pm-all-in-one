import { useCallback, useEffect, useMemo, useState } from "react";
import { applyViewOrder } from "@pm-core/view-order-apply";
import type { ViewOrder } from "@pm-core/view-order-apply";
import { getPm } from "@/lib/bridge";
import type { IssueTree } from "@/lib/types";

export function useViewOrderedTree(viewKey: string, tree: IssueTree | null) {
  const [order, setOrder] = useState<ViewOrder>({ roots: [], children: {} });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getPm().getViewOrder(viewKey);
      setOrder(next);
    } catch {
      setOrder({ roots: [], children: {} });
    } finally {
      setLoading(false);
    }
  }, [viewKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const orderedTree = useMemo(() => {
    if (!tree) {
      return null;
    }
    return applyViewOrder(tree, order);
  }, [tree, order]);

  const persistOrder = useCallback(
    async (next: ViewOrder) => {
      setOrder(next);
      await getPm().setViewOrder(viewKey, next);
    },
    [viewKey],
  );

  return { orderedTree, order, persistOrder, reload, loading };
}
