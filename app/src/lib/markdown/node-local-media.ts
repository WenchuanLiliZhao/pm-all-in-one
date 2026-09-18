// ↔ src/components/markdown-editor/local-media.ts — assetRelPath / markdownCiteForAssetBasename
// ↔ src/lib/bridge/pm-api.ts — getNodeAssetsDir / openPath
// ↔ ./asset-mention-completions.ts — @assets/<relpath> folder mentions
// ↔ node-assets-section — Insert uses markdownForAssetInsert

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assetRelPath,
  encodeAssetRelPath,
  markdownCiteForAssetBasename,
  type MentionAutocompleteProps,
} from "@/components/markdown-editor";
import { getPm, isWebPm } from "@/lib/bridge";
import type { NodeRef } from "@/lib/bridge/pm-api";
import {
  parseAssetFolderMentionToken,
  toAssetFolderMentionCandidates,
} from "./asset-mention-completions";

function nodeRefKey(ref: NodeRef): string {
  switch (ref.kind) {
    case "workspace":
      return "workspace";
    case "project":
      return `project:${ref.projectId}`;
    case "issue":
      return `issue:${ref.projectId}::${ref.issueId}`;
    case "wiki":
      return `wiki:${ref.wikiNodeId}`;
    case "member":
      return `member:${ref.memberId}`;
    case "handoff":
      return `handoff:${ref.handoffId}`;
  }
}

function joinDirFile(dir: string, relPath: string): string {
  const trimmed = dir.replace(/[/\\]+$/, "");
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  const rel =
    sep === "\\" ? relPath.replace(/\//g, "\\") : relPath.replace(/\\/g, "/");
  return `${trimmed}${sep}${rel}`;
}

function posixRelativeToWorkspace(root: string, absPath: string): string | null {
  const nRoot = root.replace(/\\/g, "/").replace(/\/+$/, "");
  const nAbs = absPath.replace(/\\/g, "/");
  if (nAbs === nRoot) {
    return "";
  }
  const prefix = `${nRoot}/`;
  if (!nAbs.startsWith(prefix)) {
    return null;
  }
  return nAbs.slice(prefix.length);
}

/** Absolute filesystem path → privileged media URL for <img> in the renderer. */
export function absolutePathToMediaUrl(absPath: string): string {
  const base = window.__pmAssetBase;
  const root = window.__pmWorkspaceRoot;
  if (base && root) {
    const rel = posixRelativeToWorkspace(root, absPath);
    if (rel !== null) {
      const suffix = rel
        .split("/")
        .filter((part) => part.length > 0)
        .map((part) => encodeURIComponent(part))
        .join("/");
      return suffix ? `${base.replace(/\/+$/, "")}/${suffix}` : base;
    }
  }
  return `pm-asset://local/?p=${encodeURIComponent(absPath)}`;
}

/** Encode a posix relative path for use inside Markdown `(assets/…)`. */
export function encodeAssetBasenameForUrl(name: string): string {
  return encodeAssetRelPath(name);
}

export function markdownForAssetInsert(filename: string): string {
  return markdownCiteForAssetBasename(filename);
}

/** Merge this node's asset folders into `@` mention autocomplete. */
export function withAssetFolderMentions(
  base: MentionAutocompleteProps,
  assetRelPaths: string[],
  assetsDir: string | null,
): MentionAutocompleteProps {
  const extra = toAssetFolderMentionCandidates(assetRelPaths);
  return {
    ...base,
    candidates:
      extra.length === 0 ? base.candidates : [...base.candidates, ...extra],
    onActivate: (token) => {
      const rel = parseAssetFolderMentionToken(token);
      if (rel && assetsDir) {
        const abs = joinDirFile(assetsDir, rel);
        void getPm().revealPath(abs);
        return;
      }
      base.onActivate?.(token);
    },
  };
}

export function useAssetFolderMentions(
  base: MentionAutocompleteProps,
  assetRelPaths: string[],
  assetsDir: string | null,
): MentionAutocompleteProps {
  return useMemo(
    () => withAssetFolderMentions(base, assetRelPaths, assetsDir),
    [base, assetRelPaths, assetsDir],
  );
}

type ElectronFile = File & { path?: string };

function guessPasteName(file: File, index: number): string {
  const raw = (file.name || "").trim();
  if (raw && raw !== "image.png" && raw !== "blob") {
    return raw;
  }
  const mime = file.type || "";
  const ext =
    mime === "image/jpeg"
      ? "jpg"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : mime.startsWith("image/")
            ? "png"
            : "bin";
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "-")
    .slice(0, 19);
  return `pasted-${stamp}${index > 0 ? `-${index + 1}` : ""}.${ext}`;
}

/** Copy pasted/dropped files or folders into this node's assets/; return cite paths. */
export async function ingestFilesIntoNodeAssets(
  nodeRef: NodeRef,
  files: File[],
): Promise<string[]> {
  if (isWebPm() || files.length === 0) {
    return [];
  }
  const pathFiles: string[] = [];
  const buffers: { name: string; data: Uint8Array }[] = [];
  let i = 0;
  for (const file of files) {
    const electronPath = (file as ElectronFile).path;
    if (electronPath && electronPath.length > 0) {
      pathFiles.push(electronPath);
    } else {
      const data = new Uint8Array(await file.arrayBuffer());
      buffers.push({ name: guessPasteName(file, i), data });
    }
    i += 1;
  }
  const written: string[] = [];
  if (pathFiles.length > 0) {
    written.push(...(await getPm().importNodeAssetPaths(nodeRef, pathFiles)));
  }
  if (buffers.length > 0) {
    written.push(...(await getPm().writeNodeAssetBuffers(nodeRef, buffers)));
  }
  // Folder copies nest under `assets/<folder>/…`. Do not flood the body with
  // one cite per nested file — only top-level files get Markdown cites.
  return written.filter((rel) => !rel.includes("/"));
}

/** Product localMedia + asset filename list for the current node. */
export function useNodeLocalMedia(nodeRef: NodeRef) {
  const [assetsDir, setAssetsDir] = useState<string | null>(null);
  const [filenames, setFilenames] = useState<string[]>([]);
  const key = nodeRefKey(nodeRef);

  const refresh = useCallback(async () => {
    if (isWebPm()) {
      setAssetsDir(null);
      setFilenames([]);
      return;
    }
    try {
      const [dir, names] = await Promise.all([
        getPm().getNodeAssetsDir(nodeRef),
        getPm().listNodeAssets(nodeRef),
      ]);
      setAssetsDir(dir);
      setFilenames(names);
    } catch {
      setAssetsDir(null);
      setFilenames([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key tracks selection
  }, [key]);

  useEffect(() => {
    void refresh();
    if (isWebPm()) return;
    const unsub = getPm().onChanged(() => {
      void refresh();
    });
    return unsub;
  }, [refresh]);

  const localMedia = useMemo(
    () => ({
      resolveMediaUrl: (src: string) => {
        const rel = assetRelPath(src);
        if (!rel || !assetsDir) return src;
        return absolutePathToMediaUrl(joinDirFile(assetsDir, rel));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key + dir
    [assetsDir, key],
  );

  const ingestAssetFiles = useCallback(
    (files: File[]) => ingestFilesIntoNodeAssets(nodeRef, files),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key tracks selection
    [key],
  );

  return {
    localMedia,
    filenames,
    assetsDir,
    refresh,
    ingestAssetFiles,
  };
}
