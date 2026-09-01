import type { DoctorWarning } from "@/lib/types";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { doctorWarningFixPrompt } from "./doctor-warning-prompt";

type Props = {
  warning: DoctorWarning;
  workspaceRoot: string;
};

export function CopyDoctorPromptButton({ warning, workspaceRoot }: Props) {
  const { showToast } = useToast();

  const onClick = () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(
          doctorWarningFixPrompt(warning, workspaceRoot),
        );
        showToast({ message: "Copied prompt" });
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
      size="small"
      onClick={onClick}
      title="Copy a fix prompt for CLI or another AI"
    >
      Copy prompt
    </Button>
  );
}
