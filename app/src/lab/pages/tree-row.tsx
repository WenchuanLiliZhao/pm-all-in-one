import { useState } from "react";
import {
  TreeRow,
  treeRowStyles,
} from "@/components/ui/tree-row";
import { PageWidth } from "@/components/ui/page-width";
import {
  issueKindIcon,
  type IssueKindKey,
} from "@/components/ui/tree-row/kind-icon";
import {
  issueStatusIcon,
  issueStatusLabel,
} from "@/components/ui/issue-status";
import { ISSUE_STATUS_IDS } from "@/lib/issue-status";
import styles from "./page.module.scss";

const KINDS: IssueKindKey[] = [
  "project",
  "epic",
  "task",
  "subtask",
];

function DemoRow({
  kind,
  hasChildren,
  expanded,
  twistLocked,
  title,
  status,
  onToggle,
}: {
  kind?: IssueKindKey;
  hasChildren?: boolean;
  expanded?: boolean;
  twistLocked?: boolean;
  title: string;
  status?: (typeof ISSUE_STATUS_IDS)[number];
  onToggle?: () => void;
}) {
  return (
    <div
      className={treeRowStyles.rowHoverRoot}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        minHeight: 32,
        padding: "2px 4px",
        borderRadius: 4,
      }}
    >
      <TreeRow
        icon={kind ? issueKindIcon(kind) : undefined}
        hasChildren={hasChildren}
        expanded={expanded}
        onToggle={onToggle}
        twistLocked={twistLocked}
        title={title}
        titleClassName={styles.swatchName}
        trailing={status ? issueStatusIcon(status) : undefined}
        aria-label={
          kind
            ? status
              ? `${kind}: ${title}, ${issueStatusLabel(status)}`
              : `${kind}: ${title}`
            : title
        }
      />
    </div>
  );
}

export function TreeRowPage() {
  const [expandedByKind, setExpandedByKind] = useState<
    Record<IssueKindKey, boolean>
  >({
    project: false,
    epic: true,
    task: false,
    subtask: true,
  });

  return (
    <PageWidth width="reading" className={styles.page}>
      <h1 className={styles.title}>Tree row</h1>
      <p className={styles.lead}>
        Real component: <code>@/components/ui/tree-row</code>. Used by Roadmap
        and Hierarchy outline. Lead uses Lucide kind icons; folders swap to{" "}
        <code>Lucide.ChevronRight</code> on row hover / lead{" "}
        <code>:focus-visible</code>. Issue rows can show a trailing status
        icon.
      </p>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Kinds × folder (hover / expand)</p>
        <div
          className={styles.row}
          style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}
        >
          {KINDS.map((kind) => (
            <DemoRow
              key={`folder-${kind}`}
              kind={kind}
              hasChildren
              expanded={expandedByKind[kind]}
              title={`${kind} folder`}
              onToggle={() =>
                setExpandedByKind((prev) => ({
                  ...prev,
                  [kind]: !prev[kind],
                }))
              }
            />
          ))}
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Kinds × leaf</p>
        <div
          className={styles.row}
          style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}
        >
          {KINDS.map((kind) => (
            <DemoRow
              key={`leaf-${kind}`}
              kind={kind}
              title={`${kind} leaf`}
            />
          ))}
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Status trailing</p>
        <div
          className={styles.row}
          style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}
        >
          {ISSUE_STATUS_IDS.map((status) => (
            <DemoRow
              key={status}
              kind="subtask"
              title={issueStatusLabel(status)}
              status={status}
            />
          ))}
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>No-icon folder (chevron always on)</p>
        <DemoRow
          hasChildren
          expanded={false}
          title="Folder without rest icon"
          onToggle={() => undefined}
        />
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>twistLocked</p>
        <DemoRow
          kind="epic"
          hasChildren
          expanded
          twistLocked
          title="Locked during drag collapse"
        />
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Legacy kind text (optional)</p>
        <div
          className={treeRowStyles.rowHoverRoot}
          style={{ display: "flex", alignItems: "center", width: "100%" }}
        >
          <TreeRow
            icon={issueKindIcon("epic")}
            hasChildren
            expanded={false}
            kind="EPIC"
            kindClassName={styles.swatchName}
            title="Still accepts kind= for lab"
            titleClassName={styles.swatchName}
            onToggle={() => undefined}
          />
        </div>
      </div>
    </PageWidth>
  );
}
