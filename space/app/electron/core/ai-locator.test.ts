import assert from "node:assert/strict";
import { test } from "node:test";

import { formatAiLocator } from "./ai-locator.js";

const WIKI = "V1StGXR8_Z5jdHi6B-myT";
const PROJECT = "abcdefghijklmnopqrs01";
const ISSUE = "abcdefghijklmnopqrs02";

test("formatAiLocator wiki", () => {
  assert.equal(
    formatAiLocator({
      kind: "wiki",
      wikiNodeId: WIKI,
    }),
    `@wiki-${WIKI}`,
  );
});

test("formatAiLocator project", () => {
  assert.equal(
    formatAiLocator({
      kind: "project",
      projectId: PROJECT,
    }),
    PROJECT,
  );
});

test("formatAiLocator issue", () => {
  assert.equal(
    formatAiLocator({
      kind: "issue",
      projectId: PROJECT,
      issueId: ISSUE,
    }),
    `@issue-${PROJECT}::${ISSUE}`,
  );
});
