import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clampPaneWidth,
  parseCssLength,
  readStoredPaneWidth,
  writeStoredPaneWidth,
} from "./pane-width.ts";

test("parseCssLength reads px and rem", () => {
  assert.equal(parseCssLength("320px", 16), 320);
  assert.equal(parseCssLength(" 22rem ", 16), 352);
  assert.equal(parseCssLength("16rem", 16), 256);
  assert.equal(parseCssLength("28rem", 16), 448);
  assert.equal(parseCssLength("var(--layout--detail-min)", 16), null);
  assert.equal(parseCssLength("", 16), null);
});

test("clampPaneWidth stays inside the closed interval", () => {
  assert.equal(clampPaneWidth(100, 200, 480), 200);
  assert.equal(clampPaneWidth(900, 200, 480), 480);
  assert.equal(clampPaneWidth(280.4, 200, 480), 280);
  assert.equal(clampPaneWidth(280.6, 200, 480), 281);
});

test("readStoredPaneWidth falls back and clamps", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: () => null,
    get length() {
      return store.size;
    },
  };
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  try {
    assert.equal(readStoredPaneWidth("k", 280, 200, 480), 280);
    writeStoredPaneWidth("k", 300.2);
    assert.equal(store.get("k"), "300");
    assert.equal(readStoredPaneWidth("k", 280, 200, 480), 300);
    writeStoredPaneWidth("k", 900);
    assert.equal(readStoredPaneWidth("k", 280, 200, 480), 480);
    store.set("k", "nope");
    assert.equal(readStoredPaneWidth("k", 280, 200, 480), 280);
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: previous,
    });
  }
});
