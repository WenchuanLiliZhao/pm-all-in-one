import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";

export function DetailConflictBanner({
  conflictPaths,
  onReload,
  onKeep,
}: {
  conflictPaths: string[];
  onReload: () => void;
  onKeep: () => void;
}) {
  if (conflictPaths.length === 0) {
    return null;
  }
  return (
    <Banner tone="warn">
      <span>
        Disk changed while you were editing ({conflictPaths.join(", ")}).
        Reload to take disk, or keep editing and Save to overwrite.
      </span>
      <span style={{ display: "inline-flex", gap: 8, marginLeft: 8 }}>
        <Button type="button" variant="outlined" onClick={onReload}>
          Reload
        </Button>
        <Button type="button" variant="outlined" onClick={onKeep}>
          Keep editing
        </Button>
      </span>
    </Banner>
  );
}
