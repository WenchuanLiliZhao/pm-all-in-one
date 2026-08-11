import { useCallback, useEffect, useState } from "react";
import type {
  CustomPropDef,
  CustomPropsSchema,
  IssueLevel,
  MetaFieldType,
} from "@/lib/types";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Lucide } from "@/components/ui/lucide";
import { getPm } from "@/lib/bridge";
import { useWorkspace } from "@/lib/workspace/workspace-context";
import { useActiveSaveHost } from "@/lib/workspace/use-active-save-host";
import { useDiscardLeaveGuard } from "@/lib/workspace/use-discard-leave-guard";
import { countFieldUsage } from "./field-usage";
import { RemoveFieldDialog } from "./remove-field-dialog";
import styles from "./styles.module.scss";

const TYPES: MetaFieldType[] = ["string", "number", "boolean", "date", "markdown"];
const LEVELS = ["epic", "task", "subtask"] as const;

interface CustomPropsEditorProps {
  projectId: string;
  load: (projectId: string) => Promise<CustomPropsSchema>;
  save: (projectId: string, schema: CustomPropsSchema) => Promise<void>;
}

function newKey(level: string, n: number): string {
  return `${level}Field${n}`;
}

function normalizeSchema(schema: CustomPropsSchema): CustomPropsSchema {
  const scrub = (defs: CustomPropDef[]): CustomPropDef[] =>
    defs.map((def) => {
      const help = def.help?.trim();
      if (!help) {
        const { help: _drop, ...rest } = def;
        return rest;
      }
      return { ...def, help };
    });
  return {
    epic: scrub(schema.epic),
    task: scrub(schema.task),
    subtask: scrub(schema.subtask),
  };
}

type PendingRemove = {
  level: IssueLevel;
  key: string;
  label: string;
  usageCount: number;
};

export function CustomPropsEditor({
  projectId,
  load,
  save,
}: CustomPropsEditorProps) {
  const { issues } = useWorkspace();
  const [draft, setDraft] = useState<CustomPropsSchema>({
    epic: [],
    task: [],
    subtask: [],
  });
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
        const schema = await load(projectId);
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
  }, [projectId, load]);

  const handleSave = useCallback(async () => {
    if (!dirty) {
      return true;
    }
    setSaving(true);
    setError(null);
    try {
      const cleaned = normalizeSchema(draft);
      await save(projectId, cleaned);
      setDraft(cleaned);
      setDirty(false);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [projectId, dirty, draft, save]);

  const saveHostHasUnsaved = useCallback(() => dirty || saving, [dirty, saving]);
  useActiveSaveHost({
    save: handleSave,
    hasUnsaved: saveHostHasUnsaved,
    promptBeforeUnload: true,
  });
  useDiscardLeaveGuard({
    when: dirty,
    onDiscard: () => {
      setDirty(false);
    },
    title: "Discard unsaved custom props?",
    message: "You have unsaved custom field changes. Leave and discard them?",
  });

  function patchLevel(
    level: (typeof LEVELS)[number],
    next: CustomPropDef[],
  ) {
    setDraft((d) => ({ ...d, [level]: next }));
    setDirty(true);
  }

  const applyRemove = (level: IssueLevel, key: string) => {
    setDraft((d) => ({
      ...d,
      [level]: d[level].filter((r) => r.key !== key),
    }));
    setDirty(true);
    setPendingRemove(null);
  };

  const requestRemove = async (
    level: IssueLevel,
    row: CustomPropDef,
  ) => {
    const usageCount = countFieldUsage(issues, projectId, level, row.key);
    if (usageCount === 0) {
      const ok = await getPm().confirmDangerous({
        title: "Remove custom field?",
        message: `Remove "${row.label}" (${row.key}) from ${level}?`,
        detail:
          "No issues of this level currently store a value for this field. Save props to write the schema.",
      });
      if (ok) {
        applyRemove(level, row.key);
      }
      return;
    }
    setPendingRemove({
      level,
      key: row.key,
      label: row.label,
      usageCount,
    });
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Custom fields</h2>
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
        Per-level fields for epic / task / subtask in this project (
        <code>custom-props.ts</code>). Optional “What is this” describes the
        field contract for people and AI.
      </p>

      {error ? (
        <Banner tone="error" className={styles.error}>
          {error}
        </Banner>
      ) : null}

      {LEVELS.map((level) => (
        <section key={level} className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>{level}</h3>
            <Button
              type="button"
              variant="outlined"
              onClick={() =>
                patchLevel(level, [
                  ...draft[level],
                  {
                    key: newKey(level, draft[level].length + 1),
                    label: `Field ${draft[level].length + 1}`,
                    type: "string",
                  },
                ])
              }
            >
              + Field
            </Button>
          </div>
          <ul className={styles.rowList}>
            {draft[level].length === 0 ? (
              <li className={styles.empty}>No fields</li>
            ) : null}
            {draft[level].map((row, index) => (
              <li key={`${level}-${row.key}-${index}`} className={styles.row}>
                <div className={styles.rowMain}>
                  <Input
                    value={row.label}
                    placeholder="label"
                    aria-label="label"
                    onChange={(e) => {
                      const next = draft[level].map((r, i) =>
                        i === index ? { ...r, label: e.target.value } : r,
                      );
                      patchLevel(level, next);
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
                            const next = draft[level].map((r, i) =>
                              i === index ? { ...r, type: t } : r,
                            );
                            patchLevel(level, next);
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
                    onClick={() => void requestRemove(level, row)}
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
                      const next = draft[level].map((r, i) =>
                        i === index ? { ...r, help: e.target.value } : r,
                      );
                      patchLevel(level, next);
                    }}
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <RemoveFieldDialog
        open={pendingRemove !== null}
        fieldLabel={pendingRemove?.label ?? ""}
        fieldKey={pendingRemove?.key ?? ""}
        level={pendingRemove?.level ?? ""}
        usageCount={pendingRemove?.usageCount ?? 0}
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => {
          if (pendingRemove) {
            applyRemove(pendingRemove.level, pendingRemove.key);
          }
        }}
      />
    </div>
  );
}
