import { useEffect, useMemo, useState } from "react";
import { getPm } from "@/lib/bridge";
import { slugifyWorkspaceFolder } from "@/lib/workspace/slugify-folder";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./styles.module.scss";

export interface CreateWorkspaceWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  createWorkspace: (input: {
    parentDir: string;
    folderName: string;
    title: string;
  }) => Promise<void>;
}

export function CreateWorkspaceWizard({
  open,
  onClose,
  onCreated,
  createWorkspace,
}: CreateWorkspaceWizardProps) {
  const [title, setTitle] = useState("My Workspace");
  const [parentDir, setParentDir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const folderName = useMemo(
    () => slugifyWorkspaceFolder(title),
    [title],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle("My Workspace");
    setParentDir("");
    setError(null);
    setBusy(false);
  }, [open]);

  // Avoid getPm() while closed — a stripped issue link can open a non-Electron
  // window where preload (window.pm) is missing.
  const sep =
    (window as Window & { pm?: { platform?: string } }).pm?.platform === "win32"
      ? "\\"
      : "/";
  const previewPath = useMemo(() => {
    if (!parentDir || !folderName) {
      return "";
    }
    return `${parentDir.replace(/[/\\]+$/, "")}${sep}${folderName}`;
  }, [parentDir, folderName, sep]);

  if (!open) {
    return null;
  }

  const browse = async () => {
    setError(null);
    try {
      const dir = await getPm().pickDirectory("Choose parent folder");
      if (dir) {
        setParentDir(dir);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submit = async () => {
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Workspace title is required.");
      return;
    }
    if (!parentDir) {
      setError("Choose a parent folder.");
      return;
    }
    setBusy(true);
    try {
      await createWorkspace({
        parentDir,
        folderName,
        title: trimmedTitle,
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-title"
      >
        <h2 id="create-workspace-title">New Workspace</h2>
        <p className={styles.lead}>
          Name the workspace and pick a parent folder. This will create{" "}
          <code>issue-hierarchy/</code> and <code>.pm/</code> inside a new
          folder. Add projects yourself after creation.
        </p>

        {error ? (
          <Banner tone="error" className={styles.error}>
            {error}
          </Banner>
        ) : null}

        <label className={styles.field}>
          <span>Workspace title</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            disabled={busy}
            placeholder="My Workspace"
          />
        </label>

        <p className={styles.hint}>
          Will be created as <code>{folderName}</code>
        </p>

        <label className={styles.field}>
          <span>Parent folder</span>
          <div className={styles.row}>
            <Input
              value={parentDir}
              readOnly
              placeholder="Choose a directory…"
              disabled={busy}
            />
            <Button type="button" variant="outlined" onClick={() => void browse()} disabled={busy}>
              Browse…
            </Button>
          </div>
        </label>

        {previewPath ? (
          <p className={styles.preview}>
            Full path: <code>{previewPath}</code>
          </p>
        ) : null}

        <div className={styles.actions}>
          <Button type="button" variant="outlined" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="fill"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
