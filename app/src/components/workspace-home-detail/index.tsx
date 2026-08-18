import { useCallback, useMemo, useRef } from "react";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import {
  BorderlessTitle,
  DocEditChannelTitle,
  DocEditNav,
  DocEditShell,
} from "@/components/doc-edit-shell";
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
import { Lucide } from "@/components/ui/lucide";
import { usePmMentions } from "@/lib/markdown/use-pm-mentions";
import { useNodeLocalMedia } from "@/lib/markdown/node-local-media";
import styles from "./styles.module.scss";

interface WorkspaceHomeDetailProps {
  meta: WorkspaceMeta;
  saveStatus: DetailSaveStatus;
  conflictPaths?: string[];
  onChange: (patch: WorkspacePatch) => void;
  onSave: () => boolean | Promise<boolean>;
  onConflictReload?: () => void;
  onConflictKeep?: () => void;
  onNavigateIssue: (sel: Selection) => void;
  knownKeys: Set<string>;
  issues: Issue[];
  wikiNodes?: WikiNodeMeta[];
}

export function WorkspaceHomeDetail({
  meta,
  saveStatus,
  conflictPaths = [],
  onChange,
  onSave,
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
  const workspaceNodeRef = useMemo(
    () => ({ kind: "workspace" as const }),
    [],
  );
  const { localMedia, filenames: assetFilenames, ingestAssetFiles } =
    useNodeLocalMedia(workspaceNodeRef);
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
        <DocEditNav
          left={<DocEditChannelTitle>Overview</DocEditChannelTitle>}
          actions={
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
          value={meta.title}
          onChange={(title) => onChange({ title })}
          onEnter={onTitleEnter}
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
          editorRef={bodyRef}
          value={meta.description}
          onChange={(description) => onChange({ description })}
          plugins={plugins}
          mentionAutocomplete={mentionAutocomplete}
          localMedia={localMedia}
          assetFilenames={assetFilenames}
          ingestAssetFiles={ingestAssetFiles}
          placeholder="Markdown… type @ to link issue / wiki / member / handoff"
          rows={16}
          onNavigateOutAtStart={focusTitle}
        />
      }
      footer={<NodeAssetsSection nodeRef={workspaceNodeRef} />}
    />
  );
}
