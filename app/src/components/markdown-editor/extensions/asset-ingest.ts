// ↔ ../local-media.ts — markdownCiteForAssetBasename
// ↔ ../markdown-cm-view.tsx — mounts when ingestFiles provided
// ↔ src/lib/markdown/node-local-media.ts — product ingestFiles

import { Facet, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdownCiteForAssetBasename } from "../local-media";

/** Product: copy dropped/pasted files into node assets/; return written basenames. */
export type AssetIngestFn = (files: File[]) => Promise<string[]>;

export const assetIngestFacet = Facet.define<
  AssetIngestFn | null,
  AssetIngestFn | null
>({
  combine: (values) => values[values.length - 1] ?? null,
});

function collectFiles(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const fromList = Array.from(dt.files ?? []);
  if (fromList.length > 0) return fromList;
  const out: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file") continue;
    const f = item.getAsFile();
    if (f) out.push(f);
  }
  return out;
}

function insertCites(view: EditorView, basenames: string[]) {
  if (basenames.length === 0) return;
  const text = basenames.map(markdownCiteForAssetBasename).join("\n\n");
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
    scrollIntoView: true,
  });
}

async function ingestAndInsert(
  view: EditorView,
  ingest: AssetIngestFn,
  files: File[],
) {
  try {
    const written = await ingest(files);
    insertCites(view, written);
  } catch (e) {
    console.error("asset ingest failed", e);
  }
}

/** Paste / drop files → ingest → insert Markdown cites at caret. */
export function createAssetIngestExtensions(): Extension[] {
  return [
    EditorView.domEventHandlers({
      paste(event, view) {
        const ingest = view.state.facet(assetIngestFacet);
        if (!ingest) return false;
        const files = collectFiles(event.clipboardData);
        if (files.length === 0) return false;
        event.preventDefault();
        void ingestAndInsert(view, ingest, files);
        return true;
      },
      dragover(event) {
        if (!event.dataTransfer?.types?.includes("Files")) return false;
        if (!viewHasIngest(event)) return false;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        return true;
      },
      drop(event, view) {
        const ingest = view.state.facet(assetIngestFacet);
        if (!ingest) return false;
        const files = collectFiles(event.dataTransfer);
        if (files.length === 0) return false;
        event.preventDefault();
        // Drop may land away from caret — move caret to drop pos when possible.
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos != null) {
          view.dispatch({ selection: { anchor: pos } });
        }
        void ingestAndInsert(view, ingest, files);
        return true;
      },
    }),
  ];
}

function viewHasIngest(event: DragEvent): boolean {
  const t = event.currentTarget;
  // Facet is on EditorView state; dragover runs on content DOM — always allow
  // preventDefault when Files are present; drop handler checks facet.
  void t;
  return true;
}
