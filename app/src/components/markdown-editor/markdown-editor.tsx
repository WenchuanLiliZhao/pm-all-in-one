// ↔ markdown-cm-view.tsx — Live CodeMirror host
// ↔ types.ts — MarkdownEditorProps / mode / variant / handle
// ↔ styles.module.scss — chrome label header + borderless shell
// ↔ AGENTS.md — UI always Live; mode props retained (temporarily unused)

import { useImperativeHandle, useRef } from "react";
import { MarkdownCmView, type MarkdownCmViewHandle } from "./markdown-cm-view";
import type { MarkdownEditorProps } from "./types";
import styles from "./styles.module.scss";

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  defaultMode = "live",
  variant = "chrome",
  editorRef,
  onNavigateOutAtStart,
  onBlur,
  plugins,
  className,
  rows = 12,
  label,
  autoPair = true,
  mentionAutocomplete,
}: MarkdownEditorProps) {
  // Mode props stay on the public contract; UI is temporarily locked to Live.
  void defaultMode;
  void plugins; // Reading View / Preview path paused with mode switching

  const borderless = variant === "borderless";
  const cmRef = useRef<MarkdownCmViewHandle | null>(null);
  const minHeightPx = Math.max(120, rows * 18);

  useImperativeHandle(
    editorRef,
    () => ({
      focus: (opts) => {
        cmRef.current?.focus(opts);
      },
    }),
    [],
  );

  return (
    <div
      className={[
        styles.root,
        borderless ? styles.rootBorderless : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-variant={variant}
      onBlur={(e) => {
        if (!onBlur) {
          return;
        }
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) {
          return;
        }
        onBlur();
      }}
    >
      {!borderless ? (
        <div className={styles.header}>
          <span>{label ?? "Markdown"}</span>
        </div>
      ) : null}
      <MarkdownCmView
        handleRef={cmRef}
        className={borderless ? styles.cmShellBorderless : styles.cmShell}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        live
        autoPair={autoPair}
        mentionAutocomplete={mentionAutocomplete}
        minHeightPx={minHeightPx}
        borderless={borderless}
        onNavigateOutAtStart={onNavigateOutAtStart}
      />
    </div>
  );
}
