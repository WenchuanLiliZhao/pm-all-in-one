import { useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import {
  BorderlessTitle,
  DocEditNav,
  DocEditOverflowMenu,
  DocEditShell,
  LocatorCopyText,
} from "@/components/doc-edit-shell";
import { DetailConflictBanner } from "@/components/detail-conflict-banner";
import { MemberPerson } from "@/components/member-person";
import { NodeAssetsSection } from "@/components/node-assets-section";
import { Button } from "@/components/ui/button";
import { Lucide } from "@/components/ui/lucide";
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
import { useNodeLocalMedia } from "@/lib/markdown/node-local-media";
import styles from "./styles.module.scss";

interface ProjectDetailProps {
  project: Project;
  saveStatus: DetailSaveStatus;
  conflictPaths?: string[];
  onChange: (patch: ProjectPatch) => void;
  onSave: () => boolean | Promise<boolean>;
  onConflictReload?: () => void;
  onConflictKeep?: () => void;
  onDelete: () => void;
  onAddEpic?: () => void;
  /** Close the detail panel (icon in DocEditNav). */
  onClose?: () => void;
  onNavigateIssue: (sel: Selection) => void;
  knownKeys: Set<string>;
  issues: Issue[];
  wikiNodes?: WikiNodeMeta[];
}

export function ProjectDetail({
  project,
  saveStatus,
  conflictPaths = [],
  onChange,
  onSave,
  onConflictReload,
  onConflictKeep,
  onDelete,
  onAddEpic,
  onClose,
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
  const navigateProject = useCallback(
    (p: string) => onNavigateIssue({ kind: "project", projectId: p }),
    [onNavigateIssue],
  );
  const { plugins, mentionAutocomplete } = usePmMentions({
    issues,
    wikiNodes,
    knownIssueKeys: knownKeys,
    onNavigateIssue: navigateIssue,
    onNavigateProject: navigateProject,
  });
  const projectNodeRef = useMemo(
    () => ({ kind: "project" as const, projectId: project.id }),
    [project.id],
  );
  const { localMedia, filenames: assetFilenames, ingestAssetFiles } =
    useNodeLocalMedia(projectNodeRef);
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
      contentClassName={styles.bodyPad}
      header={
        <DocEditNav
          left={
            <LocatorCopyText
              locator={{ kind: "project", projectId: project.id }}
            />
          }
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                size="small"
                startIcon={<Lucide.Settings aria-hidden />}
                aria-label="Project settings"
                title="Project settings"
                onClick={() => navigate(`/w/projects/${project.id}/settings`)}
              />
              <Button
                type="button"
                variant={canSave ? "fill-danger" : "ghost"}
                size="small"
                disabled={!canSave || saveStatus === "saving"}
                startIcon={<Lucide.Save aria-hidden />}
                aria-label={saveStatus === "saving" ? "Saving" : "Save"}
                title={saveStatus === "saving" ? "Saving…" : "Save"}
                onClick={() => {
                  void onSave();
                }}
              />
              {onAddEpic ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  startIcon={<Lucide.Plus aria-hidden />}
                  aria-label="Add epic"
                  title="Add epic"
                  onClick={onAddEpic}
                />
              ) : null}
              <DocEditOverflowMenu onDelete={onDelete} />
              {onClose ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  startIcon={<Lucide.X aria-hidden />}
                  aria-label="Close"
                  title="Close"
                  onClick={onClose}
                />
              ) : null}
            </>
          }
        />
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
          editorRef={bodyRef}
          value={project.description}
          onChange={(description) => onChange({ description })}
          plugins={plugins}
          mentionAutocomplete={mentionAutocomplete}
          localMedia={localMedia}
          assetFilenames={assetFilenames}
          ingestAssetFiles={ingestAssetFiles}
          placeholder="Markdown… type @ to link an issue"
          rows={10}
          onNavigateOutAtStart={focusTitle}
        />
      }
      footer={<NodeAssetsSection nodeRef={projectNodeRef} />}
    />
  );
}
