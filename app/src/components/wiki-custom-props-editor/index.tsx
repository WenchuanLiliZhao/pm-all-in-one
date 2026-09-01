import { useCallback, useEffect, useState } from "react";
import type { CustomPropDef, MetaFieldType, WikiCustomPropsSchema } from "@/lib/types";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Lucide } from "@/components/ui/lucide";
import { getPm } from "@/lib/bridge";
import { useActiveSaveHost } from "@/lib/workspace/use-active-save-host";
import { useUnsavedLeaveGuard } from "@/lib/workspace/use-unsaved-leave-guard";
import { RemoveFieldDialog } from "@/components/custom-props-editor/remove-field-dialog";
import styles from "@/components/custom-props-editor/styles.module.scss";

const TYPES: MetaFieldType[] = [
  "string",
  "number",
  "boolean",
  "date",
  "markdown",
  "wiki-node",
  "string-list",
];

function newKey(n: number): string {
  return `wikiField${n}`;
}

function normalizeSchema(schema: WikiCustomPropsSchema): WikiCustomPropsSchema {
  const fields = schema.fields.map((def) => {
    const help = def.help?.trim();
    if (!help) {
      const { help: _drop, ...rest } = def;
      return rest;
    }
    return { ...def, help };
  });
  return { fields };
}

type PendingRemove = {
  key: string;
  label: string;
  usageCount: number;
};

interface WikiCustomPropsEditorProps {
  load: () => Promise<WikiCustomPropsSchema>;
  save: (schema: WikiCustomPropsSchema) => Promise<void>;
  countUsage: (key: string) => Promise<number>;
  /** When false, Cmd+S stays with the host page (Workspace Settings title). */
  registerSaveHost?: boolean;
}

export function WikiCustomPropsEditor({
  load,
  save,
  countUsage,
  registerSaveHost = true,
}: WikiCustomPropsEditorProps) {
  const [draft, setDraft] = useState<WikiCustomPropsSchema>({ fields: [] });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const schema = await load();
        if (!cancelled) {
          setDraft(schema);
          setDirty(false);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!dirty) {
      return true;
    }
    setSaving(true);
    setError(null);
    try {
      const cleaned = normalizeSchema(draft);
      await save(cleaned);
      setDraft(cleaned);
      setDirty(false);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [dirty, draft, save]);

  const saveHostHasUnsaved = useCallback(() => dirty || saving, [dirty, saving]);
  useActiveSaveHost(
    registerSaveHost
      ? {
          save: handleSave,
          hasUnsaved: saveHostHasUnsaved,
          promptBeforeUnload: true,
        }
      : null,
  );
  useUnsavedLeaveGuard({
    when: dirty,
    hasUnsaved: () => dirty || saving,
    save: handleSave,
    onDiscard: () => {
      setDirty(false);
    },
    title: "Unsaved wiki fields",
    message:
      "You have unsaved wiki field changes. Save before leaving, discard them, or cancel?",
  });

  function patchFields(next: CustomPropDef[]) {
    setDraft({ fields: next });
    setDirty(true);
  }

  const applyRemove = (key: string) => {
    setDraft((d) => ({
      fields: d.fields.filter((r) => r.key !== key),
    }));
    setDirty(true);
    setPendingRemove(null);
  };

  const requestRemove = async (row: CustomPropDef) => {
    const usageCount = await countUsage(row.key);
    if (usageCount === 0) {
      const ok = await getPm().confirmDangerous({
        title: "Remove custom field?",
        message: `Remove "${row.label}" (${row.key}) from wiki?`,
        detail:
          "No wiki pages currently store a value for this field. Save props to write the schema.",
      });
      if (ok) {
        applyRemove(row.key);
      }
      return;
    }
    setPendingRemove({
      key: row.key,
      label: row.label,
      usageCount,
    });
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Wiki fields</h2>
        <Button
          type="button"
          variant={dirty || saving ? "fill-inverse" : "fill"}
          disabled={!dirty || saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : dirty ? "Save props" : "Save"}
        </Button>
      </div>
      <p className={styles.hint}>
        Workspace-level fields for every wiki-node (
        <code>wiki/custom-props.ts</code>). Optional “What is this” describes the
        field contract for people and AI.
      </p>

      {error ? (
        <Banner tone="error" className={styles.error}>
          {error}
        </Banner>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>wiki</h3>
          <Button
            type="button"
            variant="outlined"
            onClick={() =>
              patchFields([
                ...draft.fields,
                {
                  key: newKey(draft.fields.length + 1),
                  label: `Field ${draft.fields.length + 1}`,
                  type: "string",
                },
              ])
            }
          >
            + Field
          </Button>
        </div>
        <ul className={styles.rowList}>
          {draft.fields.length === 0 ? (
            <li className={styles.empty}>No fields</li>
          ) : null}
          {draft.fields.map((row, index) => (
            <li key={`${row.key}-${index}`} className={styles.row}>
              <div className={styles.rowMainWide}>
                <Input
                  value={row.key}
                  placeholder="key"
                  aria-label="key"
                  onChange={(e) => {
                    const next = draft.fields.map((r, i) =>
                      i === index ? { ...r, key: e.target.value } : r,
                    );
                    patchFields(next);
                  }}
                />
                <Input
                  value={row.label}
                  placeholder="label"
                  aria-label="label"
                  onChange={(e) => {
                    const next = draft.fields.map((r, i) =>
                      i === index ? { ...r, label: e.target.value } : r,
                    );
                    patchFields(next);
                  }}
                />
                <DropdownMenu>
                  <DropdownMenu.Trigger asChild>
                    <Button
                      type="button"
                      variant="outlined"
                      size="small"
                      endIcon={<Lucide.ChevronDown />}
                      aria-label="type"
                    >
                      {row.type}
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="start" side="bottom">
                    {TYPES.map((t) => (
                      <DropdownMenu.ItemButton
                        key={t}
                        label={t}
                        active={row.type === t}
                        onSelect={() => {
                          const next = draft.fields.map((r, i) =>
                            i === index ? { ...r, type: t } : r,
                          );
                          patchFields(next);
                        }}
                      />
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu>
                <Button
                  type="button"
                  variant="outlined"
                  colors={{
                    fg: "var(--color-use--danger)",
                    border: "var(--color-use--danger-border)",
                    hoverBg: "var(--color-use--danger-soft)",
                  }}
                  onClick={() => void requestRemove(row)}
                >
                  Remove
                </Button>
              </div>
              <label className={styles.helpField}>
                <span>What is this</span>
                <textarea
                  className={styles.helpInput}
                  value={row.help ?? ""}
                  placeholder="Optional — value rules, when to fill…"
                  rows={2}
                  onChange={(e) => {
                    const next = draft.fields.map((r, i) =>
                      i === index ? { ...r, help: e.target.value } : r,
                    );
                    patchFields(next);
                  }}
                />
              </label>
            </li>
          ))}
        </ul>
      </section>

      <RemoveFieldDialog
        open={pendingRemove !== null}
        fieldLabel={pendingRemove?.label ?? ""}
        fieldKey={pendingRemove?.key ?? ""}
        level="wiki"
        usageCount={pendingRemove?.usageCount ?? 0}
        usageSingular="wiki page"
        usagePlural="wiki pages"
        settingsSurface="Workspace settings"
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove) {
            applyRemove(pendingRemove.key);
          }
        }}
      />
    </div>
  );
}
