/**
 * Shared Save / Discard / Cancel leave resolution for explicit-save hosts.
 *
 * ↔ dogfood @wiki-n8_7zg25NlxwdV6nIBVcD — ExplicitDoc leave
 * ↔ src/lib/bridge/pm-api.ts — confirmUnsavedLeave
 * ↔ src/lib/workspace/use-unsaved-leave-guard.ts — RR blocker + beforeunload
 */

import { getPm } from "@/lib/bridge";

export type UnsavedLeaveChoice = "save" | "discard" | "cancel";

export type ResolveUnsavedLeaveOpts = {
  save: () => Promise<boolean>;
  onDiscard?: () => void;
  title?: string;
  message?: string;
  detail?: string;
};

/**
 * Prompt Save / Discard / Cancel. Returns true to proceed with leave,
 * false to stay (Cancel, or Save that failed).
 */
export async function resolveUnsavedLeave(
  opts: ResolveUnsavedLeaveOpts,
): Promise<boolean> {
  const choice = await getPm().confirmUnsavedLeave({
    title: opts.title ?? "Unsaved changes",
    message:
      opts.message ??
      "You have unsaved changes. Save before leaving, discard them, or cancel?",
    detail:
      opts.detail ??
      "Save writes your edits, Discard throws them away, Cancel stays here.",
  });
  if (choice === "cancel") {
    return false;
  }
  if (choice === "discard") {
    opts.onDiscard?.();
    return true;
  }
  return opts.save();
}
