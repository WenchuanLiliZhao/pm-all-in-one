import type { HTMLAttributes, ReactNode } from "react";
import styles from "./styles.module.scss";

export type BannerTone = "error" | "warn" | "success";

export type BannerProps = {
  tone?: BannerTone;
  children: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
} & Omit<HTMLAttributes<HTMLParagraphElement>, "children">;

export function Banner({
  tone = "error",
  children,
  onDismiss,
  dismissLabel = "Dismiss",
  className,
  role = "alert",
  ...rest
}: BannerProps) {
  const merged = [styles.banner, styles[tone], className]
    .filter(Boolean)
    .join(" ");

  return (
    <p className={merged} role={role} {...rest}>
      <span className={styles.body}>{children}</span>
      {onDismiss ? (
        <button
          type="button"
          className={styles.dismiss}
          onClick={onDismiss}
        >
          {dismissLabel}
        </button>
      ) : null}
    </p>
  );
}
