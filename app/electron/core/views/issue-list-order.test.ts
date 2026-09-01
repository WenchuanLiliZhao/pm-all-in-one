import assert from "node:assert/strict";
import { test } from "node:test";

import { sortIssueSiblings } from "./issue-list-order.js";
import type { IssueListOrderSlice } from "./issue-list-order.js";

const P = "aaaaaaaaaaaaaaaaaaaa1";

function issue(
  id: string,
  title: string,
  extra: Partial<Pick<IssueListOrderSlice, "status" | "blockedBy">> = {},
): IssueListOrderSlice {
  return {
    id,
    projectId: P,
    title,
    status: extra.status ?? "draft",
    blockedBy: extra.blockedBy ?? [],
  };
}

test("blockedBy wins over title: Zzz before Aaa when Aaa waits on Zzz", () => {
  const aaa = issue("bbbbbbbbbbbbbbbbbbb01", "Aaa", {
    blockedBy: ["bbbbbbbbbbbbbbbbbbb02"],
  });
  const zzz = issue("bbbbbbbbbbbbbbbbbbb02", "Zzz");
  const ordered = sortIssueSiblings([aaa, zzz]);
  assert.deepEqual(
    ordered.map((i) => i.title),
    ["Zzz", "Aaa"],
  );
});

test("cancel with no deps sorts after the open chain", () => {
  const cancel = issue("bbbbbbbbbbbbbbbbbbb03", "Aaa cancel", {
    status: "cancel",
  });
  const first = issue("bbbbbbbbbbbbbbbbbbb04", "Mmm first");
  const second = issue("bbbbbbbbbbbbbbbbbbb05", "Zzz second", {
    blockedBy: ["bbbbbbbbbbbbbbbbbbb04"],
  });
  const ordered = sortIssueSiblings([cancel, second, first]);
  assert.deepEqual(
    ordered.map((i) => i.title),
    ["Mmm first", "Zzz second", "Aaa cancel"],
  );
});

test("roadmap preferredKeys break ties among unblocked siblings", () => {
  const a = issue("bbbbbbbbbbbbbbbbbbb06", "Alpha");
  const b = issue("bbbbbbbbbbbbbbbbbbb07", "Beta");
  const key = (id: string) => `${P}::${id}`;
  const ordered = sortIssueSiblings([a, b], [key(b.id), key(a.id)]);
  assert.deepEqual(
    ordered.map((i) => i.title),
    ["Beta", "Alpha"],
  );
});

test("done blocker still precedes the issue that waits on it", () => {
  const done = issue("bbbbbbbbbbbbbbbbbbb08", "Partner", { status: "done" });
  const next = issue("bbbbbbbbbbbbbbbbbbb09", "API", {
    blockedBy: ["bbbbbbbbbbbbbbbbbbb08"],
  });
  const ordered = sortIssueSiblings([next, done]);
  assert.deepEqual(
    ordered.map((i) => i.title),
    ["Partner", "API"],
  );
});
