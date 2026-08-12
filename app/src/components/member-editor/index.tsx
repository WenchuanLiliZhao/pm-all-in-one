/**
 * Member detail editor — ExplicitDoc via local DetailSaveController.
 *
 * ↔ pages/channels/workspace-page/route.tsx — `MemberDetailView`
 * ↔ lib/workspace/member-context.tsx — snapshot refresh
 * ↔ lib/workspace/detail-save.ts — controller + member target
 * ↔ lib/workspace/active-save-host.ts — Cmd+S
 * ↔ lib/workspace/use-unsaved-leave-guard.ts — Save/Discard/Cancel leave
 * ↔ dogfood @wiki-n8_7zg25NlxwdV6nIBVcD — ExplicitDoc
 * ↔ electron/core/domain/members.ts — updateMember OCC
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import {
  BorderlessTitle,
  DocEditNav,
  DocEditShell,
  LocatorCopyText,
} from "@/components/doc-edit-shell";
import { DetailConflictBanner } from "@/components/detail-conflict-banner";
import {
  MemberPerson,
  invalidateMemberAvatarCache,
} from "@/components/member-person";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Lucide } from "@/components/ui/lucide";
import { getPm } from "@/lib/bridge";
import { usePmMentions } from "@/lib/markdown/use-pm-mentions";
import type { Member, Membership, WikiNodeMeta } from "@/lib/types";
import {
  useWorkspace,
  type Selection,
} from "@/lib/workspace/workspace-context";
import { useMember } from "@/lib/workspace/member-context";
import { useActiveSaveHost } from "@/lib/workspace/use-active-save-host";
import { useUnsavedLeaveGuard } from "@/lib/workspace/use-unsaved-leave-guard";
import {
  DetailSaveController,
  type DetailSaveStatus,
} from "@/lib/workspace/detail-save";
import {
  classifyMember,
  pickMemberEditable,
  type MemberEditableSlice,
} from "@pm-core/sync/detail-diff";
import styles from "./styles.module.scss";

type MemberOutletContext = {
  openSelection: (sel: Selection) => void;
  wikiNodes: WikiNodeMeta[];
};

type Props = {
  memberId: string;
};

function titleDirty(draft: string, baseline: string): boolean {
  return draft.trim() !== baseline.trim();
}

function isTitleInputFocused(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const el = document.activeElement;
  return (
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
    el.getAttribute("aria-label") === "Title"
  );
}

export function MemberEditor({ memberId }: Props) {
  const { refresh } = useMember();
  const { issues } = useWorkspace();
  const { openSelection, wikiNodes } = useOutletContext<MemberOutletContext>();
  const navigateIssue = useCallback(
    (p: string, i: string) =>
      openSelection({ kind: "issue", projectId: p, issueId: i }),
    [openSelection],
  );
  const { plugins, mentionAutocomplete } = usePmMentions({
    issues,
    wikiNodes,
    onNavigateIssue: navigateIssue,
  });
  const [member, setMember] = useState<Member | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [membershipDraft, setMembershipDraft] =
    useState<Membership>("involved");
  const [status, setStatus] = useState<DetailSaveStatus>("clean");
  const [error, setError] = useState<string | null>(null);
  const [conflictPaths, setConflictPaths] = useState<string[]>([]);

  const draftRef = useRef({
    title: "",
    body: "",
    membership: "involved" as Membership,
  });
  const baselineRef = useRef<MemberEditableSlice | null>(null);
  const bodyEditorRef = useRef<MarkdownEditorHandle>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const ctrlRef = useRef<DetailSaveController | null>(null);

  draftRef.current = {
    title: titleDraft,
    body: bodyDraft,
    membership: membershipDraft,
  };

  if (ctrlRef.current === null) {
    ctrlRef.current = new DetailSaveController({
      onStatus: (next, errorMessage, paths) => {
        setStatus(next);
        setConflictPaths(paths);
        if (errorMessage && next === "error") {
          setError(errorMessage);
        } else if (next !== "error") {
          setError(null);
        }
      },
      persist: async (target) => {
        if (target.kind !== "member") {
          return;
        }
        const { title, body, membership } = draftRef.current;
        if (!title.trim()) {
          throw new Error("Member title is required.");
        }
        const expected = baselineRef.current ?? undefined;
        const titleFocused = isTitleInputFocused();
        const saved = await getPm().updateMember(
          target.memberId,
          { title: title.trim(), body, membership },
          expected ? { expected } : undefined,
        );
        setMember(saved);
        setBodyDraft(saved.body);
        setMembershipDraft(saved.membership);
        if (!titleFocused) {
          setTitleDraft(saved.title);
        } else {
          draftRef.current = {
            title,
            body: saved.body,
            membership: saved.membership,
          };
        }
        baselineRef.current = pickMemberEditable(saved);
        await refresh();
      },
    });
  }
  const ctrl = ctrlRef.current;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await getPm().getMember(memberId);
        if (cancelled) {
          return;
        }
        setMember(next);
        setTitleDraft(next.title);
        setBodyDraft(next.body);
        setMembershipDraft(next.membership);
        draftRef.current = {
          title: next.title,
          body: next.body,
          membership: next.membership,
        };
        baselineRef.current = pickMemberEditable(next);
        ctrl.resetClean();
        setConflictPaths([]);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setMember(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId, ctrl]);

  useEffect(() => {
    return getPm().onChanged(() => {
      void (async () => {
        try {
          const next = await getPm().getMember(memberId);
          invalidateMemberAvatarCache(memberId);
          const baseline = baselineRef.current ?? pickMemberEditable(next);
          const draftSlice: MemberEditableSlice = {
            title: draftRef.current.title,
            body: draftRef.current.body,
            membership: draftRef.current.membership,
          };
          const disk = pickMemberEditable(next);
          const result = classifyMember(baseline, draftSlice, disk);
          setMember(next);
          setTitleDraft(result.mergedDraft.title);
          setBodyDraft(result.mergedDraft.body);
          setMembershipDraft(result.mergedDraft.membership as Membership);
          draftRef.current = {
            title: result.mergedDraft.title,
            body: result.mergedDraft.body,
            membership: result.mergedDraft.membership as Membership,
          };
          baselineRef.current = result.nextBaseline;
          ctrl.applySyncState(
            { kind: "member", memberId },
            result.hasLocalEdits,
            result.conflictPaths,
          );
          setError(null);
        } catch {
          // Deleted externally — ignore transient errors.
        }
      })();
    });
  }, [memberId, ctrl]);

  const markDirty = useCallback(
    (title: string, body: string, membership: Membership) => {
      const base = baselineRef.current;
      if (!base) {
        return;
      }
      const dirty =
        titleDirty(title, base.title) ||
        body !== base.body ||
        membership !== base.membership;
      ctrl.setContentDirty({ kind: "member", memberId }, dirty);
    },
    [ctrl, memberId],
  );

  const save = useCallback(async (): Promise<boolean> => {
    return ctrl.save();
  }, [ctrl]);

  const hasUnsaved = useCallback(() => ctrl.hasUnsavedWork(), [ctrl]);

  const discardDraft = useCallback(() => {
    const base = baselineRef.current;
    if (base) {
      setTitleDraft(base.title);
      setBodyDraft(base.body);
      setMembershipDraft(base.membership as Membership);
      draftRef.current = {
        title: base.title,
        body: base.body,
        membership: base.membership as Membership,
      };
    }
    ctrl.resetClean();
    setConflictPaths([]);
    setError(null);
  }, [ctrl]);

  useActiveSaveHost({
    save,
    hasUnsaved,
  });
  useUnsavedLeaveGuard({
    when:
      status === "dirty" ||
      status === "saving" ||
      status === "conflict" ||
      status === "error",
    hasUnsaved,
    save,
    onDiscard: discardDraft,
  });

  const resolveConflictReload = async () => {
    try {
      const next = await getPm().getMember(memberId);
      setMember(next);
      setTitleDraft(next.title);
      setBodyDraft(next.body);
      setMembershipDraft(next.membership);
      draftRef.current = {
        title: next.title,
        body: next.body,
        membership: next.membership,
      };
      baselineRef.current = pickMemberEditable(next);
      ctrl.resetClean();
      setConflictPaths([]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const resolveConflictKeep = async () => {
    try {
      const next = await getPm().getMember(memberId);
      baselineRef.current = pickMemberEditable(next);
      const dirty =
        titleDirty(titleDraft, next.title) ||
        bodyDraft !== next.body ||
        membershipDraft !== next.membership;
      ctrl.applySyncState({ kind: "member", memberId }, dirty, []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (error && !member) {
    return (
      <div className={styles.root}>
        <h1>Member not found</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className={styles.root}>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <DocEditShell
      className={styles.root}
      header={
        <DocEditNav
          left={
            <LocatorCopyText
              locator={{ kind: "member", memberId: member.id }}
            />
          }
          actions={
            <Button
              type="button"
              variant={
                status === "dirty" ||
                status === "conflict" ||
                status === "error"
                  ? "fill-inverse"
                  : "ghost"
              }
              size="small"
              disabled={
                status === "saving" ||
                !(
                  status === "dirty" ||
                  status === "conflict" ||
                  status === "error"
                )
              }
              startIcon={<Lucide.Save aria-hidden />}
              aria-label={status === "saving" ? "Saving" : "Save"}
              title={status === "saving" ? "Saving…" : "Save"}
              onClick={() => void save()}
            />
          }
        />
      }
      conflictBanner={
        conflictPaths.length > 0 ? (
          <DetailConflictBanner
            conflictPaths={conflictPaths}
            onReload={() => void resolveConflictReload()}
            onKeep={() => void resolveConflictKeep()}
          />
        ) : null
      }
      title={
        <BorderlessTitle
          ref={titleInputRef}
          value={titleDraft}
          onChange={(next) => {
            setTitleDraft(next);
            draftRef.current = {
              title: next,
              body: bodyDraft,
              membership: membershipDraft,
            };
            markDirty(next, bodyDraft, membershipDraft);
          }}
          onEnter={() => {
            bodyEditorRef.current?.focus({ at: "start" });
          }}
          size="page"
        />
      }
      propsSlot={
        <div className={styles.propsRow}>
          <MemberPerson
            memberId={member.id}
            title={titleDraft || member.title}
            membership={membershipDraft}
            size="md"
            showName={false}
            link={false}
          />
          <div className={styles.fields}>
            <label className={styles.field}>
              <span>Membership</span>
              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button
                    type="button"
                    variant="outlined"
                    size="small"
                    endIcon={<Lucide.ChevronDown />}
                    disabled={status === "saving"}
                    aria-label="Membership"
                  >
                    {membershipDraft}
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="start" side="bottom">
                  {(
                    [
                      { id: "involved", label: "involved" },
                      { id: "left", label: "left" },
                    ] as const
                  ).map((opt) => (
                    <DropdownMenu.ItemButton
                      key={opt.id}
                      label={opt.label}
                      active={membershipDraft === opt.id}
                      onSelect={() => {
                        setMembershipDraft(opt.id);
                        draftRef.current = {
                          title: titleDraft,
                          body: bodyDraft,
                          membership: opt.id,
                        };
                        markDirty(titleDraft, bodyDraft, opt.id);
                      }}
                    />
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu>
            </label>
            <div className={styles.meta}>
              <span>Created {member.created}</span>
              <span>Updated {member.updated}</span>
            </div>
          </div>
        </div>
      }
      body={
        <MarkdownEditor
          variant="borderless"
          editorRef={bodyEditorRef}
          value={bodyDraft}
          onChange={(body) => {
            setBodyDraft(body);
            draftRef.current = {
              title: titleDraft,
              body,
              membership: membershipDraft,
            };
            markDirty(titleDraft, body, membershipDraft);
          }}
          plugins={plugins}
          mentionAutocomplete={mentionAutocomplete}
          placeholder="Member README… type @ to link issue / wiki / member / handoff"
          rows={12}
          onNavigateOutAtStart={() => {
            const el = titleInputRef.current;
            if (!el) {
              return;
            }
            el.focus();
            const len = el.value.length;
            el.setSelectionRange(len, len);
          }}
        />
      }
    />
  );
}
