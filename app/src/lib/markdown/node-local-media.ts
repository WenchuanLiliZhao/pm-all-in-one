// ↔ src/components/markdown-editor/local-media.ts — isNodeAssetRelUrl / assetBasename
// ↔ src/lib/bridge/pm-api.ts — getNodeAssetsDir / openPath
// ↔ node-assets-section — Insert uses markdownForAssetInsert

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assetBasename,
  isNodeAssetRelUrl,
  markdownCiteForAssetBasename,
} from "@/components/markdown-editor";
import { getPm, isWebPm } from "@/lib/bridge";
import type { NodeRef } from "@/lib/bridge/pm-api";

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

function joinDirFile(dir: string, file: string): string {
  const trimmed = dir.replace(/[/\\]+$/, "");
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return `${trimmed}${sep}${file}`;
}

/** Absolute filesystem path → privileged media URL for <img> in the renderer. */
export function absolutePathToMediaUrl(absPath: string): string {
  return `pm-asset://local/?p=${encodeURIComponent(absPath)}`;
}

/** Encode a basename for use inside Markdown `(assets/…)`. */
export function encodeAssetBasenameForUrl(name: string): string {
  return encodeURIComponent(name.trim());
}

export function markdownForAssetInsert(filename: string): string {
  return markdownCiteForAssetBasename(filename);
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

/** Copy pasted/dropped File list into this node's assets/; return written names. */
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
  return written;
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
        if (!isNodeAssetRelUrl(src) || !assetsDir) return src;
        return absolutePathToMediaUrl(
          joinDirFile(assetsDir, assetBasename(src)),
        );
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
