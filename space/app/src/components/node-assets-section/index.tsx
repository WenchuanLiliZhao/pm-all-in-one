import { useCallback, useEffect, useState } from "react";
import { getPm, isWebPm } from "@/lib/bridge";
import type { NodeRef } from "@/lib/bridge/pm-api";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import styles from "./styles.module.scss";

interface NodeAssetsSectionProps {
  nodeRef: NodeRef;
}

export function NodeAssetsSection({ nodeRef }: NodeAssetsSectionProps) {
  const [names, setNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refKey = nodeRefKey(nodeRef);

  const refresh = useCallback(async () => {
    try {
      const next = await getPm().listNodeAssets(nodeRef);
      setNames(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [nodeRef]);

  useEffect(() => {
    if (isWebPm()) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await getPm().listNodeAssets(nodeRef);
        if (!cancelled) {
          setNames(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // refKey tracks selection identity; inline nodeRef objects change each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [refKey]);

  if (isWebPm()) {
    return null;
  }

  async function onAdd() {
    setBusy(true);
    setError(null);
    try {
      await getPm().addNodeAssets(nodeRef);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReveal() {
    setError(null);
    try {
      const dir = await getPm().getNodeAssetsDir(nodeRef);
      if (!dir) {
        return;
      }
      await getPm().revealPath(dir);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Assets</h2>
        <div className={styles.actions}>
          {names.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void onReveal()}
            >
              Reveal
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outlined"
            disabled={busy}
            onClick={() => void onAdd()}
          >
            {busy ? "Adding…" : "Add"}
          </Button>
        </div>
      </div>
      <p className={styles.hint}>
        Files live in this node&apos;s <code>assets/</code> folder. Inserting into
        Markdown comes later.
      </p>
      {error ? (
        <Banner tone="error" className={styles.error}>
          {error}
        </Banner>
      ) : null}
      {names.length === 0 ? (
        <p className={styles.empty}>No assets yet.</p>
      ) : (
        <ul className={styles.list}>
          {names.map((name) => (
            <li key={name} className={styles.item}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function nodeRefKey(ref: NodeRef): string {
  switch (ref.kind) {
    case "workspace":
      return "workspace";
    case "project":
      return `project:${ref.projectId}`;
    case "issue":
      return `issue:${ref.projectId}::${ref.issueId}`;
    case "wiki":
      return `wiki:${ref.wikiNodeId}`;
    case "member":
      return `member:${ref.memberId}`;
    case "handoff":
      return `handoff:${ref.handoffId}`;
  }
}
