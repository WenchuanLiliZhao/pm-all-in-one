import type { IssueTree } from "@/lib/types";
import {
  applyCollapseLevel,
  expandAllCollapsed,
  type CollapseLevel,
} from "@/lib/tree-collapse";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Lucide } from "@/components/ui/lucide";
import styles from "./styles.module.scss";

const LEVEL_OPTIONS: { value: CollapseLevel; label: string }[] = [
  { value: "task", label: "Collapse tasks" },
  { value: "epic", label: "Collapse epics" },
  { value: "project", label: "Collapse projects" },
];

export interface TreeCollapseControlsProps {
  tree: IssueTree;
  collapsed: ReadonlySet<string>;
  onCollapsedChange: (next: Set<string>) => void;
  disabled?: boolean;
}

export function TreeCollapseControls({
  tree,
  collapsed,
  onCollapsedChange,
  disabled = false,
}: TreeCollapseControlsProps) {
  return (
    <div
      className={styles.root}
      role="group"
      aria-label="Issue tree fold"
    >
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="outlined"
            size="small"
            className={styles.collapseTrigger}
            disabled={disabled}
            endIcon={<Lucide.ChevronDown />}
            aria-label="Collapse by level"
          >
            Collapse…
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" side="bottom">
          {LEVEL_OPTIONS.map((opt) => (
            <DropdownMenu.ItemButton
              key={opt.value}
              label={opt.label}
              onSelect={() =>
                onCollapsedChange(applyCollapseLevel(collapsed, tree, opt.value))
              }
            />
          ))}
        </DropdownMenu.Content>
      </DropdownMenu>
      <Button
        type="button"
        variant="outlined"
        size="small"
        disabled={disabled || collapsed.size === 0}
        onClick={() => onCollapsedChange(expandAllCollapsed())}
      >
        Expand all
      </Button>
    </div>
  );
}
