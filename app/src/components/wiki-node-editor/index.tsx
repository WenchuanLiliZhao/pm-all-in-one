/**
 * Wiki node editor — ExplicitDoc via local DetailSaveController.
 *
 * ↔ lib/workspace/detail-save.ts — controller + wiki target
 * ↔ lib/workspace/active-save-host.ts — Cmd+S
 * ↔ lib/workspace/use-unsaved-leave-guard.ts — Save/Discard/Cancel leave
 * ↔ dogfood @wiki-n8_7zg25NlxwdV6nIBVcD — ExplicitDoc
 * ↔ electron/core/domain/wiki.ts — updateWikiNode OCC
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DetailConflictBanner } from "@/components/detail-conflict-banner";
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
import { MemberPerson } from "@/components/member-person";
import { NodeAssetsSection } from "@/components/node-assets-section";
import { TypeConfirmDialog } from "@/components/type-confirm-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Lucide } from "@/components/ui/lucide";
import { getPm } from "@/lib/bridge";
import type {
  CustomPropDef,
  WikiIncomingRef,
  WikiNode,
  WikiNodeMeta,
  Issue,
  MetaFieldType,
} from "@/lib/types";
import { usePmMentions } from "@/lib/markdown/use-pm-mentions";
import {
  useAssetFolderMentions,
  useNodeLocalMedia,
} from "@/lib/markdown/node-local-media";
import type { Selection } from "@/lib/workspace/workspace-context";
import { useWiki } from "@/lib/workspace/wiki-context";
import { useActiveSaveHost } from "@/lib/workspace/use-active-save-host";
import { useUnsavedLeaveGuard } from "@/lib/workspace/use-unsaved-leave-guard";
import {
  DetailSaveController,
  type DetailSaveStatus,
} from "@/lib/workspace/detail-save";
import {
  classifyWiki,
  pickWikiEditable,
  wikiSlicesEqual,
  type WikiEditableSlice,
} from "@pm-core/sync/detail-diff";
import { keyToKebab } from "@pm-core/identity/dir-id";
import {
  WikiNodeLinksField,
  wikiNodeFieldIds,
} from "@/components/wiki-node-links-field";
import {
  StringListField,
  stringListFieldValues,
} from "@/components/string-list-field";
import {
  groupIncomingWikiRefs,
  incomingWikiDeleteDetail,
} from "@/lib/wiki-incoming-refs";
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

type PropFieldLayout = "inline" | "stack";

function propLayoutForCustomType(type: MetaFieldType): PropFieldLayout {
  return type === "markdown" || type === "wiki-node" || type === "string-list"
    ? "stack"
    : "inline";
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

function emptyDraft(): WikiEditableSlice {
  return {
    title: "",
    description: "",
    body: "",
    fields: {},
    markdownFields: {},
  };
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
  const [fieldsDraft, setFieldsDraft] = useState<Record<string, unknown>>({});
  const [markdownDraft, setMarkdownDraft] = useState<Record<string, string>>(
    {},
  );
  const [propDefs, setPropDefs] = useState<CustomPropDef[]>([]);
  const [status, setStatus] = useState<DetailSaveStatus>("clean");
  const [error, setError] = useState<string | null>(null);
  const [conflictPaths, setConflictPaths] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    detail: string[];
  } | null>(null);
  const [incoming, setIncoming] = useState<WikiIncomingRef[]>([]);

  const draftRef = useRef(emptyDraft());
  const baselineRef = useRef<WikiEditableSlice | null>(null);
  const bodyEditorRef = useRef<MarkdownEditorHandle>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const ctrlRef = useRef<DetailSaveController | null>(null);

  draftRef.current = {
    title: titleDraft,
    description: descriptionDraft,
    body: draft,
    fields: fieldsDraft,
    markdownFields: markdownDraft,
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
        if (target.kind !== "wiki") {
          return;
        }
        const { title, description, body, fields, markdownFields } =
          draftRef.current;
        if (!title.trim()) {
          throw new Error("Wiki-node title is required.");
        }
        const expected = baselineRef.current ?? undefined;
        const titleFocused = isTitleInputFocused();
        const saved = await getPm().updateWikiNode(
          target.wikiNodeId,
          {
            title: title.trim(),
            description,
            body,
            fields,
            markdownFields,
          },
          expected ? { expected } : undefined,
        );
        setPage(saved);
        setDraft(saved.body);
        setDescriptionDraft(saved.description);
        setFieldsDraft({ ...saved.fields });
        setMarkdownDraft({ ...saved.markdownFields });
        if (!titleFocused) {
          setTitleDraft(saved.title);
        } else {
          draftRef.current = {
            title,
            description: saved.description,
            body: saved.body,
            fields: { ...saved.fields },
            markdownFields: { ...saved.markdownFields },
          };
        }
        baselineRef.current = pickWikiEditable(saved);
      },
    });
  }
  const ctrl = ctrlRef.current;

  useEffect(() => {
    let cancelled = false;
    setIncoming([]);
    void (async () => {
      try {
        const next = await getPm().getWikiNode(wikiNodeId);
        const schema = await getPm().getWikiCustomProps();
        if (cancelled) {
          return;
        }
        setPage(next);
        setDraft(next.body);
        setTitleDraft(next.title);
        setDescriptionDraft(next.description);
        setFieldsDraft({ ...next.fields });
        setMarkdownDraft({ ...next.markdownFields });
        setPropDefs(schema.fields);
        try {
          const refs = await getPm().listWikiIncomingRefs(wikiNodeId);
          if (!cancelled) {
            setIncoming(refs);
          }
        } catch {
          if (!cancelled) {
            setIncoming([]);
          }
        }
        if (cancelled) {
          return;
        }
        draftRef.current = pickWikiEditable(next);
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
    };
  }, [wikiNodeId, ctrl]);

  useEffect(() => {
    return getPm().onChanged(() => {
      void (async () => {
        try {
          const next = await getPm().getWikiNode(wikiNodeId);
          const schema = await getPm().getWikiCustomProps();
          const baseline = baselineRef.current ?? pickWikiEditable(next);
          const draftSlice: WikiEditableSlice = { ...draftRef.current };
          const disk = pickWikiEditable(next);
          const result = classifyWiki(baseline, draftSlice, disk);
          setPage(next);
          setPropDefs(schema.fields);
          try {
            setIncoming(await getPm().listWikiIncomingRefs(wikiNodeId));
          } catch {
            setIncoming([]);
          }
          setDraft(result.mergedDraft.body);
          setTitleDraft(result.mergedDraft.title);
          setDescriptionDraft(result.mergedDraft.description);
          setFieldsDraft({ ...result.mergedDraft.fields });
          setMarkdownDraft({ ...result.mergedDraft.markdownFields });
          draftRef.current = result.mergedDraft;
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
    (slice: WikiEditableSlice) => {
      const base = baselineRef.current;
      if (!base) {
        return;
      }
      const dirty =
        titleDirty(slice.title, base.title) ||
        !wikiSlicesEqual(
          { ...slice, title: slice.title.trim() },
          { ...base, title: base.title.trim() },
        );
      ctrl.setContentDirty({ kind: "wiki", wikiNodeId }, dirty);
    },
    [ctrl, wikiNodeId],
  );

  const save = useCallback(async (): Promise<boolean> => {
    return ctrl.save();
  }, [ctrl]);

  const hasUnsaved = useCallback(() => ctrl.hasUnsavedWork(), [ctrl]);

  const discardDraft = useCallback(() => {
    const base = baselineRef.current;
    if (base) {
      setTitleDraft(base.title);
      setDescriptionDraft(base.description);
      setDraft(base.body);
      setFieldsDraft({ ...base.fields });
      setMarkdownDraft({ ...base.markdownFields });
      draftRef.current = { ...base };
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

  const navigateIssue = useCallback(
    (p: string, i: string) =>
      onNavigateIssue({ kind: "issue", projectId: p, issueId: i }),
    [onNavigateIssue],
  );
  const navigateProject = useCallback(
    (p: string) => onNavigateIssue({ kind: "project", projectId: p }),
    [onNavigateIssue],
  );
  const { plugins, mentionAutocomplete: pmMentions } = usePmMentions({
    issues,
    wikiNodes,
    onNavigateIssue: navigateIssue,
    onNavigateProject: navigateProject,
  });
  const wikiNodeRef = useMemo(
    () => ({ kind: "wiki" as const, wikiNodeId }),
    [wikiNodeId],
  );
  const {
    localMedia,
    filenames: assetFilenames,
    assetsDir,
    ingestAssetFiles,
  } = useNodeLocalMedia(wikiNodeRef);
  const mentionAutocomplete = useAssetFolderMentions(
    pmMentions,
    assetFilenames,
    assetsDir,
  );

  const resolveConflictReload = async () => {
    try {
      const next = await getPm().getWikiNode(wikiNodeId);
      setPage(next);
      setDraft(next.body);
      setTitleDraft(next.title);
      setDescriptionDraft(next.description);
      setFieldsDraft({ ...next.fields });
      setMarkdownDraft({ ...next.markdownFields });
      draftRef.current = pickWikiEditable(next);
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
      const dirty = !wikiSlicesEqual(
        {
          title: titleDraft.trim(),
          description: descriptionDraft,
          body: draft,
          fields: fieldsDraft,
          markdownFields: markdownDraft,
        },
        {
          ...pickWikiEditable(next),
          title: next.title.trim(),
        },
      );
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

  const patchFields = (key: string, value: unknown) => {
    const next = { ...fieldsDraft, [key]: value };
    setFieldsDraft(next);
    const slice: WikiEditableSlice = {
      title: titleDraft,
      description: descriptionDraft,
      body: draft,
      fields: next,
      markdownFields: markdownDraft,
    };
    draftRef.current = slice;
    markDirty(slice);
  };

  const patchMarkdown = (key: string, value: string) => {
    const next = { ...markdownDraft, [key]: value };
    setMarkdownDraft(next);
    const slice: WikiEditableSlice = {
      title: titleDraft,
      description: descriptionDraft,
      body: draft,
      fields: fieldsDraft,
      markdownFields: next,
    };
    draftRef.current = slice;
    markDirty(slice);
  };

  const onDelete = () => {
    void (async () => {
      const detailParts = [
        "This cannot be undone.",
        "It will also be removed from Contents (nested Contents items are promoted).",
      ];
      try {
        detailParts.push(...(await incomingWikiDeleteDetail(page.id)));
      } catch {
        // Incoming scan failed — still allow delete.
      }
      if (ctrl.hasUnsavedWork()) {
        detailParts.push("Unsaved edits will be discarded.");
      }
      setPendingDelete({ id: page.id, detail: detailParts });
    })();
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
        <DocEditNav
          left={
            <LocatorCopyText
              locator={{ kind: "wiki", wikiNodeId: page.id }}
            />
          }
          actions={
            <>
              <Button
                type="button"
                variant={
                  status === "dirty" ||
                  status === "conflict" ||
                  status === "error"
                    ? "fill-danger"
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
              <DocEditOverflowMenu onDelete={onDelete} />
            </>
          }
        />
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
            const slice: WikiEditableSlice = {
              title: next,
              description: descriptionDraft,
              body: draft,
              fields: fieldsDraft,
              markdownFields: markdownDraft,
            };
            draftRef.current = slice;
            markDirty(slice);
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
          <Input
            aria-label="Description"
            value={descriptionDraft}
            disabled={status === "saving"}
            placeholder="Short blurb (may be empty)"
            onChange={(e) => {
              const next = e.target.value;
              setDescriptionDraft(next);
              const slice: WikiEditableSlice = {
                title: titleDraft,
                description: next,
                body: draft,
                fields: fieldsDraft,
                markdownFields: markdownDraft,
              };
              draftRef.current = slice;
              markDirty(slice);
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
          editorRef={bodyEditorRef}
          value={draft}
          onChange={(body) => {
            setDraft(body);
            const slice: WikiEditableSlice = {
              title: titleDraft,
              description: descriptionDraft,
              body,
              fields: fieldsDraft,
              markdownFields: markdownDraft,
            };
            draftRef.current = slice;
            markDirty(slice);
          }}
          plugins={plugins}
          mentionAutocomplete={mentionAutocomplete}
          localMedia={localMedia}
          assetFilenames={assetFilenames}
          ingestAssetFiles={ingestAssetFiles}
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
        <>
          <NodeAssetsSection nodeRef={wikiNodeRef} />
          {incoming.length > 0 ? (
            <div className={styles.mdFields}>
              <h3>Linked from</h3>
              {groupIncomingWikiRefs(incoming).map((group) => {
                const def = propDefs.find((d) => d.key === group.fieldKey);
                const groupLabel = def?.label?.trim() || group.fieldKey;
                return (
                  <PropField
                    key={group.fieldKey}
                    layout="stack"
                    label={groupLabel}
                  >
                    <ul className={styles.incomingList} aria-label={groupLabel}>
                      {group.fromIds.map((id) => {
                        const hit = wikiNodes.find((n) => n.id === id);
                        const title = hit?.title?.trim() || id;
                        return (
                          <li key={id}>
                            <button
                              type="button"
                              className={styles.incomingLink}
                              title={hit ? `Open ${title}` : id}
                              disabled={!hit}
                              onClick={() => {
                                if (!hit) {
                                  return;
                                }
                                navigate(`/w/wiki/${id}`);
                              }}
                            >
                              {title}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </PropField>
                );
              })}
            </div>
          ) : null}
          {propDefs.length > 0 ? (
            <div className={styles.mdFields}>
              <h3>Custom fields</h3>
              {propDefs.map((def) => {
                const layout = propLayoutForCustomType(def.type);
                const label = fieldLabel(def);

                if (def.type === "wiki-node") {
                  return (
                    <PropField key={def.key} layout={layout} label={label}>
                      <WikiNodeLinksField
                        ids={wikiNodeFieldIds(fieldsDraft[def.key])}
                        wikiNodes={wikiNodes}
                        listAriaLabel={def.label?.trim() || def.key}
                        addAriaLabel={`Add ${def.label?.trim() || def.key}`}
                        onOpen={(id) => navigate(`/w/wiki/${id}`)}
                        onChange={(ids) => patchFields(def.key, ids)}
                      />
                    </PropField>
                  );
                }

                if (def.type === "string-list") {
                  return (
                    <PropField key={def.key} layout={layout} label={label}>
                      <StringListField
                        values={stringListFieldValues(fieldsDraft[def.key])}
                        listAriaLabel={def.label?.trim() || def.key}
                        addAriaLabel={`Add ${def.label?.trim() || def.key}`}
                        onChange={(values) => patchFields(def.key, values)}
                      />
                    </PropField>
                  );
                }

                if (def.type === "markdown") {
                  return (
                    <PropField key={def.key} layout={layout} label={label}>
                      <MarkdownEditor
                        filename={`${keyToKebab(def.key)}.md`}
                        value={markdownDraft[def.key] ?? ""}
                        onChange={(next) => patchMarkdown(def.key, next)}
                        plugins={plugins}
                        mentionAutocomplete={mentionAutocomplete}
                        placeholder="Markdown… type @ to link an issue"
                        rows={6}
                      />
                    </PropField>
                  );
                }

                if (def.type === "boolean") {
                  const raw = fieldsDraft[def.key];
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
                                patchFields(
                                  def.key,
                                  opt.id === "true"
                                    ? true
                                    : opt.id === "false"
                                      ? false
                                      : null,
                                );
                              }}
                            />
                          ))}
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </PropField>
                  );
                }

                if (def.type === "number") {
                  const raw = fieldsDraft[def.key];
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
                          patchFields(def.key, t === "" ? null : Number(t));
                        }}
                      />
                    </PropField>
                  );
                }

                if (def.type === "date") {
                  const raw = fieldsDraft[def.key];
                  const value = typeof raw === "string" ? raw : "";
                  return (
                    <PropField key={def.key} layout={layout} label={label}>
                      <Input
                        type="date"
                        size="small"
                        value={value}
                        onChange={(e) =>
                          patchFields(def.key, e.target.value || null)
                        }
                      />
                    </PropField>
                  );
                }

                const raw = fieldsDraft[def.key];
                const value =
                  raw === null || raw === undefined ? "" : String(raw);
                return (
                  <PropField key={def.key} layout={layout} label={label}>
                    <Input
                      size="small"
                      value={value}
                      onChange={(e) => patchFields(def.key, e.target.value)}
                    />
                  </PropField>
                );
              })}
            </div>
          ) : null}
        </>
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
