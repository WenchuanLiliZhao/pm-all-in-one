import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ENTITY_ID_LENGTH,
  ENTITY_ID_RE,
  compareIds,
  isBareNumericDir,
  isGluedLegacyId,
  isShardedLegacyId,
  isValidEntityId,
  parseId,
  parseIssueRefKey,
} from "./dir-id.js";

const SAMPLE = "V1StGXR8_Z5jdHi6B-myT";

test("ENTITY_ID_LENGTH and ENTITY_ID_RE", () => {
  assert.equal(ENTITY_ID_LENGTH, 21);
  assert.equal(SAMPLE.length, ENTITY_ID_LENGTH);
  assert.equal(ENTITY_ID_RE.test(SAMPLE), true);
  assert.equal(ENTITY_ID_RE.test("short"), false);
  assert.equal(ENTITY_ID_RE.test("a".repeat(20)), false);
  assert.equal(ENTITY_ID_RE.test("a".repeat(22)), false);
});

test("isValidEntityId / parseId accept nanoid(21)", () => {
  assert.equal(isValidEntityId(SAMPLE), true);
  assert.equal(parseId(SAMPLE), SAMPLE);
  assert.equal(isValidEntityId("ABCDEFGHIJKLMNOPQRSTU"), true);
  assert.equal(isValidEntityId("abc123_-XYZ789_-abc12"), true);
});

test("parseId rejects legacy and invalid shapes", () => {
  assert.equal(parseId("42"), null);
  assert.equal(parseId("w42"), null);
  assert.equal(parseId("w_42"), null);
  assert.equal(parseId("lili-zhao_3"), null);
  assert.equal(parseId("w_0"), null);
  assert.equal(parseId("w_03"), null);
  assert.equal(parseId(""), null);
  assert.equal(parseId("a".repeat(20)), null);
  assert.equal(parseId("a".repeat(22)), null);
  assert.equal(parseId("has spaces!!!!!!!!!!"), null);
  assert.equal(isValidEntityId("w_42"), false);
});

test("legacy detectors", () => {
  assert.equal(isBareNumericDir("42"), true);
  assert.equal(isBareNumericDir(SAMPLE), false);
  assert.equal(isBareNumericDir("w_42"), false);

  assert.equal(isGluedLegacyId("w42"), true);
  assert.equal(isGluedLegacyId("abcd1"), true);
  assert.equal(isGluedLegacyId("w_42"), false);
  assert.equal(isGluedLegacyId("42"), false);
  assert.equal(isGluedLegacyId(SAMPLE), false);

  assert.equal(isShardedLegacyId("w_42"), true);
  assert.equal(isShardedLegacyId("lili-zhao_3"), true);
  assert.equal(isShardedLegacyId("ck-chen_12"), true);
  assert.equal(isShardedLegacyId("42"), false);
  assert.equal(isShardedLegacyId("w42"), false);
  assert.equal(isShardedLegacyId(SAMPLE), false);
});

test("compareIds is lexicographic", () => {
  const a = "aaaaaaaaaaaaaaaaaaaa1";
  const b = "aaaaaaaaaaaaaaaaaaaa2";
  const c = "bbbbbbbbbbbbbbbbbbb01";
  assert.equal(compareIds(a, b) < 0, true);
  assert.equal(compareIds(b, a) > 0, true);
  assert.equal(compareIds(a, a), 0);
  const ids = [c, b, a];
  assert.deepEqual([...ids].sort(compareIds), [a, b, c]);
});

test("parseIssueRefKey with 21-char ids", () => {
  const projectId = "abcdefghijklmnopqrs01";
  const issueId = "abcdefghijklmnopqrs02";
  assert.deepEqual(parseIssueRefKey(`${projectId}::${issueId}`), {
    projectId,
    issueId,
  });
  assert.equal(parseIssueRefKey("w_1::w_2"), null);
  assert.equal(parseIssueRefKey(`${projectId}-${issueId}`), null);
  assert.equal(parseIssueRefKey(`${projectId}::${issueId}::extra`), null);
  assert.equal(parseIssueRefKey("w42::w1"), null);
  assert.equal(parseIssueRefKey(`${projectId}::short`), null);
});
