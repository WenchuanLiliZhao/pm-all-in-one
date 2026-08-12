import assert from "node:assert/strict";
import test from "node:test";

/** Mirrors assetCompletions matchBefore pattern (basename slot only). */
const ASSET_URL_SLOT = /!?\[[^\]]*\]\(assets\/[^)\n]*$/;

test("asset slot matches ![](assets/ and [](assets/", () => {
  assert.match("![](assets/", ASSET_URL_SLOT);
  assert.match("![cap](assets/fo", ASSET_URL_SLOT);
  assert.match("[label](assets/", ASSET_URL_SLOT);
  assert.match("[label](assets/notes.pd", ASSET_URL_SLOT);
  assert.match("![](assets/Maximum%20Carnage", ASSET_URL_SLOT);
  assert.match("![](assets/Maximum ", ASSET_URL_SLOT);
});

test("asset slot rejects bare assets/ and incomplete links", () => {
  assert.doesNotMatch("assets/", ASSET_URL_SLOT);
  assert.doesNotMatch("assets/foo", ASSET_URL_SLOT);
  assert.doesNotMatch("(assets/", ASSET_URL_SLOT);
  assert.doesNotMatch("[]assets/", ASSET_URL_SLOT);
});
