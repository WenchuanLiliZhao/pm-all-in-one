import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Root, Nodes } from "hast";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import {
  PREVIEW_REMARK_PLUGINS,
  createPreviewRehypePlugins,
  createPreviewSanitizeSchema,
} from "./preview-rehype.ts";

type Collected = {
  tags: string[];
  texts: string[];
  comments: string[];
  hrefs: string[];
  srcs: string[];
  classNames: string[];
};

function collect(node: Nodes, acc: Collected): Collected {
  if (node.type === "text") acc.texts.push(node.value);
  if (node.type === "comment") acc.comments.push(node.value);
  if (node.type === "element") {
    acc.tags.push(node.tagName);
    const href = node.properties?.href;
    if (typeof href === "string") acc.hrefs.push(href);
    const src = node.properties?.src;
    if (typeof src === "string") acc.srcs.push(src);
    const className = node.properties?.className;
    if (Array.isArray(className)) {
      acc.classNames.push(...className.map(String));
    } else if (typeof className === "string") {
      acc.classNames.push(className);
    }
    for (const child of node.children) collect(child, acc);
  }
  if (node.type === "root") {
    for (const child of node.children) collect(child, acc);
  }
  return acc;
}

function toHast(markdown: string, schemes: string[] = []): Root {
  const processor = unified()
    .use(remarkParse)
    .use(PREVIEW_REMARK_PLUGINS)
    .use(remarkRehype, { allowDangerousHtml: true });
  for (const item of createPreviewRehypePlugins({
    allowedUrlSchemes: schemes,
    highlightPlainText: ["mermaid"],
  })) {
    if (Array.isArray(item)) {
      processor.use(item[0], item[1]);
    } else {
      processor.use(item);
    }
  }
  return processor.runSync(processor.parse(markdown)) as Root;
}

describe("createPreviewSanitizeSchema", () => {
  it("adds plugin href schemes without dropping https", () => {
    const schema = createPreviewSanitizeSchema(["Wiki:", "issue"]);
    assert.ok(schema.protocols?.href?.includes("https"));
    assert.ok(schema.protocols?.href?.includes("wiki"));
    assert.ok(schema.protocols?.href?.includes("issue"));
  });
});

describe("preview rehype HTML", () => {
  it("turns raw <a> into an element, not source text", () => {
    const acc = collect(
      toHast('see <a href="https://example.com">anchor</a> here'),
      { tags: [], texts: [], comments: [], hrefs: [],
      srcs: [], classNames: [] },
    );
    assert.ok(acc.tags.includes("a"));
    assert.deepEqual(acc.hrefs, ["https://example.com"]);
    assert.ok(acc.texts.includes("anchor"));
    assert.doesNotMatch(acc.texts.join(""), /<a /);
  });

  it("drops HTML comments so they are not visible", () => {
    const acc = collect(
      toHast("hello <!-- secret-comment --> world"),
      { tags: [], texts: [], comments: [], hrefs: [],
      srcs: [], classNames: [] },
    );
    assert.deepEqual(acc.comments, []);
    assert.doesNotMatch(acc.texts.join(""), /secret-comment/);
    assert.match(acc.texts.join(""), /hello/);
    assert.match(acc.texts.join(""), /world/);
  });

  it("strips script tags", () => {
    const acc = collect(toHast('<script>alert(1)</script>keep'), {
      tags: [],
      texts: [],
      comments: [],
      hrefs: [],
      srcs: [],
      classNames: [],
    });
    assert.equal(acc.tags.includes("script"), false);
    assert.doesNotMatch(acc.texts.join(""), /alert/);
    assert.match(acc.texts.join(""), /keep/);
  });

  it("keeps plugin href schemes", () => {
    const acc = collect(toHast("[chip](wiki:abc)", ["wiki"]), {
      tags: [],
      texts: [],
      comments: [],
      hrefs: [],
      srcs: [],
      classNames: [],
    });
    assert.deepEqual(acc.hrefs, ["wiki:abc"]);
  });

  it("still renders inline math after sanitize", () => {
    const acc = collect(toHast("the area is $x^2$."), {
      tags: [],
      texts: [],
      comments: [],
      hrefs: [],
      srcs: [],
      classNames: [],
    });
    assert.ok(acc.classNames.some((c) => c.includes("katex")));
    assert.doesNotMatch(acc.texts.join(""), /\$x\^2\$/);
  });

  it("keeps relative assets/ image src and zip href", () => {
    const acc = collect(
      toHast(
        "![cover](assets/grow-skill.png)\n\n[Download](assets/grow-skill.zip)",
      ),
      {
        tags: [],
        texts: [],
        comments: [],
        hrefs: [],
        srcs: [],
        classNames: [],
      },
    );
    assert.deepEqual(acc.srcs, ["assets/grow-skill.png"]);
    assert.deepEqual(acc.hrefs, ["assets/grow-skill.zip"]);
  });
});
