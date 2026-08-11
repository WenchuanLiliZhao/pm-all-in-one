// ↔ markdown-cm-view.tsx — Live / Source CodeMirror host
// ↔ markdown-preview.tsx — Preview Reading View
// ↔ types.ts — MarkdownEditorProps / mode / variant / handle
// ↔ styles.module.scss — borderless ghost mode control
// ↔ AGENTS.md — borderless live↔source + localStorage preference

import { useCallback, useImperativeHandle, useRef, useState } from "react";
import { MarkdownCmView, type MarkdownCmViewHandle } from "./markdown-cm-view";
import { MarkdownPreview } from "./markdown-preview";
import type { MarkdownEditorMode, MarkdownEditorProps } from "./types";
import styles from "./styles.module.scss";

const MODE_CYCLE: MarkdownEditorMode[] = ["live", "source", "preview"];

const MODE_LABEL: Record<MarkdownEditorMode, string> = {
  live: "Live",
  source: "Source",
  preview: "Preview",
};

/** Global borderless Live/Source preference (not product state — see AGENTS.md). */
const BORDERLESS_MODE_KEY = "pm.markdown-editor.borderless-mode";

type BorderlessMode = "live" | "source";

function readBorderlessMode(): BorderlessMode {
  try {
    const v = localStorage.getItem(BORDERLESS_MODE_KEY);
    if (v === "live" || v === "source") return v;
  } catch {
    // privacy mode / storage disabled
  }
  return "live";
}

function writeBorderlessMode(mode: BorderlessMode) {
  try {
    localStorage.setItem(BORDERLESS_MODE_KEY, mode);
  } catch {
    // privacy mode / storage disabled
  }
}

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
  const borderless = variant === "borderless";
  const [mode, setMode] = useState<MarkdownEditorMode>(() =>
    borderless ? readBorderlessMode() : defaultMode,
  );
  const cmRef = useRef<MarkdownCmViewHandle | null>(null);
  const minHeightPx = Math.max(120, rows * 18);
  // borderless never enters preview (Decision 1); chrome uses full three-state mode.
  const effectiveMode = mode;
  const showCm = effectiveMode === "live" || effectiveMode === "source";
  const borderlessModeLabel: BorderlessMode =
    mode === "source" ? "source" : "live";

  useImperativeHandle(
    editorRef,
    () => ({
      focus: (opts) => {
        cmRef.current?.focus(opts);
      },
    }),
    [],
  );

  function cycleMode() {
    if (borderless) {
      return;
    }
    setMode((m) => {
      const i = MODE_CYCLE.indexOf(m);
      return MODE_CYCLE[(i + 1) % MODE_CYCLE.length]!;
    });
  }

  const toggleBorderlessMode = useCallback(() => {
    setMode((m) => {
      const next: BorderlessMode = m === "source" ? "live" : "source";
      writeBorderlessMode(next);
      return next;
    });
  }, []);

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
      {borderless ? (
        <button
          type="button"
          className={styles.borderlessModeGhost}
          onClick={toggleBorderlessMode}
          title="Toggle Live / Source (⌘⇧M / Ctrl+Shift+M)"
        >
          {MODE_LABEL[borderlessModeLabel]}
        </button>
      ) : (
        <div className={styles.header}>
          <span>{label ?? "Markdown"}</span>
          <button
            type="button"
            onClick={cycleMode}
            title="Cycle Live / Source / Preview"
          >
            {MODE_LABEL[mode]}
          </button>
        </div>
      )}
      {effectiveMode === "preview" ? (
        <div className={styles.previewShell} style={{ minHeight: minHeightPx }}>
          <MarkdownPreview source={value} plugins={plugins} />
        </div>
      ) : showCm ? (
        <MarkdownCmView
          handleRef={cmRef}
          className={
            borderless ? styles.cmShellBorderless : styles.cmShell
          }
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          live={effectiveMode === "live"}
          autoPair={autoPair}
          mentionAutocomplete={mentionAutocomplete}
          minHeightPx={minHeightPx}
          borderless={borderless}
          onNavigateOutAtStart={onNavigateOutAtStart}
          onToggleMode={borderless ? toggleBorderlessMode : undefined}
        />
      ) : null}
    </div>
  );
}
