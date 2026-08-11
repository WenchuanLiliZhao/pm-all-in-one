/**
 * Lab matrix for GitSyncPanel — real module `@/components/git-sync-panel`.
 *
 * ↔ components/git-sync-panel — component under test
 */
import { useMemo, useState } from "react";
import { GitSyncPanel } from "@/components/git-sync-panel";
import { PageWidth } from "@/components/ui/page-width";
import type { GitSyncStatus, UnsyncedChanges } from "@/lib/types";
import styles from "./page.module.scss";

const ISSUE_A = "abcdefghijklmnopqrstu";
const ISSUE_B = "bcdefghijklmnopqrstuv";
const PROJECT = "V1StGXR8_Z5jdHi6B-myT";
const WIKI = "wikiNodeId0123456789a";

type ScenarioId =
  | "not-repo"
  | "no-upstream"
  | "offline"
  | "clean"
  | "uncommitted"
  | "unpushed"
  | "both"
  | "behind-and-local"
  | "other-files";

const SCENARIOS: { id: ScenarioId; label: string }[] = [
  { id: "not-repo", label: "not-repo" },
  { id: "no-upstream", label: "no-upstream" },
  { id: "offline", label: "offline (fetch failed)" },
  { id: "clean", label: "clean / synced" },
  { id: "uncommitted", label: "only uncommitted" },
  { id: "unpushed", label: "only unpushed" },
  { id: "both", label: "uncommitted + unpushed" },
  { id: "behind-and-local", label: "incoming + local" },
  { id: "other-files", label: "only otherFiles" },
];

function statusFor(id: ScenarioId): GitSyncStatus {
  const checkedAt = "2026-08-11T12:00:00.000Z";
  switch (id) {
    case "not-repo":
      return {
        kind: "not-repo",
        behind: 0,
        ahead: 0,
        dirty: false,
        checkedAt,
        fetched: false,
      };
    case "no-upstream":
      return {
        kind: "no-upstream",
        behind: 0,
        ahead: 0,
        dirty: true,
        checkedAt,
        fetched: false,
      };
    case "offline":
      return {
        kind: "ok",
        behind: 0,
        ahead: 0,
        dirty: false,
        checkedAt,
        fetched: false,
        error: "git fetch failed",
      };
    case "clean":
      return {
        kind: "ok",
        behind: 0,
        ahead: 0,
        dirty: false,
        checkedAt,
        fetched: true,
      };
    case "uncommitted":
    case "unpushed":
    case "both":
    case "other-files":
      return {
        kind: "ok",
        behind: 0,
        ahead: id === "unpushed" || id === "both" ? 1 : 0,
        dirty: id === "uncommitted" || id === "both" || id === "other-files",
        checkedAt,
        fetched: true,
      };
    case "behind-and-local":
      return {
        kind: "ok",
        behind: 3,
        ahead: 1,
        dirty: true,
        checkedAt,
        fetched: true,
      };
    default: {
      const _e: never = id;
      return _e;
    }
  }
}

function changesFor(id: ScenarioId): UnsyncedChanges {
  const empty: UnsyncedChanges = { kind: "ok", nodes: [], otherFiles: [] };
  switch (id) {
    case "not-repo":
      return { kind: "not-repo", nodes: [], otherFiles: [] };
    case "no-upstream":
      return {
        kind: "no-upstream",
        nodes: [
          {
            ref: {
              kind: "issue",
              projectId: PROJECT,
              issueId: ISSUE_A,
            },
            propsChanged: true,
            bodyChanged: false,
            otherPaths: [],
            state: "uncommitted",
          },
        ],
        otherFiles: [],
      };
    case "offline":
    case "clean":
      return empty;
    case "uncommitted":
      return {
        kind: "ok",
        nodes: [
          {
            ref: {
              kind: "issue",
              projectId: PROJECT,
              issueId: ISSUE_A,
            },
            propsChanged: true,
            bodyChanged: false,
            otherPaths: [],
            state: "uncommitted",
          },
        ],
        otherFiles: [],
      };
    case "unpushed":
      return {
        kind: "ok",
        nodes: [
          {
            ref: { kind: "wiki", wikiNodeId: WIKI },
            propsChanged: false,
            bodyChanged: true,
            otherPaths: [],
            state: "unpushed",
          },
        ],
        otherFiles: [],
      };
    case "both":
      return {
        kind: "ok",
        nodes: [
          {
            ref: {
              kind: "issue",
              projectId: PROJECT,
              issueId: ISSUE_A,
            },
            propsChanged: true,
            bodyChanged: true,
            otherPaths: [],
            state: "both",
          },
          {
            ref: {
              kind: "issue",
              projectId: PROJECT,
              issueId: ISSUE_B,
            },
            propsChanged: false,
            bodyChanged: true,
            otherPaths: [],
            state: "unpushed",
          },
        ],
        otherFiles: [],
      };
    case "behind-and-local":
      return {
        kind: "ok",
        nodes: [
          {
            ref: {
              kind: "issue",
              projectId: PROJECT,
              issueId: ISSUE_A,
            },
            propsChanged: true,
            bodyChanged: false,
            otherPaths: [],
            state: "uncommitted",
          },
        ],
        otherFiles: [],
      };
    case "other-files":
      return {
        kind: "ok",
        nodes: [],
        otherFiles: [".pm/index.json", "issue-hierarchy/x/custom-props.ts"],
      };
    default: {
      const _e: never = id;
      return _e;
    }
  }
}

export function GitSyncPanelPage() {
  const [scenario, setScenario] = useState<ScenarioId>("behind-and-local");
  const [open, setOpen] = useState(true);

  const status = useMemo(() => statusFor(scenario), [scenario]);
  const changes = useMemo(() => changesFor(scenario), [scenario]);

  return (
    <PageWidth width="reading" className={styles.page}>
      <h1 className={styles.title}>Git sync panel</h1>
      <p className={styles.lead}>
        Real component: <code>@/components/git-sync-panel</code>. Status entry
        (not an action verb). Two bands: Incoming / Only on this computer.
        Forbidden copy: commit, ahead, dirty, upstream.
      </p>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Scenario</p>
        <div className={styles.row} style={{ flexWrap: "wrap", gap: 8 }}>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenario(s.id)}
              style={{
                fontWeight: scenario === s.id ? 700 : 400,
                padding: "4px 8px",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Topbar variant (forced open)</p>
        <div className={styles.row}>
          <GitSyncPanel
            demo
            variant="topbar"
            open={open}
            onOpenChange={setOpen}
            statusOverride={status}
            changesOverride={changes}
            resolveTitle={(ref) => {
              if (ref.kind === "issue" && ref.issueId === ISSUE_A) {
                return "Sample issue A";
              }
              if (ref.kind === "issue" && ref.issueId === ISSUE_B) {
                return "Sample issue B";
              }
              if (ref.kind === "wiki") {
                return "Sample wiki page";
              }
              return ref.kind;
            }}
          />
        </div>
      </div>
    </PageWidth>
  );
}
