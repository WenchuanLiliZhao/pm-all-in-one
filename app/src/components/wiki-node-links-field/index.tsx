/**
 * Multi-select of wiki-nodes for `type: "wiki-node"` custom fields.
 * Pattern follows issue blockedBy chips + Add dropdown.
 */
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Lucide } from "@/components/ui/lucide";
import type { WikiNodeMeta } from "@/lib/types";
import styles from "./styles.module.scss";

export function wikiNodeFieldIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
}

type Props = {
  ids: readonly string[];
  wikiNodes: readonly WikiNodeMeta[];
  disabled?: boolean;
  listAriaLabel: string;
  addAriaLabel: string;
  onOpen: (wikiNodeId: string) => void;
  onChange: (ids: string[]) => void;
};

export function WikiNodeLinksField({
  ids,
  wikiNodes,
  disabled = false,
  listAriaLabel,
  addAriaLabel,
  onOpen,
  onChange,
}: Props) {
  const byId = new Map(wikiNodes.map((n) => [n.id, n]));
  const selected = new Set(ids);
  const candidates = wikiNodes
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title));

  const toggle = (id: string, isSelected: boolean) => {
    if (isSelected) {
      onChange(ids.filter((x) => x !== id));
      return;
    }
    onChange([...ids, id]);
  };

  return (
    <div className={styles.stack}>
      {ids.length > 0 ? (
        <ul className={styles.list} aria-label={listAriaLabel}>
          {ids.map((id) => {
            const hit = byId.get(id);
            const title = hit?.title?.trim() || id;
            return (
              <li key={id} className={styles.row}>
                <button
                  type="button"
                  className={styles.rowLink}
                  title={hit ? `Open ${title}` : id}
                  disabled={!hit}
                  onClick={() => {
                    if (!hit) {
                      return;
                    }
                    onOpen(id);
                  }}
                >
                  <span className={styles.title}>{title}</span>
                </button>
                <button
                  type="button"
                  className={styles.rowRemove}
                  aria-label={`Remove ${title}`}
                  disabled={disabled}
                  onClick={() => onChange(ids.filter((x) => x !== id))}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <DropdownMenu
        filter={{ placeholder: "Search wiki pages…" }}
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
            className={styles.add}
          >
            Add
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" side="bottom">
          {candidates.length === 0 ? (
            <DropdownMenu.Label>No wiki pages</DropdownMenu.Label>
          ) : (
            candidates.map((c) => {
              const isOn = selected.has(c.id);
              const label = c.title.trim() || c.id;
              return (
                <DropdownMenu.ItemButton
                  key={c.id}
                  label={label}
                  active={isOn}
                  onSelect={() => toggle(c.id, isOn)}
                />
              );
            })
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}
