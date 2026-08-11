import { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import { BorderlessTitle, DocEditShell } from "@/components/doc-edit-shell";
import { CopyAiLocatorButton } from "@/components/copy-ai-locator-button";
import { DetailConflictBanner } from "@/components/detail-conflict-banner";
import { MemberPerson } from "@/components/member-person";
import { NodeAssetsSection } from "@/components/node-assets-section";
import { Button } from "@/components/ui/button";
import type {
  WikiNodeMeta,
  Issue,
  Project,
  ProjectPatch,
} from "@/lib/types";
import type {
  DetailSaveStatus,
  Selection,
} from "@/lib/workspace/workspace-context";
import { useActiveSaveHost } from "@/lib/workspace/use-active-save-host";
import { usePmMentions } from "@/lib/markdown/use-pm-mentions";
import styles from "./styles.module.scss";

interface ProjectDetailProps {
  project: Project;
  saveStatus: DetailSaveStatus;
  conflictPaths?: string[];
  onChange: (patch: ProjectPatch) => void;
  onSave: () => boolean | Promise<boolean>;
  onFlush?: () => void;
  onConflictReload?: () => void;
  onConflictKeep?: () => void;
  onDelete: () => void;
  onAddEpic?: () => void;
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
    return <span className={`${styles.saveStatus} ${styles.saveStatusOk}`}>Saved</span>;
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

export function ProjectDetail({
  project,
  saveStatus,
  conflictPaths = [],
  onChange,
  onSave,
  onFlush,
  onConflictReload,
  onConflictKeep,
  onDelete,
  onAddEpic,
  onNavigateIssue,
  knownKeys,
  issues,
  wikiNodes = [],
}: ProjectDetailProps) {
  const navigate = useNavigate();
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
            <span className={styles.level}>Project</span>
            <span className={styles.ref}>#{project.id}</span>
            <SaveStatusLabel
              status={saveStatus}
              onSave={() => {
                void onSave();
              }}
            />
          </div>
          <div className={styles.headerActions}>
            <CopyAiLocatorButton
              locator={{
                kind: "project",
                projectId: project.id,
              }}
            />
            <Button
              type="button"
              variant="outlined"
              onClick={() =>
                navigate(`/w/projects/${project.id}/settings`)
              }
            >
              Project settings
            </Button>
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
            {onAddEpic ? (
              <Button type="button" variant="outlined" onClick={onAddEpic}>
                Add epic
              </Button>
            ) : null}
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
          value={project.title}
          onChange={(title) => onChange({ title })}
          onEnter={onTitleEnter}
          onBlur={onFlush}
          size="sidebar"
        />
      }
      propsSlot={
        <div className={styles.row2}>
          <label className={styles.field}>
            <span>Created by</span>
            <MemberPerson
              memberId={project.createdBy}
              appearance="card"
              size="sm"
              showName
              emptyLabel="—"
            />
          </label>
          <label className={styles.field}>
            <span>Created</span>
            <span className={styles.readonlyValue}>{project.created}</span>
          </label>
          <label className={styles.field}>
            <span>Updated</span>
            <span className={styles.readonlyValue}>{project.updated}</span>
          </label>
        </div>
      }
      body={
        <MarkdownEditor
          variant="borderless"
          editorRef={bodyRef}
          value={project.description}
          onChange={(description) => onChange({ description })}
          plugins={plugins}
          mentionAutocomplete={mentionAutocomplete}
          placeholder="Markdown… type @ to link an issue"
          rows={10}
          onNavigateOutAtStart={focusTitle}
          onBlur={onFlush}
        />
      }
      footer={
        <NodeAssetsSection
          nodeRef={{ kind: "project", projectId: project.id }}
        />
      }
    />
  );
}
