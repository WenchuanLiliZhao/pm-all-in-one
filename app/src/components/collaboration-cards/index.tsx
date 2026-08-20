/**
 * Handoffs card list — topbar channel `/w/handoffs`.
 * Open / Closed tabs live in the search string (`?state=closed`), not extra
 * routes — refresh keeps the tab; `/w/handoffs/:handoffId` stays unambiguous.
 *
 * ↔ pages/channels/workspace-page/route.tsx — `CollaborationView`
 * ↔ electron/core/domain/handoffs.ts — getHandoffs / createHandoff
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from "react-router-dom";
import { MarkdownEditor } from "@/components/markdown-editor";
import { MemberPerson, MemberPersonSelect } from "@/components/member-person";
import { Button } from "@/components/ui/button";
import { Lucide } from "@/components/ui/lucide";
import { getPm } from "@/lib/bridge";
import { usePmMentions } from "@/lib/markdown/use-pm-mentions";
import type { HandoffMeta, HandoffSnapshot, WikiNodeMeta } from "@/lib/types";
import { useMember } from "@/lib/workspace/member-context";
import {
  useWorkspace,
  type Selection,
} from "@/lib/workspace/workspace-context";
import styles from "./styles.module.scss";

type HandoffListOutlet = {
  openSelection: (sel: Selection) => void;
  wikiNodes: WikiNodeMeta[];
};

type HandoffListState = "open" | "closed";

function listStateFromSearch(searchParams: URLSearchParams): HandoffListState {
  return searchParams.get("state") === "closed" ? "closed" : "open";
}

function formatSentAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function CollaborationCards() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listState = listStateFromSearch(searchParams);
  const { members, localMe } = useMember();
  const { projects, issues } = useWorkspace();
  const { openSelection, wikiNodes } = useOutletContext<HandoffListOutlet>();
  const navigateIssue = useCallback(
    (p: string, i: string) =>
      openSelection({ kind: "issue", projectId: p, issueId: i }),
    [openSelection],
  );
  const navigateProject = useCallback(
    (p: string) => openSelection({ kind: "project", projectId: p }),
    [openSelection],
  );
  const { plugins, mentionAutocomplete } = usePmMentions({
    issues,
    wikiNodes,
    onNavigateIssue: navigateIssue,
    onNavigateProject: navigateProject,
  });
  const [snap, setSnap] = useState<HandoffSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftRelatedProject, setDraftRelatedProject] = useState<string | null>(
    null,
  );
  const [draftOpen, setDraftOpen] = useState(true);
  const [draftTo, setDraftTo] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await getPm().getHandoffs();
      setSnap(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    return getPm().onChanged(() => {
      void refresh();
    });
  }, [refresh]);

  const involved = useMemo(
    () => (members?.nodes ?? []).filter((m) => m.membership === "involved"),
    [members?.nodes],
  );

  const projectTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, p.title);
    }
    return map;
  }, [projects]);

  const cards = snap?.nodes ?? [];
  const openCount = cards.filter((node) => node.open).length;
  const closedCount = cards.length - openCount;
  const visible = cards.filter((node) =>
    listState === "open" ? node.open : !node.open,
  );

  const openCompose = () => {
    setDraftTitle("");
    setDraftDescription("");
    setDraftBody("");
    setDraftTo(null);
    setDraftRelatedProject(projects[0]?.id ?? null);
    setDraftOpen(true);
    setComposing(true);
  };

  const onCreate = async () => {
    if (!localMe) {
      setError(
        "Set “Who you are (for signing)” in Settings before sending a handoff.",
      );
      return;
    }
    if (!draftTo) {
      setError("Pick a counterpart (to) before sending.");
      return;
    }
    if (!draftRelatedProject) {
      setError("Pick a related project before sending.");
      return;
    }
    setCreating(true);
    try {
      const created = await getPm().createHandoff({
        from: localMe,
        to: draftTo,
        relatedProject: draftRelatedProject,
        open: draftOpen,
        title: draftTitle.trim() || "Handoff",
        description: draftDescription,
        body: draftBody,
      });
      setError(null);
      setComposing(false);
      await refresh();
      navigate(`/w/handoffs/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Handoffs</h1>
          <p className={styles.sub}>
            Sent handoffs — one card per send. Cite issues in the body with{" "}
            <code>@issue-…</code>. Newest first.
          </p>
        </div>
        <Button
          type="button"
          variant="fill"
          className={styles.headerAction}
          disabled={creating}
          onClick={() => openCompose()}
        >
          New handoff
        </Button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {composing ? (
        <div className={styles.compose}>
          {!localMe ? (
            <p className={styles.empty}>
              Set who you are in Settings → General before sending. That becomes{" "}
              <code>from</code>.
            </p>
          ) : projects.length === 0 ? (
            <p className={styles.empty}>
              Create a project first — every handoff needs a related project.
            </p>
          ) : (
            <>
              <label className={styles.field}>
                <span>Title</span>
                <input
                  className={styles.input}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Short handoff title"
                />
              </label>
              <label className={styles.field}>
                <span>Description</span>
                <input
                  className={styles.input}
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  placeholder="Short blurb (may be empty)"
                />
              </label>
              <div className={styles.peopleRow}>
                <label className={styles.field}>
                  <span>Related project</span>
                  <select
                    className={styles.input}
                    value={draftRelatedProject ?? ""}
                    onChange={(e) =>
                      setDraftRelatedProject(e.target.value || null)
                    }
                    aria-label="Related project"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Status</span>
                  <select
                    className={styles.input}
                    value={draftOpen ? "open" : "closed"}
                    onChange={(e) => setDraftOpen(e.target.value === "open")}
                    aria-label="Handoff open or closed"
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
              </div>
              <div className={styles.peopleRow}>
                <div className={styles.field}>
                  <span>From</span>
                  <MemberPerson memberId={localMe} showName size="sm" link={false} />
                </div>
                <div className={styles.field}>
                  <span>To</span>
                  <MemberPersonSelect
                    value={draftTo}
                    onChange={setDraftTo}
                    options={involved}
                    aria-label="Handoff counterpart"
                  />
                </div>
              </div>
              <MarkdownEditor
                filename="README.md"
                value={draftBody}
                onChange={setDraftBody}
                plugins={plugins}
                mentionAutocomplete={mentionAutocomplete}
                placeholder="What you finished, what’s next, blockers…"
                rows={5}
              />
              <div className={styles.composeActions}>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={creating}
                  onClick={() => setComposing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="fill"
                  disabled={creating || !draftTo || !draftRelatedProject}
                  onClick={() => void onCreate()}
                >
                  {creating ? "Sending…" : "Send"}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className={styles.listBox}>
        <nav className={styles.tabList} aria-label="Handoff status">
          <Link
            to="/w/handoffs"
            className={
              listState === "open"
                ? `${styles.tab} ${styles.tabSelected}`
                : styles.tab
            }
            aria-current={listState === "open" ? "page" : undefined}
          >
            <Lucide.CircleDot className={styles.tabIconOpen} aria-hidden />
            {openCount} Open
          </Link>
          <Link
            to="/w/handoffs?state=closed"
            className={
              listState === "closed"
                ? `${styles.tab} ${styles.tabSelected}`
                : styles.tab
            }
            aria-current={listState === "closed" ? "page" : undefined}
          >
            <Lucide.CircleCheckBig
              className={styles.tabIconClosed}
              aria-hidden
            />
            {closedCount} Closed
          </Link>
        </nav>
        {!snap ? (
          <p className={styles.empty}>Loading…</p>
        ) : visible.length === 0 ? (
          <p className={styles.empty}>
            {listState === "open"
              ? cards.length === 0 && !composing
                ? "No open handoffs. Send one after a batch of work — it can cover many issues."
                : "No open handoffs."
              : "No closed handoffs."}
          </p>
        ) : (
          <ul className={styles.grid}>
            {visible.map((node) => (
              <li key={node.id}>
                <HandoffCard
                  node={node}
                  projectTitle={
                    projectTitleById.get(node.relatedProject) ??
                    node.relatedProject
                  }
                  onOpen={() => navigate(`/w/handoffs/${node.id}`)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HandoffCard({
  node,
  projectTitle,
  onOpen,
}: {
  node: HandoffMeta;
  projectTitle: string;
  onOpen: () => void;
}) {
  return (
    <button type="button" className={styles.card} onClick={onOpen}>
      <span className={styles.cardTop}>
        <span className={styles.cardTitle}>{node.title}</span>
        <span
          className={node.open ? styles.badgeOpen : styles.badgeClosed}
        >
          {node.open ? "Open" : "Closed"}
        </span>
      </span>
      {node.description ? (
        <span className={styles.cardDescription}>{node.description}</span>
      ) : (
        <span className={styles.cardDescriptionEmpty}>No description</span>
      )}
      <span className={styles.cardMeta}>
        {projectTitle} · {formatSentAt(node.created)}
      </span>
      <span className={styles.cardPeople}>
        <MemberPerson memberId={node.from} showName size="sm" link={false} />
        <span className={styles.arrow} aria-hidden>
          →
        </span>
        <MemberPerson memberId={node.to} showName size="sm" link={false} />
      </span>
    </button>
  );
}
