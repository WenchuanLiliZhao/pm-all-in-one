import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyFilter,
  blankClause,
  emptyFilter,
  issueMatches,
  summarize,
  visibleRowKeys,
  type FilterClause,
  type FilterGroup,
  type FilterSchema,
  type FilterSubject,
} from "./filter-model.ts";

const names = {
  member: (id: string) => (id === "ada" ? "Ada" : id),
  wiki: (id: string) => (id === "w1" ? "Notes" : id),
};

function issue(patch: Partial<FilterSubject> = {}): FilterSubject {
  return {
    projectId: "p1",
    level: "task",
    status: "todo",
    priority: "medium",
    startDate: "2026-01-01",
    endDate: "2026-01-10",
    created: "2026-01-02T00:00:00.000Z",
    updated: "2026-01-03T00:00:00.000Z",
    assignee: "ada",
    createdBy: "ada",
    fields: {},
    markdownFields: {},
    ...patch,
  };
}

const schema: FilterSchema = {
  epic: [],
  task: [{ key: "points" }, { key: "note" }, { key: "flag" }, { key: "tags" }, { key: "ref" }],
  subtask: [],
};

function clause(partial: Partial<FilterClause> & Pick<FilterClause, "prop" | "op">): FilterClause {
  return {
    kind: "clause",
    id: partial.id ?? "c",
    value: partial.value ?? "",
    prop: partial.prop,
    op: partial.op,
  };
}

function root(join: "and" | "or", children: FilterGroup["children"]): FilterGroup {
  return { kind: "group", id: "root", join, children };
}

test("empty filter is inactive and keeps the whole tree", () => {
  const tree = { roots: ["p1"], children: { p1: ["a"] } };
  const applied = applyFilter(
    tree,
    () => issue(),
    () => schema,
    emptyFilter(),
  );
  assert.equal(applied.active, false);
  assert.equal(applied.kept, null);
  assert.equal(applied.matchCount, 0);
});

test("and requires every complete clause; incomplete clauses drop out", () => {
  const filter = root("and", [
    clause({
      prop: { source: "builtin", id: "endDate" },
      op: "before",
      value: "2026-02-01",
    }),
    clause({
      prop: { source: "builtin", id: "status" },
      op: "is",
      value: "done",
    }),
    blankClause("draft"),
  ]);
  assert.equal(issueMatches(issue({ status: "done" }), schema, filter), true);
  assert.equal(issueMatches(issue({ status: "todo" }), schema, filter), false);
});

test("or keeps an issue that meets one clause", () => {
  const filter = root("or", [
    clause({
      prop: { source: "builtin", id: "status" },
      op: "is",
      value: "done",
    }),
    clause({
      prop: { source: "builtin", id: "createdBy" },
      op: "is",
      value: "bea",
    }),
  ]);
  assert.equal(issueMatches(issue({ status: "todo", createdBy: "bea" }), schema, filter), true);
  assert.equal(issueMatches(issue({ status: "todo", createdBy: "ada" }), schema, filter), false);
});

test("a custom field the issue does not declare fails that clause", () => {
  const filter = root("and", [
    clause({
      id: "points",
      prop: {
        source: "custom",
        projectId: "p1",
        level: "task",
        key: "points",
        fieldType: "number",
        label: "点数",
      },
      op: "gt",
      value: "3",
    }),
  ]);
  assert.equal(
    issueMatches(issue({ fields: { points: 5 } }), schema, filter),
    true,
  );
  assert.equal(
    issueMatches(issue({ level: "epic", fields: { points: 5 } }), schema, filter),
    false,
  );
  assert.equal(
    issueMatches(
      issue({ projectId: "p2", fields: { points: 5 } }),
      { epic: [{ key: "points" }], task: [], subtask: [] },
      filter,
    ),
    false,
  );
});

test("mixed and / or is a group, and ancestors of matches stay", () => {
  const filter = root("and", [
    clause({
      prop: { source: "builtin", id: "endDate" },
      op: "before",
      value: "2026-06-01",
    }),
    {
      kind: "group",
      id: "g",
      join: "or",
      children: [
        clause({
          id: "done",
          prop: { source: "builtin", id: "status" },
          op: "is",
          value: "done",
        }),
        clause({
          id: "who",
          prop: { source: "builtin", id: "createdBy" },
          op: "is",
          value: "bea",
        }),
      ],
    },
  ]);
  const tree = {
    roots: ["proj"],
    children: { proj: ["a", "b"], a: [], b: [] },
  };
  const applied = applyFilter(
    tree,
    (key) => {
      if (key === "a") {
        return issue({ status: "done" });
      }
      if (key === "b") {
        return issue({ status: "todo", createdBy: "ada" });
      }
      return null;
    },
    () => schema,
    filter,
  );
  assert.equal(applied.active, true);
  assert.equal(applied.matchCount, 1);
  assert.deepEqual([...applied.kept!].sort(), ["a", "proj"]);
  assert.match(
    summarize(filter, names),
    /Match all: End date before 2026-06-01, and \(Match any: /,
  );
});

test("summarize reads an unfinished clause without applying it", () => {
  const filter = root("and", [
    clause({
      prop: { source: "builtin", id: "endDate" },
      op: "before",
      value: "",
    }),
  ]);
  assert.equal(summarize(filter, names), "Match all: End date before …");
  assert.equal(issueMatches(issue(), schema, filter), false);
});

test("a project with no matches stays, and a non-matching epic does not", () => {
  const tree = {
    roots: ["p1", "p2"],
    children: { p1: ["epicA", "epicB"], epicA: ["taskA"], epicB: [], p2: ["epicC"] },
  };
  const projects = new Set(["p1", "p2"]);
  const kept = new Set(["p1", "epicA", "taskA"]);
  const rows = visibleRowKeys({
    tree,
    isProject: (key) => projects.has(key),
    projectIdOf: (key) => (key.startsWith("p2") || key === "epicC" ? "p2" : "p1"),
    kept,
    focusProjectId: null,
    collapsed: new Set(),
  });
  assert.deepEqual(
    rows.map((row) => row.key),
    ["p1", "epicA", "taskA", "p2"],
  );
});

test("focus limits the sheet to one project, and the filter still applies inside it", () => {
  const tree = {
    roots: ["p1", "p2"],
    children: { p1: ["epicA"], p2: ["epicC"], epicA: [], epicC: [] },
  };
  const projects = new Set(["p1", "p2"]);
  const base = {
    tree,
    isProject: (key: string) => projects.has(key),
    projectIdOf: (key: string) => (key === "p2" || key === "epicC" ? "p2" : "p1"),
    collapsed: new Set<string>(),
  };
  const focused = visibleRowKeys({
    ...base,
    kept: null,
    focusProjectId: "p2",
  });
  assert.deepEqual(
    focused.map((row) => row.key),
    ["p2", "epicC"],
  );
  const focusedEmpty = visibleRowKeys({
    ...base,
    kept: new Set(["p1", "epicA"]),
    focusProjectId: "p2",
  });
  assert.deepEqual(
    focusedEmpty.map((row) => row.key),
    ["p2"],
  );
});
