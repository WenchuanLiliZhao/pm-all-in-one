/**
 * Directory names carry identity and nothing else.
 *
 * A project lives at `issue-hierarchy/<projectId>/` and an issue at
 * `issue-hierarchy/<projectId>/<issueId>/`, so `@issue-<p>::<i>` resolves to a
 * path by joining those ids — no index, no search, no running app. The name
 * never changes once created, which is what keeps paths safe to hold onto.
 *
 * Ids are opaque nanoid(21) tokens (URL-safe alphabet). Collision resistance
 * comes from entropy at create time — not writer handles or counters.
 */

/** Opaque directory / entity id: nanoid(21), e.g. `V1StGXR8_Z5jdHi6B-myT`. */
export type EntityId = string;

/** Fixed length for entity directory names. */
export const ENTITY_ID_LENGTH = 21;

/**
 * nanoid default URL-safe alphabet: A-Za-z0-9_-
 * Full-string match; length exactly ENTITY_ID_LENGTH.
 */
export const ENTITY_ID_RE = /^[A-Za-z0-9_-]{21}$/;

/**
 * Source fragment for embedding in larger regexes (one entity id, one capture).
 */
export const ENTITY_ID_SRC = `([A-Za-z0-9_-]{${ENTITY_ID_LENGTH}})`;

/** Compound issue address delimiter — never used in directory names. */
export const ISSUE_REF_SEP = "::";

/** Bare digit dirs from the pre-shard layout — rejected in strict mode. */
const BARE_NUMERIC_RE = /^\d+$/;

/** Old glued shard dirs (`w42`) — rejected. */
const GLUED_LEGACY_RE = /^[a-z]{1,4}\d+$/;

/** Pre-token sharded ids (`w_42`, `lili-zhao_3`) — rejected after nanoid cutover. */
const SHARDED_LEGACY_RE = /^[a-z](?:[a-z0-9]|-[a-z0-9])*_[1-9]\d*$/;

export function isValidEntityId(id: string): boolean {
  return ENTITY_ID_RE.test(id);
}

/** @deprecated Use isValidEntityId. */
export function parseId(dirName: string): EntityId | null {
  return isValidEntityId(dirName) ? dirName : null;
}

/** Default sort: lexicographic on raw id. Create order lives in view-orders. */
export function compareIds(a: EntityId, b: EntityId): number {
  return a.localeCompare(b);
}

export function isBareNumericDir(dirName: string): boolean {
  return BARE_NUMERIC_RE.test(dirName);
}

/** Pre-underscore glued shard id (`w42`). */
export function isGluedLegacyId(dirName: string): boolean {
  return GLUED_LEGACY_RE.test(dirName) && !isValidEntityId(dirName);
}

/** Former `<handle>_<seq>` ids — unsupported after opaque-token cutover. */
export function isShardedLegacyId(dirName: string): boolean {
  return SHARDED_LEGACY_RE.test(dirName) && !isValidEntityId(dirName);
}

/**
 * Split `projectId::issueId`. Returns null unless exactly one `::` and both
 * sides are valid entity ids.
 */
export function parseIssueRefKey(
  key: string,
): { projectId: EntityId; issueId: EntityId } | null {
  const parts = key.split(ISSUE_REF_SEP);
  if (parts.length !== 2) {
    return null;
  }
  const projectId = parts[0]!;
  const issueId = parts[1]!;
  if (!isValidEntityId(projectId) || !isValidEntityId(issueId)) {
    return null;
  }
  return { projectId, issueId };
}

/** Markdown custom prop `verificationStandard` -> `verification-standard.md`. */
export function keyToKebab(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}
