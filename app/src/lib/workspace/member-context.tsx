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
import type { CreateMemberInput, Member, MemberSnapshot } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-context";

type MemberContextValue = {
  members: MemberSnapshot | null;
  error: string | null;
  refresh: () => Promise<void>;
  setMembers: (snap: MemberSnapshot) => void;
  createMember: (input?: CreateMemberInput) => Promise<Member>;
  /** Machine-local `.pm/local.json` `me` (signing identity; not auth). */
  localMe: string | null;
  localMeError: string | null;
  refreshLocalMe: () => Promise<void>;
  setLocalMe: (memberId: string | null) => Promise<void>;
};

const MemberContext = createContext<MemberContextValue | null>(null);

export function MemberProvider({ children }: { children: ReactNode }) {
  const { root } = useWorkspace();
  const [members, setMembersState] = useState<MemberSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localMe, setLocalMeState] = useState<string | null>(null);
  const [localMeError, setLocalMeError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getPm().getMembers();
      setMembersState(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const refreshLocalMe = useCallback(async () => {
    try {
      const cfg = await getPm().getLocalConfig();
      setLocalMeState(cfg.me ?? null);
      setLocalMeError(null);
    } catch (e) {
      setLocalMeError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const setLocalMe = useCallback(async (memberId: string | null) => {
    try {
      const cfg = await getPm().setLocalMe(memberId);
      setLocalMeState(cfg.me ?? null);
      setLocalMeError(null);
    } catch (e) {
      setLocalMeError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, []);

  const setMembers = useCallback((snap: MemberSnapshot) => {
    setMembersState(snap);
    setError(null);
  }, []);

  const createMember = useCallback(
    async (input?: CreateMemberInput) => {
      const created = await getPm().createMember(input);
      await refresh();
      return created;
    },
    [refresh],
  );

  useEffect(() => {
    setMembersState(null);
    setLocalMeState(null);
    void refresh();
    void refreshLocalMe();
    return getPm().onChanged(() => {
      void refresh();
      void refreshLocalMe();
    });
  }, [refresh, refreshLocalMe, root]);

  const value = useMemo(
    () => ({
      members,
      error,
      refresh,
      setMembers,
      createMember,
      localMe,
      localMeError,
      refreshLocalMe,
      setLocalMe,
    }),
    [
      members,
      error,
      refresh,
      setMembers,
      createMember,
      localMe,
      localMeError,
      refreshLocalMe,
      setLocalMe,
    ],
  );

  return (
    <MemberContext.Provider value={value}>{children}</MemberContext.Provider>
  );
}

export function useMember(): MemberContextValue {
  const ctx = useContext(MemberContext);
  if (!ctx) {
    throw new Error("useMember must be used within MemberProvider");
  }
  return ctx;
}
