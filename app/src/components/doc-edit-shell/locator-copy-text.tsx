/**
 * Click-to-copy AI locator as a ghost button (ellipsis when compressed).
 * Replaces labeled “Copy for AI” on article / detail nav.
 *
 * ↔ @pm-core/identity/ai-locator — formatAiLocator
 * ↔ components/ui/button — ghost / small chrome + hover overlay
 * ↔ dogfood @wiki-6wChU3UIot-alcGXrfHUI — node page / panel left chrome
 */
import {
  formatAiLocator,
  type AiLocatorInput,
} from "@/lib/ai-locator";
import { useToast } from "@/lib/toast";
import buttonStyles from "@/components/ui/button/styles.module.scss";
import styles from "./locator-copy-text.module.scss";

export type LocatorCopyTextProps = {
  locator: AiLocatorInput;
  className?: string;
};

export function LocatorCopyText({ locator, className }: LocatorCopyTextProps) {
  const { showToast } = useToast();
  const text = formatAiLocator(locator);

  const onClick = () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(text);
        showToast({ message: "Copied mention" });
      } catch (e) {
        showToast({
          message:
            e instanceof Error ? e.message : "Could not copy to clipboard",
        });
      }
    })();
  };

  return (
    <button
      type="button"
      className={[buttonStyles.button, styles.locator, className]
        .filter(Boolean)
        .join(" ")}
      data-variant="ghost"
      data-size="small"
      onClick={onClick}
      title={`Copy ${text}`}
      aria-label={`Copy locator ${text}`}
    >
      <span className={buttonStyles["button__hover-overlay"]} aria-hidden />
      <span
        className={[
          buttonStyles["button__text-container"],
          styles.textContainer,
        ].join(" ")}
      >
        <span
          className={[buttonStyles["button__label"], styles.text].join(" ")}
        >
          {text}
        </span>
      </span>
    </button>
  );
}
