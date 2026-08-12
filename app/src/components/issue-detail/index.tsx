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

type DepCandidate = { id: string; label: string };

/** Jira-like dep list: issue rows, then Add (dropdown). Shared by blocked-by + blocks. */
function IssueDepLinksField({
  label,
  listAriaLabel,
  addAriaLabel,
  ids,
  projectId,
  issues,
  candidates,
  selectedIds,
  disabled,
  onOpen,
  onToggle,
  onRemove,
}: {
  label: string;
  listAriaLabel: string;
  addAriaLabel: string;
  ids: readonly string[];
  projectId: string;
  issues: Issue[];
  candidates: readonly DepCandidate[];
  selectedIds: ReadonlySet<string>;
  disabled: boolean;
  onOpen: (issueId: string) => void;
  onToggle: (issueId: string, selected: boolean) => void;
  onRemove: (issueId: string) => void;
}) {
  return (
    <div className={styles.field}>
      <span>{label}</span>
      <div className={styles.depLinkStack}>
        {ids.length > 0 ? (
          <ul className={styles.depLinkList} aria-label={listAriaLabel}>
            {ids.map((id) => {
              const hit = issues.find(
                (i) => i.projectId === projectId && i.id === id,
              );
              const title = hit?.title?.trim() || id;
              return (
                <li key={id} className={styles.depLinkRow}>
                  <button
                    type="button"
                    className={styles.depLinkRowLink}
                    title={`Open ${title}`}
                    disabled={!hit}
                    onClick={() => {
                      if (!hit) return;
                      onOpen(id);
                    }}
                  >
                    {hit ? (
                      <>
                        <span className={styles.depLinkLevel}>{hit.level}</span>
                        <span className={styles.depLinkTitle}>{title}</span>
                      </>
                    ) : (
                      <span className={styles.depLinkTitle}>{title}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.depLinkRowRemove}
                    aria-label={`Remove ${title}`}
                    disabled={disabled}
                    onClick={() => onRemove(id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <DropdownMenu
          filter={{ placeholder: "Search issues…" }}
          disabled={disabled}
        >
          <DropdownMenu.Trigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="small"
              startIcon={<Lucide.Plus />}
              disabled={disabled}
              aria-label={addAriaLabel}
              className={styles.depLinkAdd}
            >
              Add
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start" side="bottom">
            {candidates.length === 0 ? (
              <DropdownMenu.Label>No other issues in project</DropdownMenu.Label>
            ) : (
              candidates.map((c) => {
                const selected = selectedIds.has(c.id);
                return (
                  <DropdownMenu.ItemButton
                    key={c.id}
                    label={c.label}
                    active={selected}
                    onSelect={() => onToggle(c.id, selected)}
                  />
                );
              })
            )}
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    </div>
  );
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
  const { refreshCustomProps, persistIssueBlockedBy, setError } = useWorkspace();
  const { members } = useMember();
  const [propDefs, setPropDefs] = useState<CustomPropDef[]>([]);
  const [blocksBusy, setBlocksBusy] = useState(false);
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

  const depCandidates = useMemo(() => {
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

  /** Inverse of same-project `blockedBy` — not a stored prop. */
  const blocksIds = useMemo(() => {
    return issues
      .filter(
        (i) =>
          i.projectId === issue.projectId &&
          i.id !== issue.id &&
          (i.blockedBy ?? []).includes(issue.id),
      )
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((i) => i.id);
  }, [issues, issue.projectId, issue.id]);

  const blockedBySelected = useMemo(
    () => new Set(issue.blockedBy ?? []),
    [issue.blockedBy],
  );
  const blocksSelected = useMemo(() => new Set(blocksIds), [blocksIds]);

  const persistBlocksEdge = useCallback(
    async (targetId: string, nextBlockedBy: string[]) => {
      setBlocksBusy(true);
      setError(null);
      try {
        await persistIssueBlockedBy(issue.projectId, targetId, nextBlockedBy);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBlocksBusy(false);
      }
    },
    [issue.projectId, persistIssueBlockedBy, setError],
  );

  const onToggleBlocks = useCallback(
    (targetId: string, selected: boolean) => {
      const target = issues.find(
        (i) => i.projectId === issue.projectId && i.id === targetId,
      );
      if (!target) return;
      const cur = target.blockedBy ?? [];
      const next = selected
        ? cur.filter((id) => id !== issue.id)
        : [...new Set([...cur, issue.id])];
      void persistBlocksEdge(targetId, next);
    },
    [issues, issue.projectId, issue.id, persistBlocksEdge],
  );

  const onRemoveBlocks = useCallback(
    (targetId: string) => {
      const target = issues.find(
        (i) => i.projectId === issue.projectId && i.id === targetId,
      );
      if (!target) return;
      const next = (target.blockedBy ?? []).filter((id) => id !== issue.id);
      void persistBlocksEdge(targetId, next);
    },
    [issues, issue.projectId, issue.id, persistBlocksEdge],
  );
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

          <IssueDepLinksField
            label="Blocked by"
            listAriaLabel="Current blockers"
            addAriaLabel="Add blocker"
            ids={issue.blockedBy ?? []}
            projectId={issue.projectId}
            issues={issues}
            candidates={depCandidates}
            selectedIds={blockedBySelected}
            disabled={saveStatus === "saving" || blocksBusy}
            onOpen={(id) =>
              onNavigateIssue({
                kind: "issue",
                projectId: issue.projectId,
                issueId: id,
              })
            }
            onToggle={(id, selected) => {
              const cur = issue.blockedBy ?? [];
              onChange({
                blockedBy: selected
                  ? cur.filter((x) => x !== id)
                  : [...cur, id],
              });
            }}
            onRemove={(id) =>
              onChange({
                blockedBy: (issue.blockedBy ?? []).filter((x) => x !== id),
              })
            }
          />

          <IssueDepLinksField
            label="Blocks"
            listAriaLabel="Issues this blocks"
            addAriaLabel="Add blocked issue"
            ids={blocksIds}
            projectId={issue.projectId}
            issues={issues}
            candidates={depCandidates}
            selectedIds={blocksSelected}
            disabled={saveStatus === "saving" || blocksBusy}
            onOpen={(id) =>
              onNavigateIssue({
                kind: "issue",
                projectId: issue.projectId,
                issueId: id,
              })
            }
            onToggle={onToggleBlocks}
            onRemove={onRemoveBlocks}
          />

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
                            aria-label={def.label?.trim() || def.key}
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
