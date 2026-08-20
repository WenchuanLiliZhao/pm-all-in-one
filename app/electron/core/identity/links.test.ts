import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseIssueLinks,
  parseProjectLinks,
  projectLinkSyntax,
} from "./links.js";

const PROJECT = "abcdefghijklmnopqrs01";
const ISSUE = "abcdefghijklmnopqrs02";

test("parseIssueLinks requires ::issueId", () => {
  const md = `See @issue-${PROJECT}::${ISSUE} and bare @issue-${PROJECT}.`;
  const hits = parseIssueLinks(md);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.projectId, PROJECT);
  assert.equal(hits[0]!.issueId, ISSUE);
});

test("parseProjectLinks matches bare @issue-<projectId> only", () => {
  const md = `Project @issue-${PROJECT}; issue @issue-${PROJECT}::${ISSUE}.`;
  const hits = parseProjectLinks(md);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.projectId, PROJECT);
  assert.equal(hits[0]!.raw, `@issue-${PROJECT}`);
});

test("projectLinkSyntax is bare @issue-<projectId>", () => {
  assert.equal(projectLinkSyntax(PROJECT), `@issue-${PROJECT}`);
});
