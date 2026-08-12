/**
 * ··· overflow for DocEditNav primary actions.
 *
 * Hosts low-frequency actions as icon+label ItemButtons. Today: optional Add
 * child / Add epic, and Delete. More items (archive, duplicate, move, …) should
 * land here later — do not promote them to top-level icon chrome without
 * product intent.
 *
 * ↔ doc-edit-nav.tsx — right-side actions host
 * ↔ dogfood @wiki-6wChU3UIot-alcGXrfHUI — article / panel nav chrome
 */
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Lucide } from "@/components/ui/lucide";
import styles from "./doc-edit-overflow-menu.module.scss";

export type DocEditOverflowMenuProps = {
  /** e.g. "Add task" / "Add subtask" / "Add epic" — omitted when unavailable. */
  addChild?: { label: string; onSelect: () => void };
  /** When omitted, Delete is hidden. */
  onDelete?: () => void;
};

export function DocEditOverflowMenu({
  addChild,
  onDelete,
}: DocEditOverflowMenuProps) {
  if (!addChild && !onDelete) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="small"
          startIcon={<Lucide.Ellipsis aria-hidden />}
          aria-label="More actions"
          title="More"
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" side="bottom">
        {/* Overflow items — append more ItemButtons here later. */}
        {addChild ? (
          <DropdownMenu.ItemButton
            label={addChild.label}
            icon={<Lucide.Plus size={16} aria-hidden />}
            onSelect={addChild.onSelect}
          />
        ) : null}
        {onDelete ? (
          <DropdownMenu.ItemButton
            label="Delete"
            icon={<Lucide.Trash2 size={16} aria-hidden />}
            className={styles.dangerItem}
            onSelect={onDelete}
          />
        ) : null}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
