import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import { BorderlessTitle, DocEditShell } from "@/components/doc-edit-shell";
import type {
  CustomPropDef,
  Issue,
  IssuePatch,
} from "@/lib/types";
import { BUILTIN_ISSUE_STATUSES } from "@/lib/issue-status";
import { BUILTIN_ISSUE_PRIORITIES, issuePriorityLabel } from "@/lib/issue-priority";
import type {
  DetailSaveStatus,
  Selection,
} from "@/lib/workspace/workspace-context";
import { useWorkspace } from "@/lib/workspace/workspace-context";
import { useActiveSaveHost } from "@/lib/workspace/use-active-save-host";
import { useMember } from "@/lib/workspace/member-context";
import { DetailConflictBanner } from "@/components/detail-conflict-banner";
import {
  MemberPerson,
  MemberPersonSelect,
} from "@/components/member-person";
import { NodeAssetsSection } from "@/components/node-assets-section";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Lucide } from "@/components/ui/lucide";
import { issueStatusLabel } from "@/components/ui/issue-status";
import { CopyAiLocatorButton } from "@/components/copy-ai-locator-button";
import { usePmMentions } from "@/lib/markdown/use-pm-mentions";
import type { WikiNodeMeta } from "@/lib/types";
import styles from "./styles.module.scss";

interface IssueDetailProps {
  issue: Issue;
  saveStatus: DetailSaveStatus;
  conflictPaths?: string[];
  onChange: (patch: IssuePatch) => void;
  /** Persist detail; returns false when save failed / cancelled. */
  onSave: () => boolean | Promise<boolean>;
  /** Flush pending autosave (title/body blur). */
  onFlush?: () => void;
  onConflictReload?: () => void;
  onConflictKeep?: () => void;
  onDelete: () => void;
  onAddChild?: () => void;
  /** Reparent to resolve a ladder violation; the store re-derives levels. */
  onRepairPlacement: (newParentIssueId: string | null) => void;
  onNavigateIssue: (sel: Selection) => void;
  knownKeys: Set<string>;
  /** Workspace issues for `[[` autocomplete. */
  issues: Issue[];
  wikiNodes?: WikiNodeMeta[];
}

const CHILD_LABEL: Record<Issue["level"], string | null> = {
  epic: "Add task",
  task: "Add subtask",
  subtask: null,
};

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

export function IssueDetail({
  issue,
  saveStatus,
  conflictPaths = [],
  onChange,
  onSave,
  onFlush,
  onConflictReload,
  onConflictKeep,
  onDelete,
  onAddChild,
  onRepairPlacement,
  onNavigateIssue,
  knownKeys,
  issues,
  wikiNodes = [],
}: IssueDetailProps) {
  const { refreshCustomProps } = useWorkspace();
  const { members } = useMember();
  const [propDefs, setPropDefs] = useState<CustomPropDef[]>([]);
  const bodyRef = useRef<MarkdownEditorHandle>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
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
  const refLabel = `${issue.projectId}::${issue.id}`;
  const childLabel = CHILD_LABEL[issue.level];
  const expectedLevel =
    issue.violations.find(
      (v) => v.expectedLevel !== null && v.expectedLevel !== issue.level,
    )?.expectedLevel ?? null;
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

  const assigneeOptions = useMemo(() => {
    const nodes = members?.nodes ?? [];
    const involved = nodes
      .filter((m) => m.membership === "involved")
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
    const currentId = issue.assignee;
    const current = currentId
      ? nodes.find((m) => m.id === currentId)
      : undefined;
    const leftSelected =
      current && current.membership === "left" ? current : null;
    const missingSelected =
      currentId && !current
        ? { id: currentId, title: currentId }
        : null;
    return { involved, leftSelected, missingSelected };
  }, [members?.nodes, issue.assignee]);

  const blockerCandidates = useMemo(() => {
    return issues
      .filter(
        (i) => i.projectId === issue.projectId && i.id !== issue.id,
      )
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((i) => ({
        id: i.id,
        label: `${i.level} · ${i.title.trim() || "(untitled)"}`,
      }));
  }, [issues, issue.projectId, issue.id]);

  const blockedBySummary = useMemo(() => {
    const ids = issue.blockedBy ?? [];
    if (ids.length === 0) {
      return "None";
    }
    const titles = ids.map((id) => {
      const hit = issues.find(
        (i) => i.projectId === issue.projectId && i.id === id,
      );
      return hit?.title?.trim() || id;
    });
    if (titles.length <= 2) {
      return titles.join(", ");
    }
    return `${titles[0]}, ${titles[1]} +${titles.length - 2}`;
  }, [issue.blockedBy, issue.projectId, issues]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const schema = await refreshCustomProps(issue.projectId);
        if (cancelled) return;
        setPropDefs(schema[issue.level] ?? []);
      } catch {
        if (!cancelled) setPropDefs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issue.projectId, issue.level, refreshCustomProps]);

  const fieldLabel = (def: CustomPropDef) => {
    const label = def.label?.trim() || def.key;
    const help = def.help?.trim();
    return (
      <span className={styles.fieldLabel}>
        {label}
        {help ? (
          <abbr className={styles.helpTip} title={help} aria-label={help}>
            ?
          </abbr>
        ) : null}
      </span>
    );
  };

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
            <span className={styles.level}>{issue.level}</span>
            <span className={styles.ref}>{refLabel}</span>
            <SaveStatusLabel status={saveStatus} onSave={() => void onSave()} />
          </div>
          <div className={styles.headerActions}>
            <CopyAiLocatorButton
              locator={{
                kind: "issue",
                projectId: issue.projectId,
                issueId: issue.id,
              }}
            />
            <Button
              type="button"
              variant={canSave ? "fill-inverse" : "fill"}
              disabled={!canSave || saveStatus === "saving"}
              onClick={() => void onSave()}
            >
              {saveStatus === "saving" ? "Saving…" : "Save"}
            </Button>
            {childLabel && onAddChild ? (
              <Button type="button" variant="outlined" onClick={onAddChild}>
                {childLabel}
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
        <>
          {onConflictReload && onConflictKeep ? (
            <DetailConflictBanner
              conflictPaths={conflictPaths}
              onReload={onConflictReload}
              onKeep={onConflictKeep}
            />
          ) : null}
          {issue.violations.length > 0 ? (
            <Banner tone="error" className={styles.violation}>
              <span className={styles.violationTitle}>
                Level and placement disagree — nothing was changed for you.
              </span>
              <ul className={styles.violationList}>
                {issue.violations.map((v) => (
                  <li key={v.kind}>
                    <code>{v.kind}</code> {v.message}
                  </li>
                ))}
              </ul>
              <span className={styles.violationActions}>
                {expectedLevel ? (
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => onRepairPlacement(issue.parentId)}
                  >
                    Keep here — make this a {expectedLevel}
                  </Button>
                ) : null}
                {issue.parentId !== null ? (
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => onRepairPlacement(null)}
                  >
                    Move to project root — make this an epic
                  </Button>
                ) : null}
              </span>
            </Banner>
          ) : null}
        </>
      }
      title={
        <BorderlessTitle
          ref={titleRef}
          value={issue.title}
          onChange={(title) => onChange({ title })}
          onEnter={onTitleEnter}
          onBlur={onFlush}
          size="sidebar"
        />
      }
      propsSlot={
        <>
          <label className={styles.field}>
            <span>Status</span>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  endIcon={<Lucide.ChevronDown />}
                  disabled={saveStatus === "saving"}
                  aria-label="Status"
                >
                  {issueStatusLabel(issue.status)}
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" side="bottom">
                {BUILTIN_ISSUE_STATUSES.map((s) => (
                  <DropdownMenu.ItemButton
                    key={s.id}
                    label={s.label}
                    active={issue.status === s.id}
                    onSelect={() => {
                      onChange({ status: s.id });
                    }}
                  />
                ))}
              </DropdownMenu.Content>
            </DropdownMenu>
          </label>

          <label className={styles.field}>
            <span>Priority</span>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  endIcon={<Lucide.ChevronDown />}
                  disabled={saveStatus === "saving"}
                  aria-label="Priority"
                >
                  {issuePriorityLabel(issue.priority)}
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" side="bottom">
                {BUILTIN_ISSUE_PRIORITIES.map((p) => (
                  <DropdownMenu.ItemButton
                    key={p.id}
                    label={p.label}
                    active={issue.priority === p.id}
                    onSelect={() => onChange({ priority: p.id })}
                  />
                ))}
              </DropdownMenu.Content>
            </DropdownMenu>
          </label>

          <label className={styles.field}>
            <span>Assignee</span>
            <MemberPersonSelect
              aria-label="Assignee"
              value={issue.assignee ?? null}
              options={assigneeOptions.involved}
              extraOption={
                assigneeOptions.leftSelected
                  ? assigneeOptions.leftSelected
                  : assigneeOptions.missingSelected
                    ? {
                        id: assigneeOptions.missingSelected.id,
                        title: assigneeOptions.missingSelected.title,
                        membership: "missing",
                      }
                    : null
              }
              onChange={(memberId) => onChange({ assignee: memberId })}
            />
          </label>

          <label className={styles.field}>
            <span>Blocked by</span>
            <DropdownMenu
              filter={{ placeholder: "Search issues…" }}
              disabled={saveStatus === "saving"}
            >
              <DropdownMenu.Trigger asChild>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  endIcon={<Lucide.ChevronDown />}
                  disabled={saveStatus === "saving"}
                  aria-label="Blocked by"
                  className={styles.blockedByTrigger}
                >
                  <span className={styles.blockedByTriggerLabel}>
                    {blockedBySummary}
                  </span>
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" side="bottom">
                {blockerCandidates.length === 0 ? (
                  <DropdownMenu.Label>No other issues in project</DropdownMenu.Label>
                ) : (
                  blockerCandidates.map((c) => {
                    const selected = (issue.blockedBy ?? []).includes(c.id);
                    return (
                      <DropdownMenu.ItemButton
                        key={c.id}
                        label={c.label}
                        active={selected}
                        onSelect={() => {
                          const cur = issue.blockedBy ?? [];
                          onChange({
                            blockedBy: selected
                              ? cur.filter((id) => id !== c.id)
                              : [...cur, c.id],
                          });
                        }}
                      />
                    );
                  })
                )}
              </DropdownMenu.Content>
            </DropdownMenu>
            {(issue.blockedBy ?? []).length > 0 ? (
              <ul className={styles.blockedByChips} aria-label="Current blockers">
                {(issue.blockedBy ?? []).map((id) => {
                  const hit = issues.find(
                    (i) => i.projectId === issue.projectId && i.id === id,
                  );
                  const title = hit?.title?.trim() || id;
                  return (
                    <li key={id} className={styles.blockedByChip}>
                      <button
                        type="button"
                        className={styles.blockedByChipLabel}
                        title={`Open ${title}`}
                        disabled={!hit}
                        onClick={() => {
                          if (!hit) return;
                          onNavigateIssue({
                            kind: "issue",
                            projectId: issue.projectId,
                            issueId: id,
                          });
                        }}
                      >
                        {hit ? `${hit.level} · ${title}` : title}
                      </button>
                      <button
                        type="button"
                        className={styles.blockedByChipRemove}
                        aria-label={`Remove ${title}`}
                        disabled={saveStatus === "saving"}
                        onClick={() =>
                          onChange({
                            blockedBy: (issue.blockedBy ?? []).filter(
                              (x) => x !== id,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </label>

          <label className={styles.field}>
            <span>Created by</span>
            <MemberPerson
              memberId={issue.createdBy}
              appearance="card"
              size="sm"
              showName
              emptyLabel="—"
            />
          </label>

          <div className={styles.row2}>
            <label className={styles.field}>
              <span>Created</span>
              <span className={styles.readonlyValue}>{issue.created}</span>
            </label>
            <label className={styles.field}>
              <span>Updated</span>
              <span className={styles.readonlyValue}>{issue.updated}</span>
            </label>
          </div>

          <div className={styles.row2}>
            <label className={styles.field}>
              <span>Start</span>
              <Input
                type="date"
                value={issue.startDate ?? ""}
                onChange={(e) => onChange({ startDate: e.target.value || null })}
              />
            </label>
            <label className={styles.field}>
              <span>End</span>
              <Input
                type="date"
                value={issue.endDate ?? ""}
                onChange={(e) => onChange({ endDate: e.target.value || null })}
              />
            </label>
            <label className={styles.field}>
              <span>Estimate</span>
              <Input
                type="number"
                value={issue.estimatePoint}
                onChange={(e) =>
                  onChange({ estimatePoint: Number(e.target.value) || 0 })
                }
              />
            </label>
          </div>
        </>
      }
      body={
        <MarkdownEditor
          variant="borderless"
          editorRef={bodyRef}
          value={issue.description}
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
        <>
          <NodeAssetsSection
            nodeRef={{
              kind: "issue",
              projectId: issue.projectId,
              issueId: issue.id,
            }}
          />

          {propDefs.length > 0 ? (
            <div className={styles.mdFields}>
              <h3>Custom fields</h3>
              {propDefs.map((def) => {
                if (def.type === "markdown") {
                  return (
                    <MarkdownEditor
                      key={def.key}
                      label={fieldLabel(def)}
                      value={issue.markdownFields[def.key] ?? ""}
                      onChange={(next) =>
                        onChange({
                          markdownFields: { [def.key]: next },
                        })
                      }
                      plugins={plugins}
                      mentionAutocomplete={mentionAutocomplete}
                      placeholder="Markdown… type @ to link an issue"
                      rows={6}
                    />
                  );
                }

                if (def.type === "boolean") {
                  const raw = issue.fields[def.key];
                  const value =
                    raw === true ? "true" : raw === false ? "false" : "";
                  const boolLabel =
                    value === "true" ? "true" : value === "false" ? "false" : "—";
                  return (
                    <label key={def.key} className={styles.field}>
                      {fieldLabel(def)}
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <Button
                            type="button"
                            variant="outlined"
                            size="small"
                            endIcon={<Lucide.ChevronDown />}
                            aria-label={fieldLabel(def)}
                          >
                            {boolLabel}
                          </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="start" side="bottom">
                          {(
                            [
                              { id: "", label: "—" },
                              { id: "true", label: "true" },
                              { id: "false", label: "false" },
                            ] as const
                          ).map((opt) => (
                            <DropdownMenu.ItemButton
                              key={opt.id || "empty"}
                              label={opt.label}
                              active={value === opt.id}
                              onSelect={() => {
                                onChange({
                                  fields: {
                                    [def.key]:
                                      opt.id === "true"
                                        ? true
                                        : opt.id === "false"
                                          ? false
                                          : null,
                                  },
                                });
                              }}
                            />
                          ))}
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </label>
                  );
                }

                if (def.type === "number") {
                  const raw = issue.fields[def.key];
                  const value =
                    typeof raw === "number" && Number.isFinite(raw)
                      ? String(raw)
                      : raw === null || raw === undefined
                        ? ""
                        : String(raw);
                  return (
                    <label key={def.key} className={styles.field}>
                      {fieldLabel(def)}
                      <Input
                        type="number"
                        value={value}
                        onChange={(e) => {
                          const t = e.target.value;
                          onChange({
                            fields: {
                              [def.key]:
                                t === "" ? null : Number(t),
                            },
                          });
                        }}
                      />
                    </label>
                  );
                }

                if (def.type === "date") {
                  const raw = issue.fields[def.key];
                  const value = typeof raw === "string" ? raw : "";
                  return (
                    <label key={def.key} className={styles.field}>
                      {fieldLabel(def)}
                      <Input
                        type="date"
                        value={value}
                        onChange={(e) =>
                          onChange({
                            fields: {
                              [def.key]: e.target.value || null,
                            },
                          })
                        }
                      />
                    </label>
                  );
                }

                // string (default)
                const raw = issue.fields[def.key];
                const value =
                  raw === null || raw === undefined ? "" : String(raw);
                return (
                  <label key={def.key} className={styles.field}>
                    {fieldLabel(def)}
                    <Input
                      value={value}
                      onChange={(e) =>
                        onChange({
                          fields: {
                            [def.key]: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                );
              })}
            </div>
          ) : null}
        </>
      }
    />
  );
}
