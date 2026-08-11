/**
 * Built-in issue status → Lucide glyph + shared tone.
 * ↔ ../issue-priority/icon.tsx — sibling field chrome (priority)
 * ↔ ./tone.module.scss — color SoT for data-status
 * ↔ src/lib/issue-status.ts — ids / BUILTIN labels
 */

import type { ReactElement } from "react";
import { Lucide } from "@/components/ui/lucide";
import {
  BUILTIN_ISSUE_STATUSES,
  type IssueStatusId,
} from "@/lib/issue-status";
import iconStyles from "./icon.module.scss";
import toneStyles from "./tone.module.scss";

const ICON_SIZE = 16;

export function issueStatusLabel(status: IssueStatusId): string {
  return (
    BUILTIN_ISSUE_STATUSES.find((s) => s.id === status)?.label ?? status
  );
}

export function issueStatusIcon(status: IssueStatusId): ReactElement {
  const label = issueStatusLabel(status);
  const common = {
    size: ICON_SIZE,
    className: `${iconStyles.icon} ${toneStyles.tone}`,
    "data-status": status,
    "aria-hidden": true as const,
  };

  let glyph: ReactElement;
  switch (status) {
    case "draft":
      glyph = <Lucide.CircleDashed {...common} />;
      break;
    case "todo":
      glyph = <Lucide.Circle {...common} />;
      break;
    case "in-progress":
      glyph = <Lucide.CircleDot {...common} />;
      break;
    case "done":
      glyph = <Lucide.CircleCheckBig {...common} />;
      break;
    case "cancel":
      glyph = <Lucide.CircleOff {...common} />;
      break;
    default: {
      const _exhaustive: never = status;
      void _exhaustive;
      glyph = <Lucide.Circle {...common} />;
    }
  }

  return (
    <span className={iconStyles.wrap} title={label}>
      {glyph}
    </span>
  );
}
