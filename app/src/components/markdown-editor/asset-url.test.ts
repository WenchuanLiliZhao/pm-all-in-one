import assert from "node:assert/strict";
import test from "node:test";

import {
  assetBasename,
  assetRelPath,
  encodeAssetRelPath,
  isNodeAssetRelUrl,
  markdownCiteForAssetBasename,
} from "./asset-url.ts";

test("assetRelPath allows nested posix paths and rejects traversal", () => {
  assert.equal(assetRelPath("assets/foo.png"), "foo.png");
  assert.equal(assetRelPath("assets/docs/a.pdf"), "docs/a.pdf");
  assert.equal(assetRelPath("assets/beauties/"), "beauties");
  assert.equal(assetRelPath("assets/docs/sub/"), "docs/sub");
  assert.equal(
    assetRelPath("assets/my%20folder/shot.png"),
    "my folder/shot.png",
  );
  assert.equal(assetRelPath("assets/foo%2Fbar.png"), null);
  assert.equal(assetRelPath("assets/../secret"), null);
  assert.equal(assetRelPath("assets/foo/../bar.png"), null);
  assert.equal(assetRelPath("assets//foo.png"), null);
  assert.equal(assetRelPath("https://example.com/a.png"), null);
  assert.equal(isNodeAssetRelUrl("assets/folder/x.png"), true);
  assert.equal(isNodeAssetRelUrl("assets/../x.png"), false);
});

test("encodeAssetRelPath encodes per segment, not the slash", () => {
  assert.equal(encodeAssetRelPath("foo.png"), "foo.png");
  assert.equal(
    encodeAssetRelPath("my folder/shot.png"),
    "my%20folder/shot.png",
  );
  assert.notEqual(
    encodeAssetRelPath("my folder/shot.png"),
    encodeURIComponent("my folder/shot.png"),
  );
  assert.equal(encodeAssetRelPath("beauties/"), "beauties/");
  assert.equal(isNodeAssetRelUrl("assets/beauties/"), true);
});

test("markdownCiteForAssetBasename cites nested images and files", () => {
  assert.equal(
    markdownCiteForAssetBasename("docs/shot.png"),
    "![shot](assets/docs/shot.png)",
  );
  assert.equal(
    markdownCiteForAssetBasename("docs/notes.pdf"),
    "[notes](assets/docs/notes.pdf)",
  );
  assert.equal(
    markdownCiteForAssetBasename("my folder/a.png"),
    "![a](assets/my%20folder/a.png)",
  );
  assert.equal(assetBasename("assets/docs/shot.png"), "shot.png");
  assert.equal(
    markdownCiteForAssetBasename("beauties/"),
    "[beauties](assets/beauties/)",
  );
});
