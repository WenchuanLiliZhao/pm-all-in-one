import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import styles from "./styles.module.scss";

export type BorderlessTitleProps = {
  value: string;
  onChange: (next: string) => void;
  /** Enter → focus body (host decides; no save). Soft-wrap only — no hard newlines. */
  onEnter: () => void;
  /** Optional blur of the title field (no longer a save trigger). */
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Main column vs sidebar density. */
  size?: "page" | "sidebar";
  className?: string;
  "aria-label"?: string;
};

function stripNewlines(raw: string): string {
  return raw.replace(/[\r\n]+/g, " ");
}

function syncHeight(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export const BorderlessTitle = forwardRef<
  HTMLTextAreaElement,
  BorderlessTitleProps
>(function BorderlessTitle(
  {
    value,
    onChange,
    onEnter,
    onBlur,
    placeholder = "Untitled",
    disabled,
    size = "page",
    className,
    "aria-label": ariaLabel = "Title",
  },
  ref,
) {
  const composingRef = useRef(false);
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  function setRefs(node: HTMLTextAreaElement | null) {
    localRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }

  useLayoutEffect(() => {
    const el = localRef.current;
    if (el) {
      syncHeight(el);
    }
  }, [value, size]);

  useEffect(() => {
    const el = localRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const parent = el.parentElement;
    if (!parent) {
      return;
    }
    const ro = new ResizeObserver(() => {
      syncHeight(el);
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") {
      return;
    }
    if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    e.preventDefault();
    if (disabled) {
      return;
    }
    onEnter();
  }

  return (
    <textarea
      ref={setRefs}
      rows={1}
      className={[
        styles.titleInput,
        size === "sidebar" ? styles.titleSidebar : styles.titlePage,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(stripNewlines(e.target.value))}
      onBlur={() => onBlur?.()}
      onKeyDown={onKeyDown}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
      }}
    />
  );
});
