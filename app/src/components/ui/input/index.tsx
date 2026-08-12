/**
 * Text field. `size="small"` matches Button small for detail-panel props.
 *
 * ↔ components/ui/button — size token twin
 * ↔ components/issue-detail — props Inputs
 * ↔ src/global-styles/seams.md — `detail-prop-controls`
 */
import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./styles.module.scss";

export type InputSize = "small" | "medium";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Default `medium`. Detail panel props use `small`. */
  size?: InputSize;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, type = "text", size = "medium", ...rest }, ref) {
    const merged = [styles.field, className].filter(Boolean).join(" ");
    return (
      <input
        ref={ref}
        type={type}
        className={merged}
        data-size={size}
        {...rest}
      />
    );
  },
);
