import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { REMOVE_FIELD_ACK } from "./field-usage";
import styles from "./remove-field-dialog.module.scss";

type Props = {
  open: boolean;
  fieldLabel: string;
  fieldKey: string;
  level: string;
  usageCount: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RemoveFieldDialog({
  open,
  fieldLabel,
  fieldKey,
  level,
  usageCount,
  onCancel,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setTyped("");
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const canDelete = typed === REMOVE_FIELD_ACK;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-field-title"
      >
        <h2 id="remove-field-title">Remove custom field?</h2>
        <p className={styles.lead}>
          Remove <strong>{fieldLabel}</strong> (<code>{fieldKey}</code>) from{" "}
          <code>{level}</code>?{" "}
          {usageCount === 1
            ? "1 issue of this level still has a saved value for it."
            : `${usageCount} issues of this level still have a saved value for it.`}{" "}
          Those values become orphaned (schema only — data is not auto-cleared).
          This cannot be undone from Project settings.
        </p>
        <label className={styles.ack}>
          <span>
            Type <code>{REMOVE_FIELD_ACK}</code> to enable Delete
          </span>
          <Input
            value={typed}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            aria-label={`Type ${REMOVE_FIELD_ACK} to confirm`}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canDelete) {
                e.preventDefault();
                onConfirm();
              }
            }}
          />
        </label>
        <div className={styles.actions}>
          <Button type="button" variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outlined"
            disabled={!canDelete}
            colors={{
              fg: "var(--color-use--danger)",
              border: "var(--color-use--danger-border)",
              hoverBg: "var(--color-use--danger-soft)",
            }}
            onClick={onConfirm}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
