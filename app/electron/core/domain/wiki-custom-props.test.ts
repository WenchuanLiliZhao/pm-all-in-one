import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { scaffoldWorkspace } from "../workspace/scaffold-workspace.js";
import { createWikiNode, getWikiNode, updateWikiNode } from "./wiki.js";
import { scanWorkspace } from "../workspace/doctor.js";
import {
  countWikiFieldUsage,
  emptyWikiCustomProps,
  listWikiIncomingRefs,
  loadWikiCustomProps,
  parseStringList,
  parseWikiNodeIdList,
  writeWikiCustomProps,
} from "./wiki-custom-props.js";

async function withTempWorkspace(
  fn: (root: string) => Promise<void>,
): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-wiki-cp-"));
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "local-pm-ud-"));
  const prev = process.env.LOCAL_PM_USER_DATA;
  process.env.LOCAL_PM_USER_DATA = userData;
  try {
    scaffoldWorkspace(root, { title: "Wiki custom props test" });
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

test("missing wiki/custom-props.ts loads as empty schema", async () => {
  await withTempWorkspace(async (root) => {
    fs.rmSync(path.join(root, "wiki", "custom-props.ts"), { force: true });
    const schema = await loadWikiCustomProps(root);
    assert.deepEqual(schema, emptyWikiCustomProps());
  });
});

test("writeWikiCustomProps rejects reserved keys and readme collision", async () => {
  await withTempWorkspace(async (root) => {
    assert.throws(
      () =>
        writeWikiCustomProps(root, {
          fields: [{ key: "title", label: "T", type: "string" }],
        }),
      /reserved key title/,
    );
    assert.throws(
      () =>
        writeWikiCustomProps(root, {
          fields: [{ key: "README", label: "Body", type: "markdown" }],
        }),
      /collides with README.md/,
    );
    assert.throws(
      () =>
        writeWikiCustomProps(root, {
          fields: [
            { key: "note", label: "A", type: "string" },
            { key: "note", label: "B", type: "string" },
          ],
        }),
      /duplicate wiki custom prop key note/,
    );
  });
});

test("wiki node scalar + markdown custom fields round-trip", async () => {
  await withTempWorkspace(async (root) => {
    writeWikiCustomProps(root, {
      fields: [
        { key: "audience", label: "Audience", type: "string" },
        { key: "notes", label: "Notes", type: "markdown" },
      ],
    });
    const page = await createWikiNode(root, { title: "Page" });
    assert.deepEqual(page.fields, {});
    assert.equal(page.markdownFields.notes, "");
    assert.ok(!("audience" in JSON.parse(JSON.stringify(page.fields))));

    const next = await updateWikiNode(root, page.id, {
      fields: { audience: "agents" },
      markdownFields: { notes: "standing notes\n" },
    });
    assert.equal(next.fields.audience, "agents");
    assert.equal(next.markdownFields.notes, "standing notes\n");

    const propsText = fs.readFileSync(
      path.join(root, "wiki", page.id, "props.ts"),
      "utf8",
    );
    assert.match(propsText, /"audience": "agents"/);
    assert.doesNotMatch(propsText, /notes/);
    assert.match(propsText, /satisfies WikiNodeProps/);
    const sidecar = fs.readFileSync(
      path.join(root, "wiki", page.id, "notes.md"),
      "utf8",
    );
    assert.equal(sidecar, "standing notes\n");
  });
});

test("undeclared orphan keys still enter fields", async () => {
  await withTempWorkspace(async (root) => {
    const page = await createWikiNode(root, { title: "Orphan" });
    const propsFile = path.join(root, "wiki", page.id, "props.ts");
    const current = fs.readFileSync(propsFile, "utf8");
    fs.writeFileSync(
      propsFile,
      current.replace(
        `"title": "Orphan"`,
        `"title": "Orphan",\n  "extra": "kept"`,
      ),
      "utf8",
    );
    const loaded = await getWikiNode(root, page.id);
    assert.equal(loaded.fields.extra, "kept");
  });
});

test("countWikiFieldUsage counts props and sidecar values", async () => {
  await withTempWorkspace(async (root) => {
    writeWikiCustomProps(root, {
      fields: [
        { key: "audience", label: "Audience", type: "string" },
        { key: "notes", label: "Notes", type: "markdown" },
      ],
    });
    const a = await createWikiNode(root, { title: "A" });
    const b = await createWikiNode(root, { title: "B" });
    await updateWikiNode(root, a.id, { fields: { audience: "one" } });
    await updateWikiNode(root, b.id, { markdownFields: { notes: "two" } });
    assert.equal(await countWikiFieldUsage(root, "audience"), 1);
    assert.equal(await countWikiFieldUsage(root, "notes"), 1);
    assert.equal(await countWikiFieldUsage(root, "missing"), 0);
  });
});

test("updateWikiNode CAS is key-granular for custom fields", async () => {
  await withTempWorkspace(async (root) => {
    writeWikiCustomProps(root, {
      fields: [{ key: "audience", label: "Audience", type: "string" }],
    });
    const page = await createWikiNode(root, { title: "CAS fields" });
    const { pickWikiEditable, StaleWriteError } = await import(
      "../sync/detail-diff.js"
    );
    const expected = pickWikiEditable(page);
    await updateWikiNode(root, page.id, { fields: { audience: "external" } });
    await assert.rejects(
      () =>
        updateWikiNode(
          root,
          page.id,
          { fields: { audience: "mine" } },
          { expected },
        ),
      (err: unknown) => err instanceof StaleWriteError,
    );
    const next = await updateWikiNode(
      root,
      page.id,
      { body: "body only\n" },
      { expected },
    );
    assert.equal(next.body, "body only\n");
    assert.equal(next.fields.audience, "external");
  });
});

test("parseWikiNodeIdList rejects invalid format and dedupes", () => {
  assert.deepEqual(parseWikiNodeIdList(undefined), []);
  assert.deepEqual(parseWikiNodeIdList([]), []);
  assert.throws(() => parseWikiNodeIdList(["nope"]), /not a valid id/);
  assert.throws(() => parseWikiNodeIdList(1), /must be wiki-node ids/);
});

test("parseStringList rejects non-strings, trims, and dedupes", () => {
  assert.deepEqual(parseStringList(undefined), []);
  assert.deepEqual(parseStringList([]), []);
  assert.deepEqual(parseStringList(["  pm ", "pm", "kb"]), ["pm", "kb"]);
  assert.deepEqual(parseStringList("solo"), ["solo"]);
  assert.throws(() => parseStringList(1), /must be strings/);
  assert.throws(() => parseStringList(["ok", 2]), /must be strings/);
});

test("writeWikiCustomProps accepts string-list", async () => {
  await withTempWorkspace(async (root) => {
    writeWikiCustomProps(root, {
      fields: [
        {
          key: "keywords",
          label: "Keywords",
          type: "string-list",
          help: "Retrieval synonyms.",
        },
      ],
    });
    const schema = await loadWikiCustomProps(root);
    assert.equal(schema.fields[0]?.type, "string-list");
    assert.match(
      fs.readFileSync(path.join(root, "wiki", "schema.d.ts"), "utf8"),
      /keywords\?: string\[\]/,
    );
    assert.match(
      fs.readFileSync(path.join(root, "wiki", "schema.d.ts"), "utf8"),
      /string-list fields are string\[\] of free-text tokens/,
    );
  });
});

test("wiki-node field round-trip omits empty and stores unique ids", async () => {
  await withTempWorkspace(async (root) => {
    writeWikiCustomProps(root, {
      fields: [{ key: "tags", label: "Tags", type: "wiki-node" }],
    });
    const page = await createWikiNode(root, { title: "Article" });
    const tag = await createWikiNode(root, { title: "Azure" });
    assert.deepEqual(page.fields.tags, []);

    const linked = await updateWikiNode(root, page.id, {
      fields: { tags: [tag.id, tag.id] },
    });
    assert.deepEqual(linked.fields.tags, [tag.id]);
    const propsText = fs.readFileSync(
      path.join(root, "wiki", page.id, "props.ts"),
      "utf8",
    );
    assert.match(propsText, new RegExp(`"${tag.id}"`));
    assert.match(
      fs.readFileSync(path.join(root, "wiki", "schema.d.ts"), "utf8"),
      /tags\?: string\[\]/,
    );

    const cleared = await updateWikiNode(root, page.id, {
      fields: { tags: [] },
    });
    assert.deepEqual(cleared.fields.tags, []);
    const clearedText = fs.readFileSync(
      path.join(root, "wiki", page.id, "props.ts"),
      "utf8",
    );
    assert.doesNotMatch(clearedText, /"tags"/);

    await assert.rejects(
      () =>
        updateWikiNode(root, page.id, {
          fields: { tags: ["not-an-id"] },
        }),
      /not a valid id/,
    );
  });
});

test("string-list field round-trip omits empty and stores unique tokens", async () => {
  await withTempWorkspace(async (root) => {
    writeWikiCustomProps(root, {
      fields: [{ key: "keywords", label: "Keywords", type: "string-list" }],
    });
    const page = await createWikiNode(root, { title: "Article" });
    assert.deepEqual(page.fields.keywords, []);

    const tagged = await updateWikiNode(root, page.id, {
      fields: { keywords: ["  pm ", "pm", "kb"] },
    });
    assert.deepEqual(tagged.fields.keywords, ["pm", "kb"]);
    const propsText = fs.readFileSync(
      path.join(root, "wiki", page.id, "props.ts"),
      "utf8",
    );
    assert.match(propsText, /"keywords"/);
    assert.match(propsText, /"pm"/);
    assert.match(propsText, /"kb"/);

    const cleared = await updateWikiNode(root, page.id, {
      fields: { keywords: [] },
    });
    assert.deepEqual(cleared.fields.keywords, []);
    const clearedText = fs.readFileSync(
      path.join(root, "wiki", page.id, "props.ts"),
      "utf8",
    );
    assert.doesNotMatch(clearedText, /"keywords"/);

    await assert.rejects(
      () =>
        updateWikiNode(root, page.id, {
          fields: { keywords: [1] },
        }),
      /must be strings/,
    );
  });
});

test("listWikiIncomingRefs and doctor wiki-ref-missing", async () => {
  await withTempWorkspace(async (root) => {
    writeWikiCustomProps(root, {
      fields: [{ key: "tags", label: "Tags", type: "wiki-node" }],
    });
    const article = await createWikiNode(root, { title: "Article" });
    const tag = await createWikiNode(root, { title: "Azure" });
    await updateWikiNode(root, article.id, { fields: { tags: [tag.id] } });
    assert.deepEqual(await listWikiIncomingRefs(root, tag.id), [
      { fromId: article.id, fieldKey: "tags" },
    ]);
    assert.deepEqual(await listWikiIncomingRefs(root, article.id), []);

    const missing = "z".repeat(21);
    await updateWikiNode(root, article.id, {
      fields: { tags: [tag.id, missing] },
    });
    const report = await scanWorkspace(root);
    const hits = report.warnings.filter((w) => w.kind === "wiki-ref-missing");
    assert.equal(hits.length, 1);
    assert.match(hits[0]!.message, new RegExp(missing));
  });
});

test("updateWikiNode CAS is key-granular for wiki-node fields", async () => {
  await withTempWorkspace(async (root) => {
    writeWikiCustomProps(root, {
      fields: [{ key: "tags", label: "Tags", type: "wiki-node" }],
    });
    const page = await createWikiNode(root, { title: "CAS wiki-node" });
    const a = await createWikiNode(root, { title: "A" });
    const b = await createWikiNode(root, { title: "B" });
    const { pickWikiEditable, StaleWriteError } = await import(
      "../sync/detail-diff.js"
    );
    const expected = pickWikiEditable(page);
    await updateWikiNode(root, page.id, { fields: { tags: [a.id] } });
    await assert.rejects(
      () =>
        updateWikiNode(
          root,
          page.id,
          { fields: { tags: [b.id] } },
          { expected },
        ),
      (err: unknown) => err instanceof StaleWriteError,
    );
    const next = await updateWikiNode(
      root,
      page.id,
      { body: "body only\n" },
      { expected },
    );
    assert.equal(next.body, "body only\n");
    assert.deepEqual(next.fields.tags, [a.id]);
  });
});
