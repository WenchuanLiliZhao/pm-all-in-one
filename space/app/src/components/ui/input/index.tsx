import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./styles.module.scss";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, type = "text", ...rest }, ref) {
    const merged = [styles.field, className].filter(Boolean).join(" ");
    return <input ref={ref} type={type} className={merged} {...rest} />;
  },
);
