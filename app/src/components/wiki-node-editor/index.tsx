/**
 * Wiki node editor — AutosaveDoc via local DetailSaveController.
 *
 * ↔ lib/workspace/detail-save.ts — controller + wiki target
 * ↔ lib/workspace/active-save-host.ts — Cmd+S
 * ↔ lib/workspace/use-autosave-leave-flush.ts — flush-then-leave
 * ↔ dogfood @wiki-n8_7zg25NlxwdV6nIBVcD — AutosaveDoc
 * ↔ electron/core/wiki.ts — updateWikiNode OCC
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DetailConflictBanner } from "@/components/detail-conflict-banner";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import {
  BorderlessTitle,
  DocEditShell,
  SaveStatusIndicator,
} from "@/components/doc-edit-shell";
import { CopyAiLocatorButton } from "@/components/copy-ai-locator-button";
import { MemberPerson } from "@/components/member-person";
import { NodeAssetsSection } from "@/components/node-assets-section";
import { TypeConfirmDialog } from "@/components/type-confirm-dialog";
import { Button } from "@/components/ui/button";
import { getPm } from "@/lib/bridge";
import type { WikiNode, WikiNodeMeta, Issue } from "@/lib/types";
import { usePmMentions } from "@/lib/markdown/use-pm-mentions";
import type { Selection } from "@/lib/workspace/workspace-context";
import { useWiki } from "@/lib/workspace/wiki-context";
import { useActiveSaveHost } from "@/lib/workspace/use-active-save-host";
import { useAutosaveLeaveFlush } from "@/lib/workspace/use-autosave-leave-flush";
import {
  DetailSaveController,
  type DetailSaveStatus,
} from "@/lib/workspace/detail-save";
import {
  classifyWiki,
  pickWikiEditable,
  type WikiEditableSlice,
} from "@pm-core/detail-diff";
import styles from "./styles.module.scss";

type Props = {
  wikiNodeId: string;
  issues: Issue[];
  wikiNodes: WikiNodeMeta[];
  onNavigateIssue: (sel: Selection) => void;
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

export function WikiNodeEditor({
  wikiNodeId,
  issues,
  wikiNodes,
  onNavigateIssue,
}: Props) {
  const navigate = useNavigate();
  const { setWiki } = useWiki();
  const [page, setPage] = useState<WikiNode | null>(null);
  const [draft, setDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [status, setStatus] = useState<DetailSaveStatus>("clean");
  const [error, setError] = useState<string | null>(null);
  const [conflictPaths, setConflictPaths] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    detail: string[];
  } | null>(null);

  const draftRef = useRef({ title: "", description: "", body: "" });
  const baselineRef = useRef<WikiEditableSlice | null>(null);
  const bodyEditorRef = useRef<MarkdownEditorHandle>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const ctrlRef = useRef<DetailSaveController | null>(null);

  draftRef.current = { title: titleDraft, description: descriptionDraft, body: draft };

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
        if (target.kind !== "wiki") {
          return;
        }
        const { title, description, body } = draftRef.current;
        if (!title.trim()) {
          throw new Error("Wiki-node title is required.");
        }
        const expected = baselineRef.current ?? undefined;
        const titleFocused = isTitleInputFocused();
        const saved = await getPm().updateWikiNode(
          target.wikiNodeId,
          { title: title.trim(), description, body },
          expected ? { expected } : undefined,
        );
        setPage(saved);
        setDraft(saved.body);
        setDescriptionDraft(saved.description);
        if (!titleFocused) {
          setTitleDraft(saved.title);
        } else {
          draftRef.current = { title, description: saved.description, body: saved.body };
        }
        baselineRef.current = pickWikiEditable(saved);
      },
    });
  }
  const ctrl = ctrlRef.current;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await getPm().getWikiNode(wikiNodeId);
        if (cancelled) {
          return;
        }
        setPage(next);
        setDraft(next.body);
        setTitleDraft(next.title);
        setDescriptionDraft(next.description);
        draftRef.current = { title: next.title, description: next.description, body: next.body };
        baselineRef.current = pickWikiEditable(next);
        ctrl.resetClean();
        setConflictPaths([]);
        setError(null);
        ctrl.setContentDirty(
          { kind: "wiki", wikiNodeId },
          false,
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setPage(null);
        }
      }
    })();
    return () => {
      cancelled = true;
      void ctrl.flush();
    };
  }, [wikiNodeId, ctrl]);

  useEffect(() => {
    return getPm().onChanged(() => {
      void (async () => {
        try {
          const next = await getPm().getWikiNode(wikiNodeId);
          const baseline = baselineRef.current ?? pickWikiEditable(next);
          const draftSlice: WikiEditableSlice = {
            title: draftRef.current.title,
            description: draftRef.current.description,
            body: draftRef.current.body,
          };
          const disk = pickWikiEditable(next);
          const result = classifyWiki(baseline, draftSlice, disk);
          setPage(next);
          setDraft(result.mergedDraft.body);
          setTitleDraft(result.mergedDraft.title);
          setDescriptionDraft(result.mergedDraft.description);
          draftRef.current = {
            title: result.mergedDraft.title,
            description: result.mergedDraft.description,
            body: result.mergedDraft.body,
          };
          baselineRef.current = result.nextBaseline;
          ctrl.applySyncState(
            { kind: "wiki", wikiNodeId },
            result.hasLocalEdits,
            result.conflictPaths,
          );
          setError(null);
        } catch {
          // Node deleted externally or mid-write — ignore transient errors.
        }
      })();
    });
  }, [wikiNodeId, ctrl]);

  const markDirty = useCallback(
    (title: string, description: string, body: string) => {
      const base = baselineRef.current;
      if (!base) {
        return;
      }
      const dirty =
        titleDirty(title, base.title) ||
        description !== base.description ||
        body !== base.body;
      ctrl.setContentDirty({ kind: "wiki", wikiNodeId }, dirty);
    },
    [ctrl, wikiNodeId],
  );

  const save = useCallback(async (): Promise<boolean> => {
    return ctrl.save();
  }, [ctrl]);

  const flush = useCallback(async (): Promise<boolean> => {
    return ctrl.flush();
  }, [ctrl]);

  const hasUnsaved = useCallback(() => ctrl.hasUnsavedWork(), [ctrl]);

  useActiveSaveHost({
    save,
    hasUnsaved,
  });
  useAutosaveLeaveFlush({
    when: status === "dirty" || status === "saving" || status === "conflict" || status === "error",
    flush,
  });

  const navigateIssue = useCallback(
    (p: string, i: string) =>
      onNavigateIssue({ kind: "issue", projectId: p, issueId: i }),
    [onNavigateIssue],
  );
  const { plugins, mentionAutocomplete } = usePmMentions({
    issues,
    wikiNodes,
    onNavigateIssue: navigateIssue,
  });

  const resolveConflictReload = async () => {
    try {
      const next = await getPm().getWikiNode(wikiNodeId);
      setPage(next);
      setDraft(next.body);
      setTitleDraft(next.title);
      setDescriptionDraft(next.description);
      draftRef.current = { title: next.title, description: next.description, body: next.body };
      baselineRef.current = pickWikiEditable(next);
      ctrl.resetClean();
      setConflictPaths([]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const resolveConflictKeep = async () => {
    try {
      const next = await getPm().getWikiNode(wikiNodeId);
      baselineRef.current = pickWikiEditable(next);
      const dirty =
        titleDirty(titleDraft, next.title) ||
        descriptionDraft !== next.description ||
        draft !== next.body;
      ctrl.applySyncState(
        { kind: "wiki", wikiNodeId },
        dirty,
        [],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (error && !page) {
    return (
      <div className={styles.root}>
        <h1>Wiki-node not found</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className={styles.root}>
        <p>Loading…</p>
      </div>
    );
  }

  const onDelete = () => {
    const detailParts = [
      "This cannot be undone.",
      "It will also be removed from Contents (nested Contents items are promoted).",
    ];
    if (ctrl.hasUnsavedWork()) {
      detailParts.push("Unsaved edits will be discarded.");
    }
    setPendingDelete({ id: page.id, detail: detailParts });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    const { id } = pendingDelete;
    setPendingDelete(null);
    try {
      ctrl.resetClean();
      await getPm().deleteWikiNode(id, { removeFile: true });
      setWiki(await getPm().getWiki());
      navigate("/w/wiki");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
    <DocEditShell
      className={styles.root}
      header={
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.slug}>wiki/{page.id}/</span>
            <SaveStatusIndicator
              status={status}
              onRetry={() => void save()}
            />
          </div>
          <div className={styles.headerActions}>
            <CopyAiLocatorButton
              locator={{
                kind: "wiki",
                wikiNodeId: page.id,
              }}
            />
            <Button
              type="button"
              variant="outlined"
              colors={{
                fg: "var(--color-use--danger)",
                border: "var(--color-use--danger-border)",
                hoverBg: "var(--color-use--danger-soft)",
              }}
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      }
      conflictBanner={
        <DetailConflictBanner
          conflictPaths={conflictPaths}
          onReload={() => void resolveConflictReload()}
          onKeep={() => void resolveConflictKeep()}
        />
      }
      title={
        <BorderlessTitle
          ref={titleInputRef}
          value={titleDraft}
          onChange={(next) => {
            setTitleDraft(next);
            draftRef.current = { title: next, description: descriptionDraft, body: draft };
            markDirty(next, descriptionDraft, draft);
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
        <>
        <label className={styles.descriptionField}>
          <span>Description</span>
          <input
            className={styles.descriptionInput}
            aria-label="Description"
            value={descriptionDraft}
            disabled={status === "saving"}
            placeholder="Short blurb (may be empty)"
            onChange={(e) => {
              const next = e.target.value;
              setDescriptionDraft(next);
              draftRef.current = {
                title: titleDraft,
                description: next,
                body: draft,
              };
              markDirty(titleDraft, next, draft);
            }}
            onBlur={() => {
              void flush();
            }}
          />
        </label>
        <div className={styles.meta}>
          <span className={styles.metaPerson}>
            Created by{" "}
            <MemberPerson
              memberId={page.createdBy}
              appearance="card"
              size="sm"
              showName
              emptyLabel="—"
            />
          </span>
          <span>Created {page.created}</span>
          <span>Updated {page.updated}</span>
        </div>
        </>
      }
      body={
        <MarkdownEditor
          variant="borderless"
          editorRef={bodyEditorRef}
          value={draft}
          onChange={(body) => {
            setDraft(body);
            draftRef.current = { title: titleDraft, description: descriptionDraft, body };
            markDirty(titleDraft, descriptionDraft, body);
          }}
          onBlur={() => {
            void flush();
          }}
          plugins={plugins}
          mentionAutocomplete={mentionAutocomplete}
          placeholder="Markdown… type @ to link an issue or wiki-node"
          rows={16}
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
        <NodeAssetsSection
          nodeRef={{ kind: "wiki", wikiNodeId: page.id }}
        />
      }
    />
    <TypeConfirmDialog
      open={pendingDelete !== null}
      title="Delete wiki page?"
      lead={
        <>
          Delete disk directory <code>wiki/{pendingDelete?.id}/</code>{" "}
          permanently?
        </>
      }
      detail={pendingDelete?.detail}
      onCancel={() => setPendingDelete(null)}
      onConfirm={() => void confirmDelete()}
    />
    </>
  );
}
