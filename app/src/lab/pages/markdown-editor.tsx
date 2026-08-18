// ↔ src/components/markdown-editor/AGENTS.md — Lab review harness + checklist
// ↔ src/components/markdown-editor/index.ts — real module under test
// ↔ src/lib/markdown/plot-fence-plugin/ — Preview plot fences (Live stays source)

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
import { plotFencePlugin } from "@/lib/markdown/plot-fence-plugin";
import { createMockWikiPlugin } from "./markdown-editor.mock-plugin";
import pageStyles from "./page.module.scss";
import styles from "./markdown-editor.module.scss";

const KNOWN_WIKI = new Set(["ok", "long"]);

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
  {
    id: "long",
    label:
      "A fairly long wiki title that should wrap across lines in a narrow Preview pane",
    secondary: "wiki-long",
    insertText: "@wiki-long",
  },
];

export function MarkdownEditorPage() {
  const [fixtureId, setFixtureId] = useState<FixtureId>(DEFAULT_FIXTURE);
  const [value, setValue] = useState(FIXTURES[DEFAULT_FIXTURE].source);
  const [logLines, setLogLines] = useState<string[]>([]);
  const focusRef = useRef<MarkdownEditorHandle>(null);

  const fixture = FIXTURES[fixtureId];

  const plugins = useMemo(
    () => [
      plotFencePlugin,
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
    () => ({
      candidates: MOCK_MENTION_CANDIDATES,
      onActivate: (token: string) => {
        const stamp = new Date().toLocaleTimeString();
        setLogLines((prev) =>
          [`[${stamp}] Live ⌘/Ctrl-click → ${token}`, ...prev].slice(0, 40),
        );
      },
    }),
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
        Real module: <code>@/components/markdown-editor</code>. Bordered
        chrome, sticky filename nav, Source / Live / Preview (default
        Preview), auto-pair, @ mention autocomplete, plugins. Mock providers
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
            No plugins. Opens in Preview. Filename nav + Source / Live /
            Preview. Auto-pair on. Controlled value.
          </p>
          <MarkdownEditor
            filename="README.md"
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
            Preview chips via plugin. Type @ in Live for mock candidates.
            ⌘/Ctrl-click a Live @mention to log navigate. Opens in Live so
            autocomplete is ready.
          </p>
          <MarkdownEditor
            filename="plugin.md"
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
          MarkdownEditor — programmatic focus
        </h2>
        <p className={styles.desc}>
          Opens in Preview. Focus start switches to Live and lands the caret
          (programmatic focus gate bypass).
        </p>
        <div className={styles.toolbar}>
          <Button
            type="button"
            variant="outlined"
            onClick={() => focusRef.current?.focus({ at: "start" })}
          >
            Focus start
          </Button>
        </div>
        <MarkdownEditor
          filename="README.md"
          editorRef={focusRef}
          value={value}
          onChange={setValue}
          plugins={plugins}
          mentionAutocomplete={mentionAutocomplete}
          placeholder="Markdown body…"
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
        <p className={styles.desc}>
          Mock wiki Preview clicks + Live ⌘/Ctrl-click (newest first).
        </p>
        <pre className={styles.log}>
          {logLines.length === 0 ? (
            <span className={styles.logEmpty}>
              No events yet — click a Preview chip or ⌘/Ctrl-click a Live
              @mention.
            </span>
          ) : (
            logLines.join("\n")
          )}
        </pre>
      </section>
    </PageWidth>
  );
}
