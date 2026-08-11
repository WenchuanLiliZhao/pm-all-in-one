import type { IssueTree } from "@/lib/types";
import type { Selection } from "@/lib/workspace/workspace-context";
import styles from "../styles.module.scss";

export function TreeNodeView({
  nodeKey,
  depth,
  tree,
  selection,
  onSelect,
}: {
  nodeKey: string;
  depth: number;
  tree: IssueTree;
  selection: Selection;
  onSelect: (sel: Selection) => void;
}) {
  const entry = tree.byId[nodeKey];
  if (!entry) {
    return null;
  }
  const kids = tree.children[nodeKey] ?? [];
  const selected =
    (selection?.kind === "project" &&
      entry.kind === "project" &&
      selection.projectId === entry.projectId) ||
    (selection?.kind === "issue" &&
      entry.kind === "issue" &&
      selection.projectId === entry.projectId &&
      selection.issueId === entry.issueId);

  const typeLabel =
    entry.kind === "project" ? "Project" : (entry.level ?? "issue");

  return (
    <li>
      <div
        className={`${styles.treeRow}${selected ? ` ${styles.treeRowSelected}` : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => {
          if (entry.kind === "project") {
            onSelect({ kind: "project", projectId: entry.projectId });
          } else if (entry.issueId !== undefined) {
            onSelect({
              kind: "issue",
              projectId: entry.projectId,
              issueId: entry.issueId,
            });
          }
        }}
      >
        <span className={styles.treeType}>{typeLabel}</span>
        <span className={styles.treeTitle}>{entry.title || "(untitled)"}</span>
        {entry.hasViolation ? (
          <span
            className={styles.treeViolation}
            title="Level and placement disagree — open to review"
          >
            !
          </span>
        ) : null}
        {entry.kind === "issue" ? (
          <span className={styles.treeStatus}>
            {entry.projectId}-{entry.issueId}
          </span>
        ) : (
          <span className={styles.treeStatus}>#{entry.projectId}</span>
        )}
      </div>
      {kids.length > 0 ? (
        <ul>
          {kids.map((cid) => (
            <TreeNodeView
              key={cid}
              nodeKey={cid}
              depth={depth + 1}
              tree={tree}
              selection={selection}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
