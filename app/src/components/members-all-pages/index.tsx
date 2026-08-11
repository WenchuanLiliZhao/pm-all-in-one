/**
 * Members inventory list.
 *
 * Hosted under WikiShell with `contentWidth="full"`.
 *
 * ↔ components/wiki-shell — `contentWidth="full"` → PageWidth full + `.mainBodyFull`
 * ↔ components/ui/page-width — column SoT
 * ↔ pages/channels/workspace-page/route.tsx — `MembersAllPagesView`
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MemberPerson } from "@/components/member-person";
import { Button } from "@/components/ui/button";
import { useMember } from "@/lib/workspace/member-context";
import styles from "./styles.module.scss";

export function MembersAllPages() {
  const navigate = useNavigate();
  const { members, createMember, error: membersError } = useMember();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const nodes = members?.nodes ?? [];
    return [...nodes].sort((a, b) => {
      if (a.membership !== b.membership) {
        return a.membership === "involved" ? -1 : 1;
      }
      return a.title.localeCompare(b.title);
    });
  }, [members?.nodes]);

  const onNew = async () => {
    setCreating(true);
    try {
      const created = await createMember({ title: "New member" });
      setError(null);
      navigate(`/w/members/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const displayError = error ?? membersError;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Members</h1>
          <p className={styles.sub}>
            People in this workspace. Membership is{" "}
            <code>involved</code> or <code>left</code> — left members stay on
            disk for history but are greyed here.
          </p>
        </div>
        <Button
          type="button"
          variant="fill"
          className={styles.headerAction}
          disabled={creating}
          onClick={() => void onNew()}
        >
          {creating ? "Creating…" : "New"}
        </Button>
      </div>

      {displayError ? <p className={styles.error}>{displayError}</p> : null}

      {!members ? (
        <p className={styles.empty}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>No members yet. Create one with New.</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((node) => {
            const left = node.membership === "left";
            return (
              <li key={node.id}>
                <button
                  type="button"
                  className={`${styles.row}${left ? ` ${styles.rowLefted}` : ""}`}
                  onClick={() => navigate(`/w/members/${node.id}`)}
                >
                  <span className={styles.rowLeft}>
                    <MemberPerson
                      memberId={node.id}
                      title={node.title}
                      membership={node.membership}
                      size="sm"
                      showName
                      link={false}
                    />
                  </span>
                  <span
                    className={`${styles.badge}${
                      left ? ` ${styles.badgeLeft}` : ` ${styles.badgeInvolved}`
                    }`}
                  >
                    {node.membership}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
