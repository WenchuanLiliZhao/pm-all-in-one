import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import { BorderlessTitle, DocEditNav, DocEditOverflowMenu, DocEditShell, LocatorCopyText } from "@/components/doc-edit-shell";
import type {
  CustomPropDef,
  Issue,
  IssuePatch,
  MetaFieldType,
} from "@/lib/types";
import { BUILTIN_ISSUE_STATUSES } from "@/lib/issue-status";
import { BUILTIN_ISSUE_PRIORITIES } from "@/lib/issue-priority";
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
// Status/Priority look SoT — compose ui chrome; do not invent local glyphs/tones.
import {
  issueStatusIcon,
  issueStatusLabel,
  issueStatusToneStyles,
} from "@/components/ui/issue-status";
import {
  issuePriorityIcon,
  issuePriorityLabel,
  issuePriorityToneStyles,
} from "@/components/ui/issue-priority";
import { usePmMentions } from "@/lib/markdown/use-pm-mentions";
import { useNodeLocalMedia } from "@/lib/markdown/node-local-media";
import { keyToKebab } from "@pm-core/identity/dir-id";
import type { WikiNodeMeta } from "@/lib/types";
import styles from "./styles.module.scss";

interface IssueDetailProps {
  issue: Issue;
  saveStatus: DetailSaveStatus;
  conflictPaths?: string[];
  onChange: (patch: IssuePatch) => void;
  /** Persist detail; returns false when save failed / cancelled. */
  onSave: () => boolean | Promise<boolean>;
  onConflictReload?: () => void;
  onConflictKeep?: () => void;
  onDelete: () => void;
  onAddChild?: () => void;
  /** Close the detail panel (icon in DocEditNav). */
  onClose?: () => void;
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

/** Key/value orientation inside one prop. Props themselves always stack. */
type PropFieldLayout = "inline" | "stack";

/** Custom MetaFieldType → layout. markdown is tall → stack; scalars → inline. */
function propLayoutForCustomType(type: MetaFieldType): PropFieldLayout {
  return type === "markdown" ? "stack" : "inline";
}

function PropField({
  layout,
  label,
  children,
}: {
  layout: PropFieldLayout;
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.propField} data-layout={layout}>
      <span className={styles.propFieldKey}>{label}</span>
      <div className={styles.propFieldValue}>{children}</div>
    </div>
  );
}

type DepCandidate = { id: string; label: string };
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
    <PropField layout="stack" label={label}>
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
    </PropField>
  );
}

export function IssueDetail({
  issue,
  saveStatus,
  conflictPaths = [],
  onChange,
  onSave,
  onConflictReload,
  onConflictKeep,
  onDelete,
  onAddChild,
  onClose,
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
  const issueNodeRef = useMemo(
    () =>
      ({
        kind: "issue" as const,
        projectId: issue.projectId,
        issueId: issue.id,
      }),
    [issue.projectId, issue.id],
  );
  const { localMedia, filenames: assetFilenames, ingestAssetFiles } =
    useNodeLocalMedia(issueNodeRef);

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
      contentClassName={styles.bodyPad}
      header={
        <DocEditNav
          left={
            <LocatorCopyText
              locator={{
                kind: "issue",
                projectId: issue.projectId,
                issueId: issue.id,
              }}
            />
          }
          actions={
            <>
              <Button
                type="button"
                variant={canSave ? "fill-danger" : "ghost"}
                size="small"
                disabled={!canSave || saveStatus === "saving"}
                startIcon={<Lucide.Save aria-hidden />}
                aria-label={saveStatus === "saving" ? "Saving" : "Save"}
                title={saveStatus === "saving" ? "Saving…" : "Save"}
                onClick={() => void onSave()}
              />
              <DocEditOverflowMenu
                addChild={
                  childLabel && onAddChild
                    ? { label: childLabel, onSelect: onAddChild }
                    : undefined
                }
                onDelete={onDelete}
              />
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
          size="sidebar"
        />
      }
      propsSlot={
        <>
          <PropField layout="inline" label="Status">
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  startIcon={issueStatusIcon(issue.status)}
                  endIcon={<Lucide.ChevronDown />}
                  disabled={saveStatus === "saving"}
                  aria-label="Status"
                  className={styles.fieldControl}
                >
                  <span
                    className={issueStatusToneStyles.tone}
                    data-status={issue.status}
                  >
                    {issueStatusLabel(issue.status)}
                  </span>
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" side="bottom">
                {BUILTIN_ISSUE_STATUSES.map((s) => (
                  <DropdownMenu.ItemButton
                    key={s.id}
                    label={s.label}
                    icon={issueStatusIcon(s.id)}
                    active={issue.status === s.id}
                    onSelect={() => {
                      onChange({ status: s.id });
                    }}
                  />
                ))}
              </DropdownMenu.Content>
            </DropdownMenu>
          </PropField>

          <PropField layout="inline" label="Priority">
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  startIcon={issuePriorityIcon(issue.priority)}
                  endIcon={<Lucide.ChevronDown />}
                  disabled={saveStatus === "saving"}
                  aria-label="Priority"
                  className={styles.fieldControl}
                >
                  <span
                    className={issuePriorityToneStyles.tone}
                    data-priority={issue.priority}
                  >
                    {issuePriorityLabel(issue.priority)}
                  </span>
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" side="bottom">
                {BUILTIN_ISSUE_PRIORITIES.map((p) => (
                  <DropdownMenu.ItemButton
                    key={p.id}
                    label={p.label}
                    icon={issuePriorityIcon(p.id)}
                    active={issue.priority === p.id}
                    onSelect={() => onChange({ priority: p.id })}
                  />
                ))}
              </DropdownMenu.Content>
            </DropdownMenu>
          </PropField>

          <PropField layout="inline" label="Assignee">
            <MemberPersonSelect
              aria-label="Assignee"
              controlSize="small"
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
          </PropField>

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

          <PropField layout="inline" label="Created by">
            <MemberPerson
              memberId={issue.createdBy}
              appearance="card"
              size="sm"
              showName
              emptyLabel="—"
            />
          </PropField>

          <PropField layout="inline" label="Created">
            <span className={styles.readonlyValue}>{issue.created}</span>
          </PropField>

          <PropField layout="inline" label="Updated">
            <span className={styles.readonlyValue}>{issue.updated}</span>
          </PropField>

          <PropField layout="inline" label="Start">
            <Input
              type="date"
              size="small"
              value={issue.startDate ?? ""}
              onChange={(e) =>
                onChange({ startDate: e.target.value || null })
              }
            />
          </PropField>

          <PropField layout="inline" label="End">
            <Input
              type="date"
              size="small"
              value={issue.endDate ?? ""}
              onChange={(e) => onChange({ endDate: e.target.value || null })}
            />
          </PropField>
        </>
      }
      body={
        <MarkdownEditor
          editorRef={bodyRef}
          value={issue.description}
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
      footer={
        <>
          <NodeAssetsSection nodeRef={issueNodeRef} />

          {propDefs.length > 0 ? (
            <div className={styles.mdFields}>
              <h3>Custom fields</h3>
              {propDefs.map((def) => {
                const layout = propLayoutForCustomType(def.type);
                const label = fieldLabel(def);

                if (def.type === "markdown") {
                  return (
                    <PropField key={def.key} layout={layout} label={label}>
                      <MarkdownEditor
                        filename={`${keyToKebab(def.key)}.md`}
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
                    </PropField>
                  );
                }

                if (def.type === "boolean") {
                  const raw = issue.fields[def.key];
                  const value =
                    raw === true ? "true" : raw === false ? "false" : "";
                  const boolLabel =
                    value === "true"
                      ? "true"
                      : value === "false"
                        ? "false"
                        : "—";
                  return (
                    <PropField key={def.key} layout={layout} label={label}>
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <Button
                            type="button"
                            variant="outlined"
                            size="small"
                            endIcon={<Lucide.ChevronDown />}
                            aria-label={def.label?.trim() || def.key}
                            className={styles.fieldControl}
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
                    </PropField>
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
                    <PropField key={def.key} layout={layout} label={label}>
                      <Input
                        type="number"
                        size="small"
                        value={value}
                        onChange={(e) => {
                          const t = e.target.value;
                          onChange({
                            fields: {
                              [def.key]: t === "" ? null : Number(t),
                            },
                          });
                        }}
                      />
                    </PropField>
                  );
                }

                if (def.type === "date") {
                  const raw = issue.fields[def.key];
                  const value = typeof raw === "string" ? raw : "";
                  return (
                    <PropField key={def.key} layout={layout} label={label}>
                      <Input
                        type="date"
                        size="small"
                        value={value}
                        onChange={(e) =>
                          onChange({
                            fields: {
                              [def.key]: e.target.value || null,
                            },
                          })
                        }
                      />
                    </PropField>
                  );
                }

                // string (default)
                const raw = issue.fields[def.key];
                const value =
                  raw === null || raw === undefined ? "" : String(raw);
                return (
                  <PropField key={def.key} layout={layout} label={label}>
                    <Input
                      size="small"
                      value={value}
                      onChange={(e) =>
                        onChange({
                          fields: {
                            [def.key]: e.target.value,
                          },
                        })
                      }
                    />
                  </PropField>
                );
              })}
            </div>
          ) : null}
        </>
      }
    />
  );
}
