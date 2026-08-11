/**
 * Wiki All pages inventory table.
 *
 * Hosted under WikiShell with `contentWidth="full"` so the reading-width cap
 * is off and this root fills the main column; `.tableWrap` owns overflow.
 *
 * ↔ components/wiki-shell — `contentWidth="full"` → PageWidth full + `.mainBodyFull`
 * ↔ components/ui/page-width — column SoT
 * ↔ components/wiki-shell/styles.module.scss — `.mainFull` / `.mainBodyFull`
 * ↔ pages/channels/workspace-page/route.tsx — `WikiAllPagesView`
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TypeConfirmDialog } from "@/components/type-confirm-dialog";
import { getPm } from "@/lib/bridge";
import type { WikiNodeMeta } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace/workspace-context";
import { useWiki } from "@/lib/workspace/wiki-context";
import styles from "./styles.module.scss";

type SortKey = "title" | "id" | "updated" | "created";

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function WikiAllPages() {
  const navigate = useNavigate();
  const { createWikiNode } = useWorkspace();
  const { wiki, refresh, error: wikiError } = useWiki();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    detail: string[];
  } | null>(null);

  const rows = useMemo(() => {
    const nodes = wiki?.nodes ?? [];
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? nodes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q),
        )
      : nodes.slice();

    const dir = sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "id":
          cmp = a.id.localeCompare(b.id);
          break;
        case "updated":
          cmp = a.updated.localeCompare(b.updated);
          break;
        case "created":
          cmp = a.created.localeCompare(b.created);
          break;
      }
      return cmp * dir;
    });
    return filtered;
  }, [wiki?.nodes, filter, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" || key === "id" ? "asc" : "desc");
    }
  };

  const sortMark = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const onNew = async () => {
    await createWikiNode();
  };

  const onDelete = (node: WikiNodeMeta) => {
    setPendingDelete({
      id: node.id,
      detail: [
        "This cannot be undone.",
        "It will also be removed from Contents (nested Contents items are promoted).",
      ],
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    const { id } = pendingDelete;
    setPendingDelete(null);
    try {
      await getPm().deleteWikiNode(id, { removeFile: true });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const displayError = error ?? wikiError;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>All pages</h1>
          <p className={styles.sub}>
            Every wiki-node in this workspace. Every page is also in Contents —
            Delete removes the disk directory {"wiki/<id>/"} and its Contents
            entry.
          </p>
        </div>
        <Button
          type="button"
          variant="fill"
          className={styles.headerAction}
          onClick={() => void onNew()}
        >
          New page
        </Button>
      </div>

      <div className={styles.toolbar}>
        <Input
          className={styles.filter}
          type="search"
          placeholder="Filter by title or id…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className={styles.count}>
          {rows.length}
          {wiki ? ` / ${wiki.nodes.length}` : ""} pages
        </span>
      </div>

      {displayError ? <p className={styles.error}>{displayError}</p> : null}

      {!wiki ? (
        <p className={styles.empty}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>
          {filter.trim()
            ? "No pages match this filter."
            : "No pages yet. Create one with New page."}
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <button type="button" onClick={() => onSort("title")}>
                    Title{sortMark("title")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => onSort("id")}>
                    Id{sortMark("id")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => onSort("updated")}>
                    Updated{sortMark("updated")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => onSort("created")}>
                    Created{sortMark("created")}
                  </button>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((node) => (
                <tr key={node.id}>
                  <td>
                    <Link
                      className={styles.titleLink}
                      to={`/w/wiki/${node.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/w/wiki/${node.id}`);
                      }}
                    >
                      {node.title}
                    </Link>
                    {node.description ? (
                      <div className={styles.description}>{node.description}</div>
                    ) : (
                      <div className={styles.descriptionEmpty}>No description</div>
                    )}
                  </td>
                  <td>
                    <code className={styles.id}>{node.id}</code>
                  </td>
                  <td className={styles.ts}>{formatTs(node.updated)}</td>
                  <td className={styles.ts}>{formatTs(node.created)}</td>
                  <td className={styles.actions}>
                    <Button
                      type="button"
                      variant="outlined"
                      size="small"
                      colors={{
                        fg: "var(--color-use--danger)",
                        border: "var(--color-use--danger-border)",
                        hoverBg: "var(--color-use--danger-soft)",
                      }}
                      title="Delete page"
                      onClick={() => onDelete(node)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <TypeConfirmDialog
        open={pendingDelete !== null}
        title="Delete wiki page?"
        lead={
          <>
            Delete disk directory <code>wiki/{pendingDelete?.id}/</code>{" "}
            permanently?
          </>
        }
        detail={pendingDelete?.detail}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
