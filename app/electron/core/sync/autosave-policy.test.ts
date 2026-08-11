import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AUTOSAVE_IDLE_MS,
  AUTOSAVE_MAX_WAIT_MS,
  decideAutosave,
  type AutosaveInput,
} from "./autosave-policy.js";

function base(partial: Partial<AutosaveInput> = {}): AutosaveInput {
  return {
    status: "dirty",
    contentDirty: true,
    hasConflict: false,
    titleIsBlank: false,
    now: 10_000,
    lastEditAt: 10_000 - AUTOSAVE_IDLE_MS,
    firstDirtyAt: 10_000 - AUTOSAVE_IDLE_MS,
    idleMs: AUTOSAVE_IDLE_MS,
    maxWaitMs: AUTOSAVE_MAX_WAIT_MS,
    ...partial,
  };
}

test("clean → idle", () => {
  const d = decideAutosave(
    base({ status: "clean", contentDirty: false, firstDirtyAt: null }),
  );
  assert.equal(d.kind, "idle");
});

test("saved + not dirty → idle", () => {
  const d = decideAutosave(
    base({ status: "saved", contentDirty: false, firstDirtyAt: null }),
  );
  assert.equal(d.kind, "idle");
});

test("dirty + idle elapsed → save", () => {
  const d = decideAutosave(base());
  assert.equal(d.kind, "save");
});

test("dirty + idle not elapsed → wait", () => {
  const d = decideAutosave(
    base({
      now: 10_000,
      lastEditAt: 9_700,
      firstDirtyAt: 9_700,
    }),
  );
  assert.equal(d.kind, "wait");
  if (d.kind === "wait") {
    assert.equal(d.afterMs, 500);
  }
});

test("continuous edits past maxWaitMs → save", () => {
  const d = decideAutosave(
    base({
      now: 20_000,
      lastEditAt: 19_900,
      firstDirtyAt: 20_000 - AUTOSAVE_MAX_WAIT_MS,
    }),
  );
  assert.equal(d.kind, "save");
});

test("blank trimmed title → hold blank-title", () => {
  const d = decideAutosave(base({ titleIsBlank: true }));
  assert.deepEqual(d, { kind: "hold", reason: "blank-title" });
});

test("conflict present → hold conflict even when dirty", () => {
  const d = decideAutosave(
    base({ hasConflict: true, status: "conflict", contentDirty: true }),
  );
  assert.deepEqual(d, { kind: "hold", reason: "conflict" });
});

test("status saving → hold saving", () => {
  const d = decideAutosave(base({ status: "saving" }));
  assert.deepEqual(d, { kind: "hold", reason: "saving" });
});

test("status error → hold error (no auto-retry)", () => {
  const d = decideAutosave(
    base({ status: "error", contentDirty: true, lastEditAt: 0 }),
  );
  assert.deepEqual(d, { kind: "hold", reason: "error" });
});

test("wait afterMs is capped by maxWait remaining", () => {
  // Idle remaining = 700ms; maxWait remaining = 200ms → wait 200
  const d = decideAutosave(
    base({
      now: 10_000,
      lastEditAt: 9_900,
      firstDirtyAt: 10_000 - (AUTOSAVE_MAX_WAIT_MS - 200),
    }),
  );
  assert.equal(d.kind, "wait");
  if (d.kind === "wait") {
    assert.equal(d.afterMs, 200);
  }
});
