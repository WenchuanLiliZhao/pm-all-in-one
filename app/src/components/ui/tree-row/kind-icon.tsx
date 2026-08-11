/**
 * Level → Lucide glyph for ticket directory rows (project / epic / task / subtask).
 */
import type { ReactElement } from "react";
import { Lucide } from "@/components/ui/lucide";

export type IssueKindKey = "project" | "epic" | "task" | "subtask";

const ICON_SIZE = 18;

export function issueKindKey(
  kind: "project" | "issue",
  level?: string | null,
): IssueKindKey {
  if (kind === "project") {
    return "project";
  }
  if (level === "epic" || level === "task" || level === "subtask") {
    return level;
  }
  return "subtask";
}

export function issueKindIcon(kind: IssueKindKey | string): ReactElement {
  switch (kind) {
    case "project":
      return <Lucide.Folder size={ICON_SIZE} aria-hidden />;
    case "epic":
      return <Lucide.Music size={ICON_SIZE} aria-hidden />;
    case "task":
      return <Lucide.Layers size={ICON_SIZE} aria-hidden />;
    case "subtask":
    default:
      return <Lucide.FileText size={ICON_SIZE} aria-hidden />;
  }
}
