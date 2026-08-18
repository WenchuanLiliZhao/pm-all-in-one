import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getPm } from "@/lib/bridge";
import { useWorkspace } from "@/lib/workspace/workspace-context";
import type { WikiSnapshot } from "@/lib/types";

type WikiContextValue = {
  wiki: WikiSnapshot | null;
  error: string | null;
  refresh: () => Promise<void>;
  setWiki: (snap: WikiSnapshot) => void;
};

const WikiContext = createContext<WikiContextValue | null>(null);

export function WikiProvider({ children }: { children: ReactNode }) {
  const { root } = useWorkspace();
  const [wiki, setWikiState] = useState<WikiSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getPm().getWiki();
      setWikiState(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const setWiki = useCallback((snap: WikiSnapshot) => {
    setWikiState(snap);
    setError(null);
  }, []);

  useEffect(() => {
    setWikiState(null);
    void refresh();
    return getPm().onChanged(() => {
      void refresh();
    });
  }, [refresh, root]);

  const value = useMemo(
    () => ({ wiki, error, refresh, setWiki }),
    [wiki, error, refresh, setWiki],
  );

  return (
    <WikiContext.Provider value={value}>{children}</WikiContext.Provider>
  );
}

export function useWiki(): WikiContextValue {
  const ctx = useContext(WikiContext);
  if (!ctx) {
    throw new Error("useWiki must be used within WikiProvider");
  }
  return ctx;
}
