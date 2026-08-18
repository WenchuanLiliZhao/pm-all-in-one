import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import styles from "./styles.module.scss";

export type ToastInput = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

type ToastItem = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const durationMs = input.durationMs ?? 6000;
      setItems((prev) => [
        ...prev,
        {
          id,
          message: input.message,
          actionLabel: input.actionLabel,
          onAction: input.onAction,
        },
      ]);
      timers.current.set(
        id,
        setTimeout(() => {
          dismiss(id);
        }, durationMs),
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  const stack = (
    <div className={styles.stack} aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={styles.toast} role="status">
          <span className={styles.message}>{item.message}</span>
          {item.actionLabel && item.onAction ? (
            <Button
              type="button"
              variant="ghost"
              className={styles.action}
              onClick={() => {
                item.onAction?.();
                dismiss(item.id);
              }}
            >
              {item.actionLabel}
            </Button>
          ) : null}
          <button
            type="button"
            className={styles.dismiss}
            aria-label="Dismiss"
            onClick={() => dismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(stack, document.body)}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
