import { useEffect, useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./styles.module.scss";

/** Type-to-confirm phrase for irreversible destructive actions. */
export const DANGEROUS_ACK = "I know what I am doing";

type Props = {
  open: boolean;
  title: string;
  lead: ReactNode;
  detail?: string[];
  onCancel: () => void;
  onConfirm: () => void;
};

export function TypeConfirmDialog({
  open,
  title,
  lead,
  detail,
  onCancel,
  onConfirm,
}: Props) {
  const titleId = useId();
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

  const canDelete = typed === DANGEROUS_ACK;
  const details = detail?.filter((line) => line.trim().length > 0) ?? [];

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
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{title}</h2>
        <p className={styles.lead}>{lead}</p>
        {details.length > 0 ? (
          <ul className={styles.detail}>
            {details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <label className={styles.ack}>
          <span>
            Type <code>{DANGEROUS_ACK}</code> to enable Delete
          </span>
          <Input
            value={typed}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            aria-label={`Type ${DANGEROUS_ACK} to confirm`}
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
