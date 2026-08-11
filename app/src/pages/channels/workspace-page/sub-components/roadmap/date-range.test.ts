import assert from "node:assert/strict";
import { test } from "node:test";

import {
  centerMsFromScroll,
  dayStartUtc,
  msToPx,
  scrollLeftForCenterMs,
  seedWindow,
  todayAnchorMs,
  unitStartUtc,
} from "./date-range.ts";

test("todayAnchorMs is UTC day midpoint (not wall-clock now, not day/unit start)", () => {
  const now = Date.UTC(2026, 7, 9, 15, 45, 30); // Aug 9 15:45 UTC
  const anchor = todayAnchorMs(now);
  assert.equal(anchor, dayStartUtc(now) + 12 * 60 * 60 * 1000);
  assert.equal(anchor, Date.UTC(2026, 7, 9, 12));
  assert.notEqual(anchor, now);
  assert.notEqual(anchor, dayStartUtc(now));
  assert.notEqual(anchor, unitStartUtc("month", now));
});

test("scrollLeftForCenterMs puts todayAnchor at viewport center (refresh ≡ Today rail)", () => {
  const now = Date.UTC(2026, 7, 9, 15, 45, 30);
  const anchor = todayAnchorMs(now);
  // Even unit count is common at real widths — geometric window midpoint is unit start.
  const V = 1400;
  const window = seedWindow("month", V, anchor);
  assert.equal(window.units.length % 2, 0, "fixture expects even unit count");

  const left = scrollLeftForCenterMs(window, anchor, V);
  const centered = centerMsFromScroll(window, left, V);
  // Continuous map can land within a day; must not snap to month start.
  assert.ok(Math.abs(centered - anchor) < 24 * 60 * 60 * 1000);
  assert.notEqual(
    unitStartUtc("month", centered),
    centered,
    "centered ms must not be the month-start rail",
  );

  const todayPx = msToPx(anchor, window);
  const monthStartPx = msToPx(unitStartUtc("month", anchor), window);
  assert.notEqual(
    todayPx,
    monthStartPx,
    "today line and month-start grid are different rails",
  );
  // Viewport center should sit on the today line, not the month boundary.
  const midPx = left + V / 2;
  assert.ok(Math.abs(midPx - todayPx) < 1);
  assert.ok(Math.abs(midPx - monthStartPx) > 10);
});
