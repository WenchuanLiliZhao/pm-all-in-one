/**
 * Handoff detail editor — AutosaveDoc via local DetailSaveController.
 *
 * ↔ pages/channels/workspace-page/route.tsx — `HandoffDetailView`
 * ↔ lib/workspace/detail-save.ts — controller + handoff target
 * ↔ space/handoff/save-leave-contracts.md — AutosaveDoc
 * ↔ electron/core/handoffs.ts — updateHandoff OCC
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import {
  BorderlessTitle,
  DocEditShell,
  SaveStatusIndicator,
} from "@/components/doc-edit-shell";
import { DetailConflictBanner } from "@/components/detail-conflict-banner";
import { MemberPerson, MemberPersonSelect } from "@/components/member-person";
import { getPm } from "@/lib/bridge";
import { usePmMentions } from "@/lib/markdown/use-pm-mentions";
import type { Handoff, WikiNodeMeta } from "@/lib/types";
import { useMember } from "@/lib/workspace/member-context";
import {
  useWorkspace,
  type Selection,
} from "@/lib/workspace/workspace-context";
import { useActiveSaveHost } from "@/lib/workspace/use-active-save-host";
import { useAutosaveLeaveFlush } from "@/lib/workspace/use-autosave-leave-flush";
import {
  DetailSaveController,
  type DetailSaveStatus,
} from "@/lib/workspace/detail-save";
import {
  classifyHandoff,
  pickHandoffEditable,
  type HandoffEditableSlice,
} from "@pm-core/detail-diff";
import styles from "./styles.module.scss";

type HandoffOutletContext = {
  openSelection: (sel: Selection) => void;
  wikiNodes: WikiNodeMeta[];
};

type Props = {
  handoffId: string;
};

type Draft = {
  title: string;
  description: string;
  relatedProject: string;
  open: boolean;
  body: string;
  from: string;
  to: string;
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

function isDraftDirty(draft: Draft, base: HandoffEditableSlice): boolean {
  return (
    titleDirty(draft.title, base.title) ||
    draft.description !== base.description ||
    draft.relatedProject !== base.relatedProject ||
    draft.open !== base.open ||
    draft.body !== base.body ||
    draft.from !== base.from ||
    draft.to !== base.to
  );
}

export function HandoffEditor({ handoffId }: Props) {
  const { members } = useMember();
  const { projects, issues } = useWorkspace();
  const { openSelection, wikiNodes } = useOutletContext<HandoffOutletContext>();
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
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [relatedProjectDraft, setRelatedProjectDraft] = useState("");
  const [openDraft, setOpenDraft] = useState(true);
  const [bodyDraft, setBodyDraft] = useState("");
  const [fromDraft, setFromDraft] = useState("");
  const [toDraft, setToDraft] = useState("");
  const [status, setStatus] = useState<DetailSaveStatus>("clean");
  const [error, setError] = useState<string | null>(null);
  const [conflictPaths, setConflictPaths] = useState<string[]>([]);

  const draftRef = useRef<Draft>({
    title: "",
    description: "",
    relatedProject: "",
    open: true,
    body: "",
    from: "",
    to: "",
  });
  const baselineRef = useRef<HandoffEditableSlice | null>(null);
  const bodyEditorRef = useRef<MarkdownEditorHandle>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const ctrlRef = useRef<DetailSaveController | null>(null);

  draftRef.current = {
    title: titleDraft,
    description: descriptionDraft,
    relatedProject: relatedProjectDraft,
    open: openDraft,
    body: bodyDraft,
    from: fromDraft,
    to: toDraft,
  };

  const involved = useMemo(
    () => (members?.nodes ?? []).filter((m) => m.membership === "involved"),
    [members?.nodes],
  );

  if (ctrlRef.current === null) {
    ctrlRef.current = new DetailSaveController({
      getTitleIsBlank: () => !draftRef.current.title.trim(),
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
        if (target.kind !== "handoff") {
          return;
        }
        const {
          title,
          description,
          relatedProject,
          open,
          body,
          from,
          to,
        } = draftRef.current;
        if (!title.trim()) {
          throw new Error("Handoff title is required.");
        }
        if (!from || !to) {
          throw new Error("Handoff from and to are required.");
        }
        if (!relatedProject) {
          throw new Error("Handoff related project is required.");
        }
        const expected = baselineRef.current ?? undefined;
        const titleFocused = isTitleInputFocused();
        const saved = await getPm().updateHandoff(
          target.handoffId,
          {
            title: title.trim(),
            description,
            relatedProject,
            open,
            body,
            from,
            to,
          },
          expected ? { expected } : undefined,
        );
        setHandoff(saved);
        setBodyDraft(saved.body);
        setDescriptionDraft(saved.description);
        setRelatedProjectDraft(saved.relatedProject);
        setOpenDraft(saved.open);
        setFromDraft(saved.from);
        setToDraft(saved.to);
        if (!titleFocused) {
          setTitleDraft(saved.title);
        } else {
          draftRef.current = {
            title,
            description: saved.description,
            relatedProject: saved.relatedProject,
            open: saved.open,
            body: saved.body,
            from: saved.from,
            to: saved.to,
          };
        }
        baselineRef.current = pickHandoffEditable(saved);
      },
    });
  }
  const ctrl = ctrlRef.current;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await getPm().getHandoff(handoffId);
        if (cancelled) {
          return;
        }
        setHandoff(next);
        setTitleDraft(next.title);
        setDescriptionDraft(next.description);
        setRelatedProjectDraft(next.relatedProject);
        setOpenDraft(next.open);
        setBodyDraft(next.body);
        setFromDraft(next.from);
        setToDraft(next.to);
        draftRef.current = {
          title: next.title,
          description: next.description,
          relatedProject: next.relatedProject,
          open: next.open,
          body: next.body,
          from: next.from,
          to: next.to,
        };
        baselineRef.current = pickHandoffEditable(next);
        ctrl.resetClean();
        setConflictPaths([]);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setHandoff(null);
        }
      }
    })();
    return () => {
      cancelled = true;
      void ctrl.flush();
    };
  }, [handoffId, ctrl]);

  useEffect(() => {
    return getPm().onChanged(() => {
      void (async () => {
        try {
          const next = await getPm().getHandoff(handoffId);
          const baseline = baselineRef.current ?? pickHandoffEditable(next);
          const draftSlice: HandoffEditableSlice = { ...draftRef.current };
          const disk = pickHandoffEditable(next);
          const result = classifyHandoff(baseline, draftSlice, disk);
          setHandoff(next);
          setTitleDraft(result.mergedDraft.title);
          setDescriptionDraft(result.mergedDraft.description);
          setRelatedProjectDraft(result.mergedDraft.relatedProject);
          setOpenDraft(result.mergedDraft.open);
          setBodyDraft(result.mergedDraft.body);
          setFromDraft(result.mergedDraft.from);
          setToDraft(result.mergedDraft.to);
          draftRef.current = { ...result.mergedDraft };
          baselineRef.current = result.nextBaseline;
          ctrl.applySyncState(
            { kind: "handoff", handoffId },
            result.hasLocalEdits,
            result.conflictPaths,
          );
          setError(null);
        } catch {
          // Deleted externally — ignore.
        }
      })();
    });
  }, [handoffId, ctrl]);

  const markDirty = useCallback(
    (draft: Draft) => {
      const base = baselineRef.current;
      if (!base) {
        return;
      }
      ctrl.setContentDirty(
        { kind: "handoff", handoffId },
        isDraftDirty(draft, base),
      );
    },
    [ctrl, handoffId],
  );

  const save = useCallback(async (): Promise<boolean> => {
    return ctrl.save();
  }, [ctrl]);

  const flush = useCallback(async (): Promise<boolean> => {
    return ctrl.flush();
  }, [ctrl]);

  const hasUnsaved = useCallback(() => ctrl.hasUnsavedWork(), [ctrl]);

  useActiveSaveHost({ save, hasUnsaved });
  useAutosaveLeaveFlush({
    when:
      status === "dirty" ||
      status === "saving" ||
      status === "conflict" ||
      status === "error",
    flush,
  });

  const resolveConflictReload = async () => {
    try {
      const next = await getPm().getHandoff(handoffId);
      setHandoff(next);
      setTitleDraft(next.title);
      setDescriptionDraft(next.description);
      setRelatedProjectDraft(next.relatedProject);
      setOpenDraft(next.open);
      setBodyDraft(next.body);
      setFromDraft(next.from);
      setToDraft(next.to);
      draftRef.current = {
        title: next.title,
        description: next.description,
        relatedProject: next.relatedProject,
        open: next.open,
        body: next.body,
        from: next.from,
        to: next.to,
      };
      baselineRef.current = pickHandoffEditable(next);
      ctrl.resetClean();
      setConflictPaths([]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const resolveConflictKeep = async () => {
    try {
      const next = await getPm().getHandoff(handoffId);
      baselineRef.current = pickHandoffEditable(next);
      ctrl.applySyncState(
        { kind: "handoff", handoffId },
        isDraftDirty(draftRef.current, pickHandoffEditable(next)),
        [],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (error && !handoff) {
    return (
      <div className={styles.root}>
        <h1>Handoff not found</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!handoff) {
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
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.slug}>handoffs/{handoff.id}/</span>
            <SaveStatusIndicator
              status={status}
              onRetry={() => void save()}
            />
          </div>
        </div>
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
            const draft = { ...draftRef.current, title: next };
            draftRef.current = draft;
            markDirty(draft);
          }}
          onBlur={() => {
            void flush();
          }}
          onEnter={() => {
            bodyEditorRef.current?.focus({ at: "start" });
          }}
          size="page"
        />
      }
      propsSlot={
        <div className={styles.propsRow}>
          <label className={styles.field}>
            <span>Description</span>
            <input
              aria-label="Description"
              value={descriptionDraft}
              disabled={status === "saving"}
              placeholder="Short blurb (may be empty)"
              onChange={(e) => {
                const next = e.target.value;
                setDescriptionDraft(next);
                const draft = { ...draftRef.current, description: next };
                draftRef.current = draft;
                markDirty(draft);
              }}
              onBlur={() => {
                void flush();
              }}
            />
          </label>
          <div className={styles.fields}>
            <label className={styles.field}>
              <span>Related project</span>
              <select
                aria-label="Related project"
                value={relatedProjectDraft}
                disabled={status === "saving" || projects.length === 0}
                onChange={(e) => {
                  const id = e.target.value;
                  setRelatedProjectDraft(id);
                  const draft = { ...draftRef.current, relatedProject: id };
                  draftRef.current = draft;
                  markDirty(draft);
                  void flush();
                }}
              >
                {projects.length === 0 ? (
                  <option value={relatedProjectDraft}>
                    {relatedProjectDraft || "No projects"}
                  </option>
                ) : null}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
                {relatedProjectDraft &&
                !projects.some((p) => p.id === relatedProjectDraft) ? (
                  <option value={relatedProjectDraft}>
                    {relatedProjectDraft} (missing)
                  </option>
                ) : null}
              </select>
            </label>
            <label className={styles.field}>
              <span>Status</span>
              <select
                aria-label="Handoff open or closed"
                value={openDraft ? "open" : "closed"}
                disabled={status === "saving"}
                onChange={(e) => {
                  const open = e.target.value === "open";
                  setOpenDraft(open);
                  const draft = { ...draftRef.current, open };
                  draftRef.current = draft;
                  markDirty(draft);
                  void flush();
                }}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>From</span>
              <MemberPersonSelect
                value={fromDraft}
                onChange={(id) => {
                  if (!id) {
                    return;
                  }
                  setFromDraft(id);
                  const draft = { ...draftRef.current, from: id };
                  draftRef.current = draft;
                  markDirty(draft);
                  void flush();
                }}
                options={involved}
                aria-label="Handoff from"
              />
            </label>
            <label className={styles.field}>
              <span>To</span>
              <MemberPersonSelect
                value={toDraft}
                onChange={(id) => {
                  if (!id) {
                    return;
                  }
                  setToDraft(id);
                  const draft = { ...draftRef.current, to: id };
                  draftRef.current = draft;
                  markDirty(draft);
                  void flush();
                }}
                options={involved}
                aria-label="Handoff to"
              />
            </label>
          </div>
          <div className={styles.meta}>
            <span>created {handoff.created}</span>
            <span>updated {handoff.updated}</span>
          </div>
          <div className={styles.peoplePreview}>
            <MemberPerson memberId={fromDraft} showName size="sm" />
            <span aria-hidden>→</span>
            <MemberPerson memberId={toDraft} showName size="sm" />
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
            const draft = { ...draftRef.current, body };
            draftRef.current = draft;
            markDirty(draft);
          }}
          onBlur={() => {
            void flush();
          }}
          plugins={plugins}
          mentionAutocomplete={mentionAutocomplete}
          placeholder="What you finished, what’s next, blockers… type @ to cite issue / wiki / member / handoff"
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
      footer={
        error && status === "error" ? (
          <p className={styles.error}>{error}</p>
        ) : null
      }
    />
  );
}
