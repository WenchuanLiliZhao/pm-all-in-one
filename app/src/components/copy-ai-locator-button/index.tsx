import {
  formatAiLocator,
  type AiLocatorInput,
} from "@/lib/ai-locator";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

type Props = {
  locator: AiLocatorInput;
};

export function CopyAiLocatorButton({ locator }: Props) {
  const { showToast } = useToast();

  const onClick = () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(formatAiLocator(locator));
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
    <Button
      type="button"
      variant="outlined"
      onClick={onClick}
      title="Copy inline mention for AI"
    >
      Copy for AI
    </Button>
  );
}
