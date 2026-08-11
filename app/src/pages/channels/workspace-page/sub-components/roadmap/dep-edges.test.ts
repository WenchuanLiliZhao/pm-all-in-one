import assert from "node:assert/strict";
import { test } from "node:test";

import {
  collectBlockedByEdges,
  DEP_EDGE_TOKENS,
  findLinkDropTarget,
  inboundLinkAnchor,
  layoutDepEdges,
  outboundLinkAnchor,
  outwardDepPath,
  rowCenterY,
} from "./dep-edges.ts";

test("inbound/outbound anchors and drop target", () => {
  const anchors = [
    { id: "a", rowIndex: 0, leftPx: 10, widthPx: 40 },
    { id: "b", rowIndex: 1, leftPx: 80, widthPx: 50 },
  ];
  assert.deepEqual(outboundLinkAnchor(anchors[0]!, 36), { x: 50, y: 18 });
  assert.deepEqual(inboundLinkAnchor(anchors[1]!, 36), { x: 80, y: 54 });
  assert.equal(
    findLinkDropTarget(anchors, "a", 100, 54, 36)?.id,
    "b",
  );
  assert.equal(findLinkDropTarget(anchors, "a", 50, 18, 36), null);
});

test("rowCenterY and outwardDepPath use DEP_EDGE_TOKENS", () => {
  assert.equal(rowCenterY(0, 36), 18);
  assert.equal(rowCenterY(2, 36), 90);
  const { outwardStubPx: stub, turnCurvature: k } = DEP_EDGE_TOKENS;
  const midY = (10 + 50) / 2;
  const c1y = 10 + (midY - 10) * k;
  const c2y = 50 + (midY - 50) * k;
  assert.equal(
    outwardDepPath(0, 10, 100, 50),
    `M 0 10 C ${stub} ${c1y}, ${100 - stub} ${c2y}, 100 50`,
  );
  // Reverse bars still push controls outside each endpoint.
  const loop = outwardDepPath(80, 10, 40, 50, { outwardStubPx: 28, turnCurvature: 0 });
  assert.equal(loop, `M 80 10 C ${80 + 28} 10, ${40 - 28} 50, 40 50`);
});

test("layoutDepEdges skips missing anchors and uses outward path", () => {
  const anchors = [
    { id: "a", rowIndex: 0, leftPx: 10, widthPx: 40 },
    { id: "b", rowIndex: 1, leftPx: 80, widthPx: 50 },
  ];
  const paths = layoutDepEdges(
    anchors,
    [
      { fromId: "a", toId: "b" },
      { fromId: "a", toId: "missing" },
    ],
    36,
  );
  assert.equal(paths.length, 1);
  assert.equal(paths[0]!.fromId, "a");
  assert.equal(paths[0]!.toId, "b");
  assert.equal(paths[0]!.x1, 50);
  assert.equal(paths[0]!.x2, 80);
  assert.equal(
    paths[0]!.d,
    outwardDepPath(50, 18, 80, 54, DEP_EDGE_TOKENS),
  );
});

test("collectBlockedByEdges expands blocker lists", () => {
  assert.deepEqual(
    collectBlockedByEdges([
      { id: "t", blockedBy: ["a", "b"] },
      { id: "a", blockedBy: [] },
    ]),
    [
      { fromId: "a", toId: "t" },
      { fromId: "b", toId: "t" },
    ],
  );
});
