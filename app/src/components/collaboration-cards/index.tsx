/**
 * Handoffs card list — topbar channel `/w/handoffs`.
 *
 * ↔ pages/channels/workspace-page/route.tsx — `CollaborationView`
 * ↔ electron/core/handoffs.ts — getHandoffs / createHandoff
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MemberPerson, MemberPersonSelect } from "@/components/member-person";
import { Button } from "@/components/ui/button";
import { getPm } from "@/lib/bridge";
import type { HandoffMeta, HandoffSnapshot } from "@/lib/types";
import { useMember } from "@/lib/workspace/member-context";
import { useWorkspace } from "@/lib/workspace/workspace-context";
import styles from "./styles.module.scss";

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
  const { members, localMe } = useMember();
  const { projects } = useWorkspace();
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
              <label className={styles.field}>
                <span>Body</span>
                <textarea
                  className={styles.textarea}
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  rows={5}
                  placeholder="What you finished, what’s next, blockers…"
                />
              </label>
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

      {!snap ? (
        <p className={styles.empty}>Loading…</p>
      ) : cards.length === 0 && !composing ? (
        <p className={styles.empty}>
          No handoffs yet. Send one after a batch of work — it can cover many
          issues.
        </p>
      ) : (
        <ul className={styles.grid}>
          {cards.map((node) => (
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
