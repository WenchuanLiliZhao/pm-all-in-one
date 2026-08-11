import { forwardRef, type SelectHTMLAttributes } from "react";
import styles from "./styles.module.scss";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, children, ...rest }, ref) {
    const merged = [styles.field, className].filter(Boolean).join(" ");
    return (
      <select ref={ref} className={merged} {...rest}>
        {children}
      </select>
    );
  },
);
