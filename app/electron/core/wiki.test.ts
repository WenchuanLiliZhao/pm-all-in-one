import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { isValidEntityId } from "./dir-id.js";
import { scanStrays } from "./doctor.js";
import {
  createWikiNode,
  deleteWikiNode,
  ensureWiki,
  getWikiNode,
  getWikiSnapshot,
  migrateLegacyFlatWikiNodes,
  moveWikiNodeInSidebar,
  moveWikiNodeToSidebarPosition,
  normalizeSidebarTags,
  setWikiSidebar,
  updateWikiNode,
  WikiSidebarUnreadableError,
} from "./wiki.js";
import { parseWikiLinks, wikiLinkSyntax } from "./links.js";
import { scaffoldWorkspace } from "./scaffold-workspace.js";

const SAMPLE_ID = "V1StGXR8_Z5jdHi6B-myT";
const ORPHAN_ID = "orphanNodeId________1";
const MISSING_ID = "missingNodeId_______2";
const MIGRATE_ID = "migrateFlatId_______3";

async function withTempWorkspace(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-docs-"));
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-ud-"));
  const prev = process.env.LOCAL_PM_USER_DATA;
  process.env.LOCAL_PM_USER_DATA = userData;
  try {
    scaffoldWorkspace(root, { title: "Wiki Test" });
    await fn(root);
  } finally {
    if (prev === undefined) {
      delete process.env.LOCAL_PM_USER_DATA;
    } else {
      process.env.LOCAL_PM_USER_DATA = prev;
    }
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(userData, { recursive: true, force: true });
  }
}

test("scaffold seeds empty wiki/sidebar.ts", async () => {
  await withTempWorkspace(async (root) => {
    const sidebar = path.join(root, "wiki", "sidebar.ts");
    assert.equal(fs.existsSync(sidebar), true);
    const snap = await ensureWiki(root);
    assert.deepEqual(snap.sidebar, []);
    assert.deepEqual(snap.nodes, []);
  });
});

test("createWikiNode always enters Contents at root", async () => {
  await withTempWorkspace(async (root) => {
    const page = await createWikiNode(root, { title: "Getting Started" });
    assert.equal(isValidEntityId(page.id), true);
    assert.equal(
      fs.existsSync(path.join(root, "wiki", page.id, "README.md")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(root, "wiki", page.id, "props.ts")),
      true,
    );
    assert.match(page.created, /Z$/);
    assert.equal(page.created, page.updated);
    assert.equal(page.title, "Getting Started");
    const snap = await getWikiSnapshot(root);
    assert.equal(snap.sidebar.length, 1);
    assert.equal(snap.sidebar[0]?.type, "ref");
    if (snap.sidebar[0]?.type === "ref") {
      assert.equal(snap.sidebar[0].id, page.id);
    }
    assert.deepEqual(snap.unlisted, []);
    assert.deepEqual(snap.broken, []);
  });
});

test("createWikiNode parentId nests under Contents parent", async () => {
  await withTempWorkspace(async (root) => {
    const parent = await createWikiNode(root, { title: "Parent" });
    const child = await createWikiNode(root, {
      title: "Child",
      parentId: parent.id,
    });
    const snap = await getWikiSnapshot(root);
    assert.equal(snap.sidebar.length, 1);
    assert.equal(snap.sidebar[0]?.type, "ref");
    if (snap.sidebar[0]?.type === "ref") {
      assert.equal(snap.sidebar[0].id, parent.id);
      assert.equal(snap.sidebar[0].children?.[0]?.type, "ref");
      if (snap.sidebar[0].children?.[0]?.type === "ref") {
        assert.equal(snap.sidebar[0].children[0].id, child.id);
      }
    }
    assert.deepEqual(snap.unlisted, []);
  });
});

test("createWikiNode works without writer handle", async () => {
  await withTempWorkspace(async (root) => {
    const page = await createWikiNode(root, { title: "No Handle Needed" });
    assert.equal(isValidEntityId(page.id), true);
    assert.equal(page.title, "No Handle Needed");
  });
});

test("getWikiSnapshot reconciles orphans into Contents; doctor reports wiki-unlisted", async () => {
  await withTempWorkspace(async (root) => {
    const listed = await createWikiNode(root, {
      title: "Listed",
    });
    const orphanDir = path.join(root, "wiki", ORPHAN_ID);
    fs.mkdirSync(orphanDir, { recursive: true });
    fs.writeFileSync(path.join(orphanDir, "README.md"), "# Orphan\n", "utf8");
    fs.writeFileSync(
      path.join(orphanDir, "props.ts"),
      `export const props = { "title": "Orphan", "created": "2026-01-01T00:00:00.000Z", "updated": "2026-01-01T00:00:00.000Z" } as const;\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "wiki", "legacy-slug.md"),
      "# Legacy\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "wiki", "sidebar.ts"),
      `export const props = [
  { type: "page", id: ${JSON.stringify(listed.id)} },
  { type: "page", id: ${JSON.stringify(MISSING_ID)} },
] as const;
`,
      "utf8",
    );

    // Doctor reads disk without reconcile — orphan is a fault.
    const report = scanStrays(root);
    assert.ok(report.warnings.some((w) => w.kind === "wiki-unlisted"));
    assert.ok(report.warnings.some((w) => w.kind === "wiki-broken-ref"));
    assert.ok(report.warnings.some((w) => w.kind === "wiki-invalid-name"));

    // App load reconciles orphan into Contents root.
    const snap = await getWikiSnapshot(root);
    assert.deepEqual(snap.unlisted, []);
    assert.ok(snap.broken.includes(MISSING_ID));
    assert.ok(snap.invalidNames.includes("legacy-slug"));
    assert.ok(
      snap.sidebar.some((n) => n.type === "ref" && n.id === ORPHAN_ID),
    );
    assert.ok(
      snap.sidebar.some((n) => n.type === "ref" && n.id === listed.id),
    );
  });
});

test("legacy page tags normalize; mutator does not wipe Contents", async () => {
  await withTempWorkspace(async (root) => {
    const a = await createWikiNode(root, { title: "A" });
    const b = await createWikiNode(root, { title: "B" });
    fs.writeFileSync(
      path.join(root, "wiki", "sidebar.ts"),
      `export const props = [
  { type: "page", id: ${JSON.stringify(a.id)}, children: [{ type: "page", id: ${JSON.stringify(b.id)} }] },
] as const;
`,
      "utf8",
    );
    const snap = await getWikiSnapshot(root);
    assert.equal(snap.sidebar[0]?.type, "ref");
    if (snap.sidebar[0]?.type === "ref") {
      assert.equal(snap.sidebar[0].children?.[0]?.type, "ref");
    }

    await createWikiNode(root, { title: "C" });
    const after = await getWikiSnapshot(root);
    assert.equal(after.sidebar.length, 2);
    assert.equal(after.sidebar[0]?.type, "ref");
    if (after.sidebar[0]?.type === "ref") {
      assert.equal(after.sidebar[0].id, a.id);
      assert.equal(after.sidebar[0].children?.[0]?.type, "ref");
    }
  });
});

test("corrupt sidebar emits wiki-sidebar-unreadable and refuses mutators", async () => {
  await withTempWorkspace(async (root) => {
    fs.writeFileSync(
      path.join(root, "wiki", "sidebar.ts"),
      `export const props = "not-an-array";\n`,
      "utf8",
    );
    const report = scanStrays(root);
    assert.ok(
      report.warnings.some((w) => w.kind === "wiki-sidebar-unreadable"),
    );
    await assert.rejects(
      () => createWikiNode(root, { title: "X" }),
      /unreadable/i,
    );
    const raw = fs.readFileSync(path.join(root, "wiki", "sidebar.ts"), "utf8");
    assert.match(raw, /not-an-array/);
  });
});

test("setWikiSidebar accepts legacy page tags", async () => {
  await withTempWorkspace(async (root) => {
    const a = await createWikiNode(root, { title: "A" });
    const next = await setWikiSidebar(root, [
      { type: "page" as unknown as "ref", id: a.id, label: "A" },
    ]);
    assert.equal(next[0]?.type, "ref");
    const disk = fs.readFileSync(path.join(root, "wiki", "sidebar.ts"), "utf8");
    assert.match(disk, /"type": "ref"/);
    assert.doesNotMatch(disk, /"type": "page"/);
  });
});

test("normalizeSidebarTags maps nested page to ref", () => {
  const out = normalizeSidebarTags([
    {
      type: "page",
      id: SAMPLE_ID,
      children: [{ type: "page", id: MIGRATE_ID }],
    },
  ]) as Array<{ type: string; children?: Array<{ type: string }> }>;
  assert.equal(out[0]?.type, "ref");
  assert.equal(out[0]?.children?.[0]?.type, "ref");
});

test("move / update / delete; ids never renamed; timestamps enforced", async () => {
  await withTempWorkspace(async (root) => {
    const a = await createWikiNode(root, { title: "Alpha" });
    const b = await createWikiNode(root, { title: "Beta" });
    assert.equal(isValidEntityId(a.id), true);
    assert.equal(isValidEntityId(b.id), true);
    assert.notEqual(a.id, b.id);
    const createdBefore = a.created;

    let snap = await getWikiSnapshot(root);
    await moveWikiNodeInSidebar(root, b.id, "up");
    snap = await getWikiSnapshot(root);
    assert.equal(
      snap.sidebar[0]?.type === "ref" ? snap.sidebar[0].id : "",
      b.id,
    );

    await moveWikiNodeInSidebar(root, a.id, "indent");
    snap = await getWikiSnapshot(root);
    const beta = snap.sidebar[0];
    assert.equal(beta?.type, "ref");
    if (beta?.type === "ref") {
      assert.equal(beta.children?.[0]?.type, "ref");
    }

    await new Promise((r) => setTimeout(r, 5));
    await updateWikiNode(root, a.id, { body: "# Renamed title\n\nBody\n" });
    const page = await getWikiNode(root, a.id);
    assert.equal(page.id, a.id);
    assert.match(page.body, /Body/);
    assert.equal(page.title, "Alpha");
    assert.equal(page.created, createdBefore);
    assert.ok(page.updated >= createdBefore);

    await updateWikiNode(root, a.id, { title: "Renamed via props" });
    const renamed = await getWikiNode(root, a.id);
    assert.equal(renamed.title, "Renamed via props");
    assert.equal(renamed.created, createdBefore);

    fs.writeFileSync(
      path.join(root, "wiki", a.id, "props.ts"),
      `export const props = {
  "title": "Renamed via props",
  "created": "1999-01-01T00:00:00.000Z",
  "updated": "1999-01-01T00:00:00.000Z"
} as const;
`,
      "utf8",
    );
    await updateWikiNode(root, a.id, { body: "Body again\n" });
    const afterTamper = await getWikiNode(root, a.id);
    assert.equal(afterTamper.title, "Renamed via props");
    assert.equal(afterTamper.created, "1999-01-01T00:00:00.000Z");
    assert.notEqual(afterTamper.updated, "1999-01-01T00:00:00.000Z");
    assert.match(afterTamper.updated, /Z$/);

    await deleteWikiNode(root, a.id, { removeFile: true });
    assert.equal(fs.existsSync(path.join(root, "wiki", a.id)), false);
    snap = await getWikiSnapshot(root);
    assert.ok(!snap.sidebar.some((n) => n.type === "ref" && n.id === a.id));
    assert.deepEqual(snap.unlisted, []);

    const again = await createWikiNode(root, { title: "Gamma" });
    assert.equal(isValidEntityId(again.id), true);
    assert.notEqual(again.id, a.id);
    assert.notEqual(again.id, b.id);
    snap = await getWikiSnapshot(root);
    assert.ok(snap.sidebar.some((n) => n.type === "ref" && n.id === again.id));
    assert.deepEqual(snap.unlisted, []);
  });
});

test("migrateLegacyFlatWikiNodes converts flat md to dir", async () => {
  await withTempWorkspace(async (root) => {
    fs.writeFileSync(
      path.join(root, "wiki", `${MIGRATE_ID}.md`),
      "# Migrated\n\nHello\n",
      "utf8",
    );
    migrateLegacyFlatWikiNodes(root);
    assert.equal(fs.existsSync(path.join(root, "wiki", `${MIGRATE_ID}.md`)), false);
    assert.equal(
      fs.existsSync(path.join(root, "wiki", MIGRATE_ID, "README.md")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(root, "wiki", MIGRATE_ID, "props.ts")),
      true,
    );
    const page = await getWikiNode(root, MIGRATE_ID);
    assert.equal(page.title, "Migrated");
    assert.match(page.body, /Hello/);
  });
});

test("parseWikiLinks and wikiLinkSyntax", () => {
  assert.equal(wikiLinkSyntax(SAMPLE_ID), `@wiki-${SAMPLE_ID}`);
  const refs = parseWikiLinks(
    `See @wiki-${SAMPLE_ID} and @issue-abcdefghijklmnopqrs01::abcdefghijklmnopqrs02.`,
  );
  assert.equal(refs.length, 1);
  assert.equal(refs[0]!.wikiNodeId, SAMPLE_ID);
});

test("moveWikiNodeToSidebarPosition same-parent index adjust", async () => {
  await withTempWorkspace(async (root) => {
    const a = await createWikiNode(root, { title: "A" });
    const b = await createWikiNode(root, { title: "B" });
    const c = await createWikiNode(root, { title: "C" });
    // [A,B,C] move A to pre-index 2 → [B,A,C]
    let snap = await moveWikiNodeToSidebarPosition(root, a.id, {
      parentId: null,
      index: 2,
    });
    assert.deepEqual(
      snap.sidebar.map((n) => (n.type === "ref" ? n.id : "")),
      [b.id, a.id, c.id],
    );
    // move C (now at index 2) to index 0 → [C,B,A]
    snap = await moveWikiNodeToSidebarPosition(root, c.id, {
      parentId: null,
      index: 0,
    });
    assert.deepEqual(
      snap.sidebar.map((n) => (n.type === "ref" ? n.id : "")),
      [c.id, b.id, a.id],
    );
  });
});

test("moveWikiNodeToSidebarPosition preserves subtree and rejects cycles", async () => {
  await withTempWorkspace(async (root) => {
    const a = await createWikiNode(root, { title: "A" });
    const b = await createWikiNode(root, { title: "B" });
    const c = await createWikiNode(root, { title: "C" });
    const d = await createWikiNode(root, { title: "D" });
    await createWikiNode(root, { title: "E" });
    // Build A{B{C}, D}, E via absolute moves
    await moveWikiNodeToSidebarPosition(root, b.id, {
      parentId: a.id,
      index: 0,
    });
    await moveWikiNodeToSidebarPosition(root, c.id, {
      parentId: b.id,
      index: 0,
    });
    await moveWikiNodeToSidebarPosition(root, d.id, {
      parentId: a.id,
      index: 1,
    });
    // Move B (with C) to root index 1
    let snap = await moveWikiNodeToSidebarPosition(root, b.id, {
      parentId: null,
      index: 1,
    });
    assert.equal(snap.sidebar.length, 3);
    const bNode = snap.sidebar[1];
    assert.equal(bNode?.type, "ref");
    if (bNode?.type === "ref") {
      assert.equal(bNode.id, b.id);
      assert.equal(
        bNode.children?.[0]?.type === "ref" ? bNode.children[0].id : "",
        c.id,
      );
    }
    const aNode = snap.sidebar[0];
    assert.equal(aNode?.type, "ref");
    if (aNode?.type === "ref") {
      assert.equal(
        aNode.children?.[0]?.type === "ref" ? aNode.children[0].id : "",
        d.id,
      );
    }

    await assert.rejects(
      () =>
        moveWikiNodeToSidebarPosition(root, a.id, {
          parentId: d.id,
          index: 0,
        }),
      /own subtree/,
    );
    await assert.rejects(
      () =>
        moveWikiNodeToSidebarPosition(root, b.id, {
          parentId: b.id,
          index: 0,
        }),
      /own subtree/,
    );
  });
});

test("corrupt sidebar refuses moveWikiNodeToSidebarPosition", async () => {
  await withTempWorkspace(async (root) => {
    const a = await createWikiNode(root, { title: "A" });
    fs.writeFileSync(
      path.join(root, "wiki", "sidebar.ts"),
      "export const props = not-an-array;\n",
      "utf8",
    );
    await assert.rejects(
      () =>
        moveWikiNodeToSidebarPosition(root, a.id, {
          parentId: null,
          index: 0,
        }),
      WikiSidebarUnreadableError,
    );
  });
});

test("updateWikiNode CAS rejects stale expected baseline for body", async () => {
  await withTempWorkspace(async (root) => {
    const page = await createWikiNode(root, { title: "CAS wiki" });
    const { pickWikiEditable, StaleWriteError } = await import("./detail-diff.js");
    const expected = pickWikiEditable(page);
    await updateWikiNode(root, page.id, { body: "external\n" });
    await assert.rejects(
      () =>
        updateWikiNode(
          root,
          page.id,
          { body: "mine\n" },
          { expected },
        ),
      (err: unknown) => err instanceof StaleWriteError,
    );
  });
});

test("updateWikiNode CAS allows write when expected matches disk", async () => {
  await withTempWorkspace(async (root) => {
    const page = await createWikiNode(root, { title: "CAS ok" });
    const { pickWikiEditable } = await import("./detail-diff.js");
    const expected = pickWikiEditable(page);
    const next = await updateWikiNode(
      root,
      page.id,
      { body: "ok body\n" },
      { expected },
    );
    assert.equal(next.body, "ok body\n");
  });
});

test("updateWikiNode CAS is file-granular: title stale does not block body-only when title untouched", async () => {
  await withTempWorkspace(async (root) => {
    const page = await createWikiNode(root, { title: "Granular" });
    const { pickWikiEditable } = await import("./detail-diff.js");
    const expected = pickWikiEditable(page);
    await updateWikiNode(root, page.id, { title: "External title" });
    const next = await updateWikiNode(
      root,
      page.id,
      { body: "body only\n" },
      { expected },
    );
    assert.equal(next.body, "body only\n");
    assert.equal(next.title, "External title");
  });
});

test("updateWikiNode without expected still writes (legacy)", async () => {
  await withTempWorkspace(async (root) => {
    const page = await createWikiNode(root, { title: "Legacy" });
    const next = await updateWikiNode(root, page.id, { body: "no occ\n" });
    assert.equal(next.body, "no occ\n");
  });
});
