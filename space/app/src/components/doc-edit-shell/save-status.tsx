/**
 * Shared AutosaveDoc save status indicator (no primary Save button).
 * Retry / Conflict remain actionable where needed.
 *
 * ↔ space/handoff/save-leave-contracts.md — AutosaveDoc status UX
 * ↔ space/app/src/lib/workspace/detail-save.ts — DetailSaveStatus
 */
import type { DetailSaveStatus } from "@/lib/workspace/detail-save";
import { Button } from "@/components/ui/button";
import styles from "./save-status.module.scss";

type Props = {
  status: DetailSaveStatus;
  /** Retry after error / explicit flush. */
  onRetry?: () => void;
};

export function SaveStatusIndicator({ status, onRetry }: Props) {
  if (status === "dirty") {
    return (
      <span className={`${styles.saveStatus} ${styles.dirty}`}>Unsaved</span>
    );
  }
  if (status === "saving") {
    return <span className={styles.saveStatus}>Saving…</span>;
  }
  if (status === "saved") {
    return (
      <span className={`${styles.saveStatus} ${styles.ok}`}>Saved</span>
    );
  }
  if (status === "error") {
    if (onRetry) {
      return (
        <Button
          type="button"
          variant="ghost"
          className={`${styles.saveStatus} ${styles.error}`}
          onClick={onRetry}
        >
          Save failed · Retry
        </Button>
      );
    }
    return (
      <span className={`${styles.saveStatus} ${styles.error}`}>Save failed</span>
    );
  }
  if (status === "conflict") {
    return <span className={styles.saveStatus}>Conflict</span>;
  }
  return null;
}
