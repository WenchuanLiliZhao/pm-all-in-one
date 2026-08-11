// ↔ src/components/markdown-editor/AGENTS.md — Lab review harness + checklist
// ↔ src/components/markdown-editor/index.ts — real module under test (mock wiki only)

import { useMemo, useRef, useState } from "react";
import {
  MarkdownEditor,
  MarkdownPreview,
  type MarkdownEditorHandle,
  type MentionAutocompleteCandidate,
} from "@/components/markdown-editor";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { PageWidth } from "@/components/ui/page-width";
import {
  DEFAULT_FIXTURE,
  FIXTURES,
  type FixtureId,
} from "./markdown-editor.fixtures";
import { createMockWikiPlugin } from "./markdown-editor.mock-plugin";
import pageStyles from "./page.module.scss";
import styles from "./markdown-editor.module.scss";

const KNOWN_WIKI = new Set(["ok"]);

const MOCK_MENTION_CANDIDATES: MentionAutocompleteCandidate[] = [
  {
    id: "ok",
    label: "Ok page",
    secondary: "wiki-ok",
    insertText: "@wiki-ok",
  },
  {
    id: "missing",
    label: "Missing page",
    secondary: "wiki-missing",
    insertText: "@wiki-missing",
  },
  {
    id: "guide",
    label: "Style guide",
    secondary: "wiki-guide",
    insertText: "@wiki-guide",
  },
];

export function MarkdownEditorPage() {
  const [fixtureId, setFixtureId] = useState<FixtureId>(DEFAULT_FIXTURE);
  const [value, setValue] = useState(FIXTURES[DEFAULT_FIXTURE].source);
  const [logLines, setLogLines] = useState<string[]>([]);
  const borderlessRef = useRef<MarkdownEditorHandle>(null);

  const fixture = FIXTURES[fixtureId];

  const plugins = useMemo(
    () => [
      createMockWikiPlugin({
        knownKeys: KNOWN_WIKI,
        titles: new Map(
          MOCK_MENTION_CANDIDATES.map((c) => [
            c.insertText.replace(/^@wiki-/, ""),
            c.label,
          ]),
        ),
        onNavigate: (key) => {
          const stamp = new Date().toLocaleTimeString();
          setLogLines((prev) =>
            [`[${stamp}] wiki navigate → ${key}`, ...prev].slice(0, 40),
          );
        },
      }),
    ],
    [],
  );

  const mentionAutocomplete = useMemo(
    () => ({ candidates: MOCK_MENTION_CANDIDATES }),
    [],
  );

  function loadFixture(id: FixtureId) {
    setFixtureId(id);
    setValue(FIXTURES[id].source);
  }

  function reset() {
    setValue(FIXTURES[fixtureId].source);
  }

  function clear() {
    setValue("");
  }

  return (
    <PageWidth width="full" className={pageStyles.page}>
      <h1 className={pageStyles.title}>Markdown editor</h1>
      <p className={pageStyles.lead}>
        Real module: <code>@/components/markdown-editor</code>. Live / source /
        preview, auto-pair, @ mention autocomplete, plugins. Mock providers
        only — no workspace data.
      </p>

      <div className={styles.toolbar}>
        <Button type="button" variant="outlined" onClick={reset}>
          Reset
        </Button>
        <Button type="button" variant="outlined" onClick={clear}>
          Clear
        </Button>
        <span className={styles.meta}>{value.length} chars</span>
      </div>

      <div className={styles.fixtures}>
        <span className={styles.fixturesLabel}>Fixtures</span>
        {(Object.keys(FIXTURES) as FixtureId[]).map((id) => (
          <button
            key={id}
            type="button"
            className={
              id === fixtureId ? styles.fixtureTabActive : styles.fixtureTab
            }
            onClick={() => loadFixture(id)}
          >
            {FIXTURES[id].label}
          </button>
        ))}
      </div>

      {fixture.note ? <Banner tone="warn">{fixture.note}</Banner> : null}

      <div className={styles.grid}>
        <section className={pageStyles.block}>
          <h2 className={pageStyles.sectionTitle}>
            MarkdownEditor — baseline
          </h2>
          <p className={styles.desc}>
            No plugins. Cycle Live / Source / Preview. Auto-pair on. Controlled
            value.
          </p>
          <MarkdownEditor
            label="Baseline"
            value={value}
            onChange={setValue}
            placeholder="Type Markdown… try **bold**, @, ```"
            rows={14}
          />
        </section>

        <section className={pageStyles.block}>
          <h2 className={pageStyles.sectionTitle}>
            MarkdownEditor — mock @wiki + autocomplete
          </h2>
          <p className={styles.desc}>
            Preview chips via plugin. Type @ in Live/Source for mock
            candidates.
          </p>
          <MarkdownEditor
            label="With plugin"
            value={value}
            onChange={setValue}
            plugins={plugins}
            mentionAutocomplete={mentionAutocomplete}
            defaultMode="live"
            placeholder="Try @ for wiki pages"
            rows={14}
          />
        </section>
      </div>

      <section className={pageStyles.block}>
        <h2 className={pageStyles.sectionTitle}>
          MarkdownEditor — borderless (locked Live)
        </h2>
        <p className={styles.desc}>
          Doc-shell variant: no mode chrome, no border. Use Focus start to
          verify programmatic focus bypasses the accidental-focus gate.
        </p>
        <div className={styles.toolbar}>
          <Button
            type="button"
            variant="outlined"
            onClick={() => borderlessRef.current?.focus({ at: "start" })}
          >
            Focus start
          </Button>
        </div>
        <MarkdownEditor
          variant="borderless"
          editorRef={borderlessRef}
          value={value}
          onChange={setValue}
          plugins={plugins}
          mentionAutocomplete={mentionAutocomplete}
          placeholder="Borderless live body…"
          rows={10}
        />
      </section>

      <div className={styles.grid}>
        <section className={pageStyles.block}>
          <h2 className={pageStyles.sectionTitle}>
            MarkdownPreview — standalone
          </h2>
          <p className={styles.desc}>Same value + mock plugin, preview-only.</p>
          <MarkdownPreview source={value} plugins={plugins} />
        </section>

        <section className={pageStyles.block}>
          <h2 className={pageStyles.sectionTitle}>Empty state</h2>
          <p className={styles.desc}>
            MarkdownPreview with empty source should show “Empty”.
          </p>
          <MarkdownPreview source="" />
        </section>
      </div>

      <section className={pageStyles.block}>
        <h2 className={pageStyles.sectionTitle}>Event log</h2>
        <p className={styles.desc}>Mock wiki chip clicks (newest first).</p>
        <pre className={styles.log}>
          {logLines.length === 0 ? (
            <span className={styles.logEmpty}>
              No events yet — switch to Preview and click a wiki chip.
            </span>
          ) : (
            logLines.join("\n")
          )}
        </pre>
      </section>
    </PageWidth>
  );
}
