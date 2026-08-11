import { forwardRef, type TextareaHTMLAttributes } from "react";
import styles from "./styles.module.scss";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, ...rest }, ref) {
    const merged = [styles.field, className].filter(Boolean).join(" ");
    return <textarea ref={ref} className={merged} {...rest} />;
  },
);
