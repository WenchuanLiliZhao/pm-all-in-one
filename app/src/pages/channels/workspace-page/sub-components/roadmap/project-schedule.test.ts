import assert from "node:assert/strict";
import { test } from "node:test";

import {
  projectScheduleFromIssues,
  projectSchedulesFromIssues,
} from "./project-schedule.ts";

test("closed issues: earliest start and latest end, even when they are different issues", () => {
  // Sorting by start and taking the last issue's end would yield Jun 20.
  // Sorting by end and taking the first issue's start would yield Jun 1.
  assert.deepEqual(
    projectScheduleFromIssues([
      { startDate: "2026-01-01", endDate: "2026-12-31" },
      { startDate: "2026-06-01", endDate: "2026-06-20" },
    ]),
    { startDate: "2026-01-01", endDate: "2026-12-31" },
  );
});

test("a closed span shorter than a week does not borrow the missing-side week", () => {
  assert.deepEqual(
    projectScheduleFromIssues([
      { startDate: "2026-01-01", endDate: "2026-01-03" },
      { startDate: "2026-01-10", endDate: "2026-01-12" },
    ]),
    { startDate: "2026-01-01", endDate: "2026-01-12" },
  );
});

test("end-only issue is earliest when end minus a week precedes every start", () => {
  // The only written date on the second issue is Mar 12, after Mar 10.
  // It still begins earlier, because a missing start is end − 7 days.
  assert.deepEqual(
    projectScheduleFromIssues([
      { startDate: "2026-03-10", endDate: "2026-03-20" },
      { startDate: null, endDate: "2026-03-12" },
    ]),
    { startDate: "2026-03-05", endDate: "2026-03-20" },
  );
});

test("end-only issue is not earliest when a real start precedes end minus a week", () => {
  assert.deepEqual(
    projectScheduleFromIssues([
      { startDate: "2026-02-01", endDate: "2026-02-10" },
      { startDate: null, endDate: "2026-03-12" },
    ]),
    { startDate: "2026-02-01", endDate: "2026-03-12" },
  );
});

test("start-only issue is latest when start plus a week follows every end", () => {
  assert.deepEqual(
    projectScheduleFromIssues([
      { startDate: "2026-03-01", endDate: "2026-03-05" },
      { startDate: "2026-03-04", endDate: null },
    ]),
    { startDate: "2026-03-01", endDate: "2026-03-11" },
  );
});

test("start-only issue is not latest when another issue ends after start plus a week", () => {
  assert.deepEqual(
    projectScheduleFromIssues([
      { startDate: "2026-03-01", endDate: "2026-03-31" },
      { startDate: "2026-03-04", endDate: null },
    ]),
    { startDate: "2026-03-01", endDate: "2026-03-31" },
  );
});

test("one issue with only a start spans that day through a week later", () => {
  assert.deepEqual(
    projectScheduleFromIssues([{ startDate: "2026-12-28", endDate: null }]),
    { startDate: "2026-12-28", endDate: "2027-01-04" },
  );
});

test("one issue with only an end spans a week earlier through that day", () => {
  assert.deepEqual(
    projectScheduleFromIssues([{ startDate: null, endDate: "2026-03-03" }]),
    { startDate: "2026-02-24", endDate: "2026-03-03" },
  );
});

test("inverted stored dates are ordered before the span is taken", () => {
  assert.deepEqual(
    projectScheduleFromIssues([
      { startDate: "2026-05-10", endDate: "2026-05-01" },
    ]),
    { startDate: "2026-05-01", endDate: "2026-05-10" },
  );
});

test("blank and unparseable dates are ignored", () => {
  assert.equal(
    projectScheduleFromIssues([
      { startDate: null, endDate: null },
      { startDate: "  ", endDate: "not-a-date" },
    ]),
    null,
  );
  assert.deepEqual(
    projectScheduleFromIssues([
      { startDate: "nope", endDate: "2026-04-20" },
      { startDate: "2026-04-01", endDate: "2026-04-03" },
    ]),
    { startDate: "2026-04-01", endDate: "2026-04-20" },
  );
});

test("issues from two projects do not share a span", () => {
  const map = projectSchedulesFromIssues([
    {
      projectId: "a",
      id: "1",
      startDate: "2026-01-01",
      endDate: "2026-01-10",
    },
    {
      projectId: "b",
      id: "2",
      startDate: "2026-06-01",
      endDate: "2026-06-10",
    },
  ]);
  assert.deepEqual(map.get("a"), {
    startDate: "2026-01-01",
    endDate: "2026-01-10",
  });
  assert.deepEqual(map.get("b"), {
    startDate: "2026-06-01",
    endDate: "2026-06-10",
  });
});

test("a drag preview replaces only the dragged issue inside its project", () => {
  const map = projectSchedulesFromIssues(
    [
      {
        projectId: "a",
        id: "1",
        startDate: "2026-01-01",
        endDate: "2026-01-10",
      },
      {
        projectId: "a",
        id: "2",
        startDate: "2026-02-01",
        endDate: "2026-02-10",
      },
      {
        projectId: "b",
        id: "2",
        startDate: "2026-02-01",
        endDate: "2026-02-05",
      },
    ],
    {
      projectId: "a",
      issueId: "2",
      startDate: "2026-03-01",
      endDate: "2026-03-20",
    },
  );
  assert.deepEqual(map.get("a"), {
    startDate: "2026-01-01",
    endDate: "2026-03-20",
  });
  assert.deepEqual(map.get("b"), {
    startDate: "2026-02-01",
    endDate: "2026-02-05",
  });
});
