/**
 * Labeled action control with optional icons and loading state.
 * Flat `variant` presets; hover feedback via `button__hover-overlay` in styles.module.scss.
 * `selected` raises label/icon to text-prime (orthogonal to variant; not CSS :active).
 * Icon glyphs in `startIcon` / `endIcon` inherit `--button-icon-size` — omit `size` on Lucide icons.
 *
 * ↔ components/member-person — card chrome imports button styles.module.scss directly
 * ↔ lab/pages/button — variant × size × selected matrix
 */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Lucide } from "@/components/ui/lucide";
import styles from "./styles.module.scss";

export type ButtonVariant = "ghost" | "fill" | "outlined" | "fill-inverse";

export type ButtonSize = "small" | "medium" | "large";

/** Optional per-instance color overrides; also used by the demo color lab. */
export type ButtonColorOverrides = {
  fg?: string;
  bg?: string;
  border?: string;
  hoverBg?: string;
  iconFg?: string;
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Selection chrome: prime label color. Not press `:active`. */
  selected?: boolean;
  loading?: boolean;
  colors?: ButtonColorOverrides;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  children?: ReactNode;
};

function colorStyle(colors?: ButtonColorOverrides): CSSProperties | undefined {
  if (!colors) return undefined;

  return {
    ...(colors.fg ? { "--button-fg": colors.fg } : {}),
    ...(colors.bg ? { "--button-bg": colors.bg } : {}),
    ...(colors.border ? { "--button-border": colors.border } : {}),
    ...(colors.hoverBg ? { "--button-hover-bg": colors.hoverBg } : {}),
    ...(colors.iconFg ? { "--button-icon-fg": colors.iconFg } : {}),
  } as CSSProperties;
}

export function Button({
  variant = "outlined",
  size = "medium",
  selected = false,
  loading = false,
  disabled,
  className,
  colors,
  style,
  startIcon,
  endIcon,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const showOutline = variant === "outlined";

  const hasLabel = children != null && children !== false && children !== "";
  const resolvedStartIcon = loading ? (
    <Lucide.LoaderCircle aria-hidden />
  ) : (
    startIcon
  );

  return (
    <button
      type={type}
      className={[styles["button"], className].filter(Boolean).join(" ")}
      style={{ ...colorStyle(colors), ...style }}
      disabled={isDisabled}
      aria-busy={loading ? "true" : "false"}
      data-variant={variant}
      data-size={size}
      data-selected={selected ? "true" : "false"}
      data-loading={loading ? "true" : "false"}
      {...props}
    >
      {!isDisabled ? (
        <span className={styles["button__hover-overlay"]} aria-hidden />
      ) : null}
      {resolvedStartIcon ? (
        <span className={styles["button__icon-container"]}>{resolvedStartIcon}</span>
      ) : null}
      {hasLabel ? (
        <span className={styles["button__text-container"]}>
          <span className={styles["button__label"]}>{children}</span>
        </span>
      ) : null}
      {endIcon && !loading ? (
        <span className={styles["button__icon-container"]}>{endIcon}</span>
      ) : null}
      {showOutline ? (
        <span className={styles["button__outline-border"]} aria-hidden />
      ) : null}
    </button>
  );
}
