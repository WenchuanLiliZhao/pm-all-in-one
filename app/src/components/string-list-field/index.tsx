/**
 * Chip editor for `type: "string-list"` custom fields (keywords / aliases).
 */
import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import styles from "./styles.module.scss";

export function stringListFieldValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
}

type Props = {
  values: readonly string[];
  disabled?: boolean;
  listAriaLabel: string;
  addAriaLabel: string;
  placeholder?: string;
  onChange: (values: string[]) => void;
};

function tokensFromInput(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function StringListField({
  values,
  disabled = false,
  listAriaLabel,
  addAriaLabel,
  placeholder = "Add…",
  onChange,
}: Props) {
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const next = [...values];
    const seen = new Set(values);
    for (const token of tokensFromInput(draft)) {
      if (seen.has(token)) {
        continue;
      }
      seen.add(token);
      next.push(token);
    }
    setDraft("");
    if (next.length !== values.length) {
      onChange(next);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addDraft();
    }
  };

  return (
    <div className={styles.stack}>
      {values.length > 0 ? (
        <ul className={styles.list} aria-label={listAriaLabel}>
          {values.map((token) => (
            <li key={token} className={styles.row}>
              <span className={styles.token}>{token}</span>
              <button
                type="button"
                className={styles.rowRemove}
                aria-label={`Remove ${token}`}
                disabled={disabled}
                onClick={() => onChange(values.filter((x) => x !== token))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        size="small"
        value={draft}
        disabled={disabled}
        aria-label={addAriaLabel}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (draft.trim()) {
            addDraft();
          }
        }}
      />
    </div>
  );
}
