import assert from "node:assert/strict";
import test from "node:test";

import {
  assetFolderMentionSyntax,
  parseAssetFolderMentionToken,
  toAssetFolderMentionCandidates,
} from "./asset-mention-completions.ts";

/** Same token class as Live `MENTION_RE` (slashes / % for @assets/…). */
const MENTION_RE = /@[A-Za-z][\w:./%-]*/g;

test("folder mentions encode per segment and parse back", () => {
  assert.equal(assetFolderMentionSyntax("beauties"), "@assets/beauties");
  assert.equal(
    assetFolderMentionSyntax("my folder/shots"),
    "@assets/my%20folder/shots",
  );
  assert.equal(
    parseAssetFolderMentionToken("@assets/my%20folder/shots"),
    "my folder/shots",
  );
  assert.equal(parseAssetFolderMentionToken("@assets/beauties/"), "beauties");
  assert.equal(parseAssetFolderMentionToken("@wiki-abc"), null);
  assert.equal(parseAssetFolderMentionToken("@assets/../x"), null);
});

test("toAssetFolderMentionCandidates uses trailing-slash list entries", () => {
  const rows = toAssetFolderMentionCandidates([
    "docs/",
    "docs/a.pdf",
    "docs/sub/",
    "vacant/",
  ]);
  assert.deepEqual(
    rows.map((r) => [r.label, r.insertText]),
    [
      ["docs", "@assets/docs"],
      ["sub", "@assets/docs/sub"],
      ["vacant", "@assets/vacant"],
    ],
  );
});

test("Live mention regex keeps @assets nested path as one token", () => {
  assert.equal(
    "@assets/foo/bar next".match(MENTION_RE)?.[0],
    "@assets/foo/bar",
  );
  assert.equal(
    "@assets/my%20folder".match(MENTION_RE)?.[0],
    "@assets/my%20folder",
  );
});
