/**
 * Built-in issue priority → Lucide glyph + shared tone.
 * ↔ ../issue-status/icon.tsx — sibling field chrome (status)
 * ↔ ./tone.module.scss — color SoT for data-priority
 * ↔ src/lib/issue-priority.ts — ids / labels
 */

import type { ReactElement } from "react";
import { Lucide } from "@/components/ui/lucide";
import {
  issuePriorityLabel as catalogLabel,
  type IssuePriorityId,
} from "@/lib/issue-priority";
import iconStyles from "./icon.module.scss";
import toneStyles from "./tone.module.scss";

const ICON_SIZE = 16;

/** UI re-export of catalog label (one import path for views). */
export function issuePriorityLabel(id: IssuePriorityId): string {
  return catalogLabel(id);
}

export function issuePriorityIcon(priority: IssuePriorityId): ReactElement {
  const label = issuePriorityLabel(priority);
  const common = {
    size: ICON_SIZE,
    className: `${iconStyles.icon} ${toneStyles.tone}`,
    "data-priority": priority,
    "aria-hidden": true as const,
  };

  let glyph: ReactElement;
  switch (priority) {
    case "very-low":
      glyph = <Lucide.ChevronsDown {...common} />;
      break;
    case "low":
      glyph = <Lucide.ChevronDown {...common} />;
      break;
    case "medium":
      glyph = <Lucide.Equal {...common} />;
      break;
    case "high":
      glyph = <Lucide.ChevronUp {...common} />;
      break;
    case "very-high":
      glyph = <Lucide.ChevronsUp {...common} />;
      break;
    default: {
      const _exhaustive: never = priority;
      void _exhaustive;
      glyph = <Lucide.Equal {...common} />;
    }
  }

  return (
    <span className={iconStyles.wrap} title={label}>
      {glyph}
    </span>
  );
}
