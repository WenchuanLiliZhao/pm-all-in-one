import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { getPm, isWebPm } from "@/lib/bridge";
import { Button } from "@/components/ui/button";
import styles from "./styles.module.scss";

interface TermTab {
  id: string;
  label: string;
}

export interface TerminalPanelHandle {
  /** Ensure at least one session exists (create if empty). */
  ensureSession: () => Promise<void>;
  /** Focus the active xterm so the user can type. */
  focus: () => void;
}

function readCssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function xtermThemeFromCss(): {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
} {
  const background = readCssColor("--color-use--terminal-bg", "#ffffff");
  const foreground = readCssColor("--color-use--terminal-fg", "#1f1f1f");
  return {
    background,
    foreground,
    // Explicit cursor colors — defaulting to fg can fail if theme CSS is
    // momentarily unresolved, which leaves a transparent / missing cursor.
    cursor: foreground,
    cursorAccent: background,
  };
}

/** Restart blink + redraw cursor (DOM renderer can freeze mid-blink). */
function resyncCursor(term: Terminal): void {
  term.refresh(0, term.rows - 1);
}

export const TerminalPanel = forwardRef<TerminalPanelHandle>(
  function TerminalPanel(_props, ref) {
    const web = isWebPm();
    const [tabs, setTabs] = useState<TermTab[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const hostRef = useRef<HTMLDivElement>(null);
    const tabsRef = useRef<TermTab[]>([]);
    const terminals = useRef(
      new Map<
        string,
        { term: Terminal; fit: FitAddon; container: HTMLDivElement }
      >(),
    );
    const activeIdRef = useRef<string | null>(null);

    useEffect(() => {
      tabsRef.current = tabs;
    }, [tabs]);

    useEffect(() => {
      activeIdRef.current = activeId;
    }, [activeId]);

    useEffect(() => {
      if (web) {
        return;
      }
      const pm = getPm();
      const unsubData = pm.term.onData(({ sessionId, data }) => {
        terminals.current.get(sessionId)?.term.write(data);
      });
      const unsubExit = pm.term.onExit(({ sessionId }) => {
        disposeSession(sessionId);
        setTabs((prev) => {
          const next = prev.filter((t) => t.id !== sessionId);
          setActiveId((cur) => {
            if (cur !== sessionId) {
              return cur;
            }
            return next[next.length - 1]?.id ?? null;
          });
          return next;
        });
      });
      return () => {
        unsubData();
        unsubExit();
      };
    }, [web]);

    function disposeSession(id: string) {
      const entry = terminals.current.get(id);
      if (!entry) {
        return;
      }
      entry.term.dispose();
      entry.container.remove();
      terminals.current.delete(id);
    }

    function applyThemeToAllTerminals() {
      const theme = xtermThemeFromCss();
      for (const entry of terminals.current.values()) {
        entry.term.options.theme = theme;
        resyncCursor(entry.term);
      }
    }

    function showActiveTerminal(activeId: string | null) {
      // Prefer visibility over display:none — hiding with display:none zeroes
      // geometry and pauses CSS blink, which often leaves the cursor stuck off.
      for (const [id, entry] of terminals.current) {
        const active = id === activeId;
        entry.container.style.visibility = active ? "visible" : "hidden";
        entry.container.style.pointerEvents = active ? "auto" : "none";
        entry.container.style.zIndex = active ? "1" : "0";
        entry.container.setAttribute("aria-hidden", active ? "false" : "true");
      }
    }

    function fitAndResize(id: string) {
      const entry = terminals.current.get(id);
      if (!entry) {
        return;
      }
      entry.fit.fit();
      void getPm().term.resize(id, entry.term.cols, entry.term.rows);
      resyncCursor(entry.term);
    }

    useEffect(() => {
      if (web) {
        return;
      }
      applyThemeToAllTerminals();
      const root = document.documentElement;
      const mo = new MutationObserver(() => applyThemeToAllTerminals());
      mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onMq = () => applyThemeToAllTerminals();
      mq.addEventListener("change", onMq);
      return () => {
        mo.disconnect();
        mq.removeEventListener("change", onMq);
      };
    }, [web]);

    useEffect(() => {
      if (web) {
        return;
      }
      showActiveTerminal(activeId);
      if (!activeId) {
        return;
      }
      fitAndResize(activeId);
      // After tab show / panel open, re-focus so blink restarts and the
      // inactive→active cursor style swaps correctly.
      requestAnimationFrame(() => {
        const entry = terminals.current.get(activeId);
        if (!entry) {
          return;
        }
        entry.term.focus();
        resyncCursor(entry.term);
      });
    }, [activeId, tabs, web]);

    useEffect(() => {
      if (web) {
        return;
      }
      const onResize = () => {
        const id = activeIdRef.current;
        if (!id) {
          return;
        }
        fitAndResize(id);
      };
      const onVis = () => {
        if (document.visibilityState !== "visible") {
          return;
        }
        const id = activeIdRef.current;
        if (!id) {
          return;
        }
        const entry = terminals.current.get(id);
        if (!entry) {
          return;
        }
        // Chromium pauses CSS animations while hidden; blink can stick off.
        resyncCursor(entry.term);
      };
      const onWinFocus = () => {
        const id = activeIdRef.current;
        if (!id) {
          return;
        }
        const entry = terminals.current.get(id);
        if (!entry) {
          return;
        }
        resyncCursor(entry.term);
      };
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVis);
      window.addEventListener("focus", onWinFocus);
      return () => {
        window.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("focus", onWinFocus);
      };
    }, [web]);

    async function addTab() {
      if (web) {
        return;
      }
      const host = hostRef.current;
      if (!host) {
        return;
      }
      const pm = getPm();
      const fit = new FitAddon();
      const term = new Terminal({
        cursorBlink: true,
        // Outline is easy to miss on light themes; block stays readable when
        // the xterm textarea is blurred (click into the editor, etc.).
        cursorInactiveStyle: "block",
        fontSize: 13,
        fontFamily: readCssColor(
          "--font-family-mono",
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        ),
        theme: xtermThemeFromCss(),
      });
      term.loadAddon(fit);

      // xterm.js (5.x) sends the same `\r` for Enter and Shift+Enter, so TUIs
      // that use Shift+Enter for newline (Claude Code, etc.) cannot tell them
      // apart. Inject LF — same as Ctrl+J. Block keydown AND keypress: returning
      // false only on keydown still lets keypress emit `\r` (submit) after `\n`.
      //
      // CapsLock (= 中/英 on macOS Chinese IME): while composing, 5.5.0's
      // CompositionHelper finalizes on keydown *and* again on compositionend →
      // duplicated Latin preedit. Skip keydown handling so only compositionend
      // commits (upstream fix: xterm.js#5282, shipped in v6).
      term.attachCustomKeyEventHandler((ev) => {
        if (
          ev.key === "Enter" &&
          ev.shiftKey &&
          !ev.ctrlKey &&
          !ev.altKey &&
          !ev.metaKey
        ) {
          if (ev.type === "keydown") {
            term.input("\n");
          }
          return false;
        }
        if (
          ev.type === "keydown" &&
          ev.isComposing &&
          (ev.key === "CapsLock" || ev.keyCode === 20)
        ) {
          return false;
        }
        return true;
      });

      const container = document.createElement("div");
      container.className = styles.termSession;
      container.style.visibility = "hidden";
      container.style.pointerEvents = "none";
      container.style.zIndex = "0";
      container.setAttribute("aria-hidden", "true");
      host.appendChild(container);
      term.open(container);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      fit.fit();

      const sessionId = await pm.term.create(term.cols || 80, term.rows || 24);
      terminals.current.set(sessionId, { term, fit, container });

      term.onData((data) => {
        void pm.term.write(sessionId, data);
      });

      setTabs((prev) => [
        ...prev,
        { id: sessionId, label: `Term ${prev.length + 1}` },
      ]);
      setActiveId(sessionId);
    }

    useImperativeHandle(ref, () => ({
      ensureSession: async () => {
        if (web) {
          return;
        }
        if (tabsRef.current.length > 0) {
          const id = activeIdRef.current;
          if (id) {
            const entry = terminals.current.get(id);
            if (entry) {
              await new Promise<void>((resolve) => {
                requestAnimationFrame(() => resolve());
              });
              fitAndResize(id);
            }
          }
          return;
        }
        await addTab();
      },
      focus: () => {
        if (web) {
          return;
        }
        const id = activeIdRef.current;
        if (!id) {
          return;
        }
        const entry = terminals.current.get(id);
        if (!entry) {
          return;
        }
        entry.term.focus();
        resyncCursor(entry.term);
      },
    }));

    async function closeTab(id: string) {
      await getPm().term.kill(id);
      disposeSession(id);
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        setActiveId((cur) => {
          if (cur !== id) {
            return cur;
          }
          return next[next.length - 1]?.id ?? null;
        });
        return next;
      });
    }

    if (web) {
      return (
        <div className={styles.root}>
          <div className={styles.hostWrap}>
            <div className={styles.empty}>
              <p>Terminal is not available in web mode yet.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.root}>
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={t.id === activeId ? styles.tabActive : styles.tab}
                onClick={() => setActiveId(t.id)}
              >
                {t.label}
                <span
                  className={styles.tabClose}
                  onClick={(e) => {
                    e.stopPropagation();
                    void closeTab(t.id);
                  }}
                >
                  ×
                </span>
              </button>
            ))}
            <button type="button" className={styles.tab} onClick={() => void addTab()}>
              + Tab
            </button>
          </div>
        </div>
        <div className={styles.hostWrap}>
          {tabs.length === 0 ? (
            <div className={styles.empty}>
              <p>No terminal open.</p>
              <Button type="button" variant="outlined" onClick={() => void addTab()}>
                New terminal
              </Button>
            </div>
          ) : null}
          <div
            className={styles.host}
            ref={hostRef}
            onMouseDown={() => {
              const id = activeIdRef.current;
              if (!id) {
                return;
              }
              const entry = terminals.current.get(id);
              if (!entry) {
                return;
              }
              entry.term.focus();
              resyncCursor(entry.term);
            }}
          />
        </div>
      </div>
    );
  },
);
