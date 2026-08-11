/**
 * ASCII folder segment from a display title (GitHub-style normalize).
 * ↔ electron/core/identity/slugify-folder.ts — hand-copy twin (keep bodies identical)
 */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function slugifyWorkspaceFolder(title: string): string {
  let s = title
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  if (s.length > 100) {
    s = s.slice(0, 100).replace(/[.-]+$/g, "");
  }

  if (!s || s === "." || s === ".." || WINDOWS_RESERVED.test(s)) {
    return "workspace";
  }
  return s;
}
