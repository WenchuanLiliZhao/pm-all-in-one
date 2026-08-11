import { useEffect, useState } from "react";
import { PageWidth } from "@/components/ui/page-width";
import styles from "./page.module.scss";

const COLOR_USE_TOKENS = [
  "--color-use--text-prime",
  "--color-use--text-secondary",
  "--color-use--bg-prime-hex",
  "--color-use--bg-secondary-hex",
  "--color-use--bg-darken",
  "--color-use--border-prime-hex",
  "--color-use--border-emphasis-hex",
  "--color-use--border-focus-hex",
  "--color-use--danger",
  "--color-use--danger-bg",
  "--color-use--warn-fg",
  "--color-use--warn-bg",
  "--color-use--success",
  "--color-use--success-soft",
  "--color-use--accent",
  "--color-use--accent-text",
  "--color-use--accent-bg",
  "--color-use--grid-line",
  "--color-use--grid-line-soft",
  "--color-use--grid-weekend",
  "--color-use--terminal-bg",
  "--color-use--terminal-fg",
  "--color-use--terminal-toolbar",
  "--color-use--terminal-border",
  "--color-use--terminal-tab",
  "--color-use--terminal-tab-active",
  "--color-use--terminal-tab-active-border",
  "--color-use--terminal-muted",
] as const;

const COLOR_PRIMITIVES = [
  "--color--gray-88-hex",
  "--color--gray-48-hex",
  "--color--gray-8-hex",
  "--color--gray-0-hex",
  "--color--white-88-hex",
  "--color--white-8-hex",
] as const;

const SPACE_TOKENS = [
  "--space--4",
  "--space--8",
  "--space--12",
  "--space--16",
  "--space--20",
  "--space--24",
  "--space--28",
] as const;

const LAYOUT_TOKENS = [
  "--layout--titlebar-height",
  "--layout--titlebar-traffic-inset",
  "--layout--titlebar-traffic-y",
  "--layout--detail-min",
  "--layout--detail-max",
  "--layout--terminal-min",
  "--layout--terminal-max",
  "--layout--page-pad-x",
  "--layout--page-pad-y",
  "--layout--content-max",
  "--layout--content-narrow",
  "--layout--topbar-pad-x",
  "--layout--topbar-pad-y",
  "--layout--wiki-rail-width",
  "--layout--tree-lead-size",
  "--layout--roadmap-label-width",
  "--layout--roadmap-row-height",
] as const;

type ThemeMode = "auto" | "light" | "dark";

function readThemeMode(): ThemeMode {
  const value = document.documentElement.dataset.theme;
  if (value === "light" || value === "dark") {
    return value;
  }
  return "auto";
}

function applyThemeMode(mode: ThemeMode): void {
  if (mode === "auto") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = mode;
  }
}

export function TokensPage() {
  const [theme, setTheme] = useState<ThemeMode>(() =>
    typeof document === "undefined" ? "auto" : readThemeMode(),
  );

  useEffect(() => {
    applyThemeMode(theme);
  }, [theme]);

  return (
    <PageWidth width="reading" className={styles.page}>
      <h1 className={styles.title}>Tokens</h1>
      <p className={styles.lead}>
        Tokens from self-contained <code>src/global-styles/</code>, including
        light / dark / auto blocks in <code>color-use.scss</code>.
      </p>

      <div className={styles.block}>
        <p className={styles.blockLabel}>Theme (data-theme)</p>
        <div className={styles.row}>
          {(["auto", "light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={
                theme === mode ? styles.toggleActive : styles.toggle
              }
              onClick={() => setTheme(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <h2 className={styles.sectionTitle}>color-use (live)</h2>
      <div className={styles.swatchGrid}>
        {COLOR_USE_TOKENS.map((name) => (
          <div key={name} className={styles.swatch}>
            <div
              className={styles.swatchChip}
              style={{ background: `var(${name})` }}
            />
            <div className={styles.swatchMeta}>
              <span className={styles.swatchName}>{name}</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>color primitives (sample)</h2>
      <div className={styles.swatchGrid}>
        {COLOR_PRIMITIVES.map((name) => (
          <div key={name} className={styles.swatch}>
            <div
              className={styles.swatchChip}
              style={{ background: `var(${name})` }}
            />
            <div className={styles.swatchMeta}>
              <span className={styles.swatchName}>{name}</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Fonts</h2>
      <p className={styles.fontSans}>
        <span className={styles.fontLabel}>--font-family-sans</span>
        The quick brown fox jumps over the lazy dog.
      </p>
      <p className={styles.fontMono}>
        <span className={styles.fontLabel}>--font-family-mono</span>
        issue-hierarchy / w_42 / props.ts
      </p>

      <h2 className={styles.sectionTitle}>Space</h2>
      <div className={styles.tokenList}>
        {SPACE_TOKENS.map((name) => (
          <div key={name} className={styles.spaceRow}>
            <div
              className={styles.spaceBar}
              style={{ width: `var(${name})` }}
            />
            <span className={styles.swatchName}>{name}</span>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Layout</h2>
      <ul className={styles.tokenList}>
        {LAYOUT_TOKENS.map((name) => (
          <li key={name} className={styles.layoutRow}>
            <code className={styles.swatchName}>{name}</code>
            <span className={styles.layoutValue}>var({name})</span>
          </li>
        ))}
      </ul>
    </PageWidth>
  );
}
