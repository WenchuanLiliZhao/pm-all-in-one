import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { getPm, isWebPm } from "@/lib/bridge";
import { useWorkspace } from "@/lib/workspace/workspace-context";
import styles from "./styles.module.scss";

export function Content() {
  const {
    booting,
    error,
    setError,
    openCreateWizard,
    openDialog,
  } = useWorkspace();
  const web = isWebPm();
  const showLabLink = import.meta.env.DEV;

  const openLab = () => {
    void getPm().openUiLab();
  };

  if (booting) {
    return (
      <main className={styles.root}>
        <div className={styles.card}>
          <p className={styles.lead}>
            {web ? "Opening server workspace…" : "Restoring workspace…"}
          </p>
        </div>
      </main>
    );
  }

  if (web) {
    return (
      <main className={styles.root}>
        <div className={styles.card}>
          <h1>Workspace</h1>
          <p className={styles.lead}>
            Web mode loads a fixed workspace from the local API server
            (<code>LOCAL_PM_WORKSPACE</code>). Start with{" "}
            <code>npm run dev:web</code>.
          </p>

          {error ? (
            <Banner tone="error" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          ) : (
            <p className={styles.hint}>
              No workspace loaded. Check that the API is running on port 8787
              and the path is a valid workspace.
            </p>
          )}

          {showLabLink ? (
            <p className={styles.hint}>
              <Button type="button" variant="ghost" onClick={openLab}>
                UI Lab
              </Button>{" "}
              (dev only)
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.root}>
      <div className={styles.card}>
        <h1>Workspace</h1>
        <p className={styles.lead}>
          Create or open a local folder as your offline issue workspace.
        </p>

        {error ? (
          <Banner tone="error" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        ) : null}

        <div className={styles.actions}>
          <Button type="button" variant="fill" onClick={() => openCreateWizard()}>
            New Workspace…
          </Button>
          <Button type="button" variant="outlined" onClick={() => void openDialog()}>
            Open Workspace…
          </Button>
        </div>

        <p className={styles.hint}>
          Also under <strong>File</strong> → New Workspace / Open Workspace /
          Open Recent. Open needs <code>issue-hierarchy/</code> and{" "}
          <code>.pm/</code>.
        </p>

        {showLabLink ? (
          <p className={styles.hint}>
            <Button type="button" variant="ghost" onClick={openLab}>
              UI Lab
            </Button>{" "}
            (dev only)
          </p>
        ) : null}
      </div>
    </main>
  );
}
