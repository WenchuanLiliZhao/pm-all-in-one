import { useCallback, useRef } from "react";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import { BorderlessTitle, DocEditShell } from "@/components/doc-edit-shell";
import type {
  WikiNodeMeta,
  Issue,
  WorkspaceMeta,
  WorkspacePatch,
} from "@/lib/types";
import type {
  DetailSaveStatus,
  Selection,
} from "@/lib/workspace/workspace-context";
import { useActiveSaveHost } from "@/lib/workspace/use-active-save-host";
import { DetailConflictBanner } from "@/components/detail-conflict-banner";
import { NodeAssetsSection } from "@/components/node-assets-section";
import { Button } from "@/components/ui/button";
import { usePmMentions } from "@/lib/markdown/use-pm-mentions";
import styles from "./styles.module.scss";

interface WorkspaceHomeDetailProps {
  meta: WorkspaceMeta;
  saveStatus: DetailSaveStatus;
  conflictPaths?: string[];
  onChange: (patch: WorkspacePatch) => void;
  onSave: () => boolean | Promise<boolean>;
  onFlush?: () => void;
  onConflictReload?: () => void;
  onConflictKeep?: () => void;
  onNavigateIssue: (sel: Selection) => void;
  knownKeys: Set<string>;
  issues: Issue[];
  wikiNodes?: WikiNodeMeta[];
}

function SaveStatusLabel({
  status,
  onSave,
}: {
  status: DetailSaveStatus;
  onSave: () => void;
}) {
  if (status === "dirty") {
    return (
      <span className={`${styles.saveStatus} ${styles.saveStatusDirty}`}>
        Unsaved
      </span>
    );
  }
  if (status === "saving") {
    return <span className={styles.saveStatus}>Saving…</span>;
  }
  if (status === "saved") {
    return (
      <span className={`${styles.saveStatus} ${styles.saveStatusOk}`}>Saved</span>
    );
  }
  if (status === "error") {
    return (
      <Button
        type="button"
        variant="ghost"
        className={`${styles.saveStatus} ${styles.saveStatusError}`}
        onClick={onSave}
      >
        Save failed · Retry
      </Button>
    );
  }
  if (status === "conflict") {
    return <span className={styles.saveStatus}>Conflict</span>;
  }
  return null;
}

export function WorkspaceHomeDetail({
  meta,
  saveStatus,
  conflictPaths = [],
  onChange,
  onSave,
  onFlush,
  onConflictReload,
  onConflictKeep,
  onNavigateIssue,
  knownKeys,
  issues,
  wikiNodes = [],
}: WorkspaceHomeDetailProps) {
  const saveHostSave = useCallback(() => onSave(), [onSave]);
  const saveHostHasUnsaved = useCallback(
    () =>
      saveStatus === "dirty" ||
      saveStatus === "saving" ||
      saveStatus === "conflict" ||
      saveStatus === "error",
    [saveStatus],
  );
  useActiveSaveHost({
    save: saveHostSave,
    hasUnsaved: saveHostHasUnsaved,
  });
  const bodyRef = useRef<MarkdownEditorHandle>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const navigateIssue = useCallback(
    (p: string, i: string) =>
      onNavigateIssue({ kind: "issue", projectId: p, issueId: i }),
    [onNavigateIssue],
  );
  const { plugins, mentionAutocomplete } = usePmMentions({
    issues,
    wikiNodes,
    knownIssueKeys: knownKeys,
    onNavigateIssue: navigateIssue,
  });
  const canSave =
    saveStatus === "dirty" ||
    saveStatus === "error" ||
    saveStatus === "saving" ||
    saveStatus === "conflict";

  const focusBody = () => {
    bodyRef.current?.focus({ at: "start" });
  };

  const focusTitle = () => {
    const el = titleRef.current;
    if (!el) {
      return;
    }
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  };

  const onTitleEnter = () => {
    focusBody();
  };

  return (
    <DocEditShell
      className={styles.root}
      header={
        <div className={styles.header}>
          <div className={styles.headerMeta}>
            <span className={styles.level}>Workspace</span>
            <SaveStatusLabel
              status={saveStatus}
              onSave={() => {
                void onSave();
              }}
            />
          </div>
          <div className={styles.headerActions}>
            <Button
              type="button"
              variant={canSave ? "fill-inverse" : "fill"}
              disabled={!canSave || saveStatus === "saving"}
              onClick={() => {
                void onSave();
              }}
            >
              {saveStatus === "saving" ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      }
      conflictBanner={
        onConflictReload && onConflictKeep ? (
          <DetailConflictBanner
            conflictPaths={conflictPaths}
            onReload={onConflictReload}
            onKeep={onConflictKeep}
          />
        ) : null
      }
      title={
        <BorderlessTitle
          ref={titleRef}
          value={meta.title}
          onChange={(title) => onChange({ title })}
          onEnter={onTitleEnter}
          onBlur={onFlush}
          size="page"
        />
      }
      propsSlot={
        <div className={styles.field}>
          <span>Created date</span>
          <span className={styles.readonlyValue}>{meta.createdDate}</span>
        </div>
      }
      body={
        <MarkdownEditor
          variant="borderless"
          editorRef={bodyRef}
          value={meta.description}
          onChange={(description) => onChange({ description })}
          plugins={plugins}
          mentionAutocomplete={mentionAutocomplete}
          placeholder="Markdown… type @ to link issue / wiki / member / handoff"
          rows={16}
          onNavigateOutAtStart={focusTitle}
          onBlur={onFlush}
        />
      }
      footer={<NodeAssetsSection nodeRef={{ kind: "workspace" }} />}
    />
  );
}
