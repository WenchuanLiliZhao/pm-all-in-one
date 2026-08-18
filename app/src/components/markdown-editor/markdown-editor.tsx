// ↔ markdown-cm-view.tsx — Source / Live CodeMirror host
// ↔ markdown-preview.tsx — Preview pane; pass localMedia so assets/ resolve
// ↔ types.ts — MarkdownEditorProps / mode / filename / handle
// ↔ styles.module.scss — bordered shell + sticky filename nav
// ↔ AGENTS.md — chrome + Source/Live/Preview; default Preview

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { MarkdownCmView, type MarkdownCmViewHandle } from "./markdown-cm-view";
import { MarkdownPreview } from "./markdown-preview";
import type { MarkdownEditorMode, MarkdownEditorProps } from "./types";
import styles from "./styles.module.scss";

const MODES: { id: MarkdownEditorMode; label: string }[] = [
  { id: "source", label: "Source" },
  { id: "live", label: "Live" },
  { id: "preview", label: "Preview" },
];

function nearestScrollRoot(el: Element): Element | null {
  let node = el.parentElement;
  while (node && node !== document.documentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay"
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  defaultMode = "preview",
  filename = "README.md",
  editorRef,
  onNavigateOutAtStart,
  onBlur,
  plugins,
  className,
  rows = 12,
  autoPair = true,
  mentionAutocomplete,
  localMedia,
  assetFilenames,
  ingestAssetFiles,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<MarkdownEditorMode>(defaultMode);
  const cmRef = useRef<MarkdownCmViewHandle | null>(null);
  const pendingFocusRef = useRef<{ at?: "start" | "end" } | null>(null);
  const pendingInsertRef = useRef<string | null>(null);
  const minHeightPx = Math.max(120, rows * 18);
  const preview = mode === "preview";
  const sentinelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useImperativeHandle(
    editorRef,
    () => ({
      focus: (opts) => {
        if (mode === "preview") {
          pendingFocusRef.current = opts ?? { at: "start" };
          setMode("live");
          return;
        }
        cmRef.current?.focus(opts);
      },
      insertAtCursor: (text) => {
        if (mode === "preview") {
          pendingInsertRef.current = text;
          setMode("live");
          return;
        }
        cmRef.current?.insertAtCursor(text);
      },
    }),
    [mode],
  );

  useEffect(() => {
    if (mode === "preview") {
      return;
    }
    const focusOpts = pendingFocusRef.current;
    const insert = pendingInsertRef.current;
    pendingFocusRef.current = null;
    pendingInsertRef.current = null;
    if (focusOpts) {
      cmRef.current?.focus(focusOpts);
    }
    if (insert) {
      cmRef.current?.insertAtCursor(insert);
    }
  }, [mode]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const header = headerRef.current;
    if (!sentinel || !header) {
      return;
    }
    const stickyTopPx = Number.parseFloat(getComputedStyle(header).top) || 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setStuck(!entry.isIntersecting);
      },
      {
        root: nearestScrollRoot(header),
        threshold: 0,
        rootMargin: `-${stickyTopPx + 1}px 0px 0px 0px`,
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
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
      <div ref={sentinelRef} className={styles.stickySentinel} aria-hidden />
      <div
        ref={headerRef}
        className={[styles.header, stuck ? styles.headerStuck : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={styles.filename}>{filename}</span>
        <ButtonGroup
          className={styles.modes}
          appearance="flush"
          role="radiogroup"
          aria-label="Editor mode"
        >
          {MODES.map((item) => {
            const active = mode === item.id;
            return (
              <Button
                key={item.id}
                type="button"
                variant={active ? "fill-inverse" : "ghost"}
                size="small"
                selected={active}
                role="radio"
                aria-checked={active}
                onClick={() => setMode(item.id)}
              >
                {item.label}
              </Button>
            );
          })}
        </ButtonGroup>
      </div>
      <div className={styles.body} style={{ minHeight: minHeightPx }}>
        <MarkdownCmView
          handleRef={cmRef}
          className={styles.cmShell}
          hidden={preview}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          live={mode === "live"}
          autoPair={autoPair}
          mentionAutocomplete={mentionAutocomplete}
          localMedia={localMedia}
          assetFilenames={assetFilenames}
          ingestAssetFiles={ingestAssetFiles}
          minHeightPx={minHeightPx}
          onNavigateOutAtStart={onNavigateOutAtStart}
        />
        {preview ? (
          <MarkdownPreview
            source={value}
            plugins={plugins}
            localMedia={localMedia}
            className={styles.previewBody}
          />
        ) : null}
      </div>
    </div>
  );
}
