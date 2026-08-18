/**
 * Workspace-declared Markdown fence validators for doctor.
 *
 * The CLI knows no fence language. A workspace names a lang and a module;
 * doctor collects findings. Modules load only when explicitly trusted —
 * never by default, never via eval / codegen of fence bodies.
 *
 * ↔ doctor.ts — scanWorkspace appends these warnings
 * ↔ local-config.ts — trustFenceValidators opt-in
 * ↔ agent.md — declaration + opt-in + warn vs fail
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

import {
  handoffsRoot,
  hierarchyRoot,
  membersRoot,
  wikiRoot,
  workspacePmDir,
} from "../identity/ids.js";
import { readLocalConfig } from "./local-config.js";

export type FenceDoctorWarningKind =
  | "fence-invalid"
  | "fence-validators-untrusted"
  | "fence-validator-load-failed"
  | "fence-validators-unreadable";

/** Authored-content kinds: printed, but they do not fail doctor. */
export const FENCE_SOFT_WARNING_KINDS: ReadonlySet<string> = new Set<FenceDoctorWarningKind>(
  ["fence-invalid", "fence-validators-untrusted"],
);

export function isFenceSoftWarning(kind: string): boolean {
  return FENCE_SOFT_WARNING_KINDS.has(kind);
}

export interface FenceDoctorWarning {
  kind: FenceDoctorWarningKind;
  message: string;
  path?: string;
  relPath?: string;
  /** 1-based line in the Markdown file. */
  line?: number;
}

export interface FencedBlock {
  /** Full info string after the opening fence (trimmed). */
  info: string;
  /** First token of `info`, lowercased — the declared `lang` key. */
  lang: string;
  body: string;
  /** 1-based line of the opening fence. */
  openLine: number;
  /** 1-based line of the first body line (`openLine + 1`). */
  bodyStartLine: number;
}

export interface FenceValidatorInput {
  lang: string;
  info: string;
  body: string;
}

export interface FenceFinding {
  message: string;
  /** 1-based line within the fence body (first body line = 1). */
  line?: number;
}

export type FenceValidateFn = (
  input: FenceValidatorInput,
) => FenceFinding[] | Promise<FenceFinding[]>;

const EntryZod = z.object({
  lang: z.string().min(1),
  module: z.string().min(1),
});

const FileZod = z.object({
  validators: z.array(EntryZod),
});

export type FenceValidatorEntry = z.infer<typeof EntryZod>;

export function fenceValidatorsPath(workspaceRoot: string): string {
  return path.join(workspacePmDir(workspaceRoot), "fence-validators.json");
}

/** CommonMark-ish fenced blocks. Unclosed fences are skipped. */
export function findFencedBlocks(source: string): FencedBlock[] {
  const lines = source.split(/\n/);
  const blocks: FencedBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = /^( {0,3})(`{3,}|~{3,})([^`\n]*)$/.exec(lines[i]!);
    if (!open) {
      i += 1;
      continue;
    }
    const fence = open[2]!;
    const marker = fence[0]!;
    const minLen = fence.length;
    const info = open[3]!.trim();
    let closed = false;
    for (let j = i + 1; j < lines.length; j++) {
      const close = /^( {0,3})(`{3,}|~{3,})[ \t]*$/.exec(lines[j]!);
      if (
        close &&
        close[2]![0] === marker &&
        close[2]!.length >= minLen
      ) {
        const bodyLines = lines.slice(i + 1, j);
        const lang = (info.split(/\s+/)[0] ?? "").toLowerCase();
        blocks.push({
          info,
          lang,
          body: bodyLines.join("\n"),
          openLine: i + 1,
          bodyStartLine: i + 2,
        });
        i = j + 1;
        closed = true;
        break;
      }
    }
    if (!closed) {
      i += 1;
    }
  }
  return blocks;
}

function fileLine(block: FencedBlock, findingLine?: number): number {
  if (findingLine == null || findingLine < 1) {
    return block.openLine;
  }
  return block.bodyStartLine + findingLine - 1;
}

function isInsideWorkspace(workspaceRoot: string, abs: string): boolean {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(abs);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return target === root || target.startsWith(prefix);
}

function skipName(name: string): boolean {
  // `assets` matches NODE_ASSETS_DIRNAME — keep in sync.
  return (
    name === ".pm" ||
    name === "assets" ||
    name === "node_modules" ||
    name.startsWith(".")
  );
}

function collectMarkdownFiles(dir: string, into: string[]): void {
  if (!fs.existsSync(dir)) {
    return;
  }
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (skipName(name)) {
      continue;
    }
    const abs = path.join(dir, name);
    let st: fs.Stats;
    try {
      st = fs.statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      collectMarkdownFiles(abs, into);
    } else if (st.isFile() && name.endsWith(".md")) {
      into.push(abs);
    }
  }
}

/** Home, issue/project bodies, markdown custom props, wiki / member / handoff READMEs. */
export function listMarkdownBodies(workspaceRoot: string): string[] {
  const files: string[] = [];
  const home = path.join(workspaceRoot, "README.md");
  if (fs.existsSync(home) && fs.statSync(home).isFile()) {
    files.push(home);
  }
  collectMarkdownFiles(hierarchyRoot(workspaceRoot), files);
  collectMarkdownFiles(wikiRoot(workspaceRoot), files);
  collectMarkdownFiles(membersRoot(workspaceRoot), files);
  collectMarkdownFiles(handoffsRoot(workspaceRoot), files);
  return files;
}

function loadDeclaration(
  workspaceRoot: string,
):
  | { ok: true; entries: FenceValidatorEntry[] }
  | { ok: false; warning: FenceDoctorWarning } {
  const file = fenceValidatorsPath(workspaceRoot);
  if (!fs.existsSync(file)) {
    return { ok: true, entries: [] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      warning: {
        kind: "fence-validators-unreadable",
        message: `.pm/fence-validators.json is not valid JSON: ${message}`,
        path: file,
        relPath: path.relative(workspaceRoot, file),
      },
    };
  }
  const parsed = FileZod.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      warning: {
        kind: "fence-validators-unreadable",
        message: `.pm/fence-validators.json must be { "validators": [{ "lang", "module" }, …] }`,
        path: file,
        relPath: path.relative(workspaceRoot, file),
      },
    };
  }
  return { ok: true, entries: parsed.data.validators };
}

async function loadValidateFn(
  abs: string,
): Promise<FenceValidateFn> {
  const st = fs.statSync(abs);
  const href = `${pathToFileURL(abs).href}?mtime=${st.mtimeMs}`;
  const mod = (await import(href)) as { validate?: unknown };
  if (typeof mod.validate !== "function") {
    throw new Error("validator module must export function validate");
  }
  return mod.validate as FenceValidateFn;
}

/**
 * Scan declared fence langs. No declaration → no work.
 * Modules are imported only when `trustFenceValidators` is true (option or
 * `.pm/local.json`).
 */
export async function scanFenceValidators(
  workspaceRoot: string,
  options?: { trustFenceValidators?: boolean },
): Promise<FenceDoctorWarning[]> {
  const declared = loadDeclaration(workspaceRoot);
  if (!declared.ok) {
    return [declared.warning];
  }
  if (declared.entries.length === 0) {
    return [];
  }

  const trusted =
    options?.trustFenceValidators ??
    readLocalConfig(workspaceRoot).trustFenceValidators === true;

  if (!trusted) {
    const langs = [...new Set(declared.entries.map((e) => e.lang))].join(", ");
    return [
      {
        kind: "fence-validators-untrusted",
        message: `Fence validators declared (${langs}) but not enabled. Set trustFenceValidators in .pm/local.json or pass --trust-fence-validators. Doctor will not import workspace modules otherwise.`,
        path: fenceValidatorsPath(workspaceRoot),
        relPath: path.relative(workspaceRoot, fenceValidatorsPath(workspaceRoot)),
      },
    ];
  }

  const warnings: FenceDoctorWarning[] = [];
  const loaded: { lang: string; validate: FenceValidateFn }[] = [];

  for (const entry of declared.entries) {
    const abs = path.resolve(workspaceRoot, entry.module);
    if (!isInsideWorkspace(workspaceRoot, abs)) {
      warnings.push({
        kind: "fence-validator-load-failed",
        message: `Validator for lang ${JSON.stringify(entry.lang)} resolves outside the workspace: ${entry.module}`,
        path: fenceValidatorsPath(workspaceRoot),
        relPath: path.relative(workspaceRoot, fenceValidatorsPath(workspaceRoot)),
      });
      continue;
    }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      warnings.push({
        kind: "fence-validator-load-failed",
        message: `Validator for lang ${JSON.stringify(entry.lang)} not found: ${entry.module}`,
        path: abs,
        relPath: path.relative(workspaceRoot, abs),
      });
      continue;
    }
    try {
      const validate = await loadValidateFn(abs);
      loaded.push({ lang: entry.lang.trim().toLowerCase(), validate });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      warnings.push({
        kind: "fence-validator-load-failed",
        message: `Failed to load validator for lang ${JSON.stringify(entry.lang)} (${entry.module}): ${message}`,
        path: abs,
        relPath: path.relative(workspaceRoot, abs),
      });
    }
  }

  if (loaded.length === 0) {
    return warnings;
  }

  const byLang = new Map<string, FenceValidateFn[]>();
  for (const item of loaded) {
    const list = byLang.get(item.lang) ?? [];
    list.push(item.validate);
    byLang.set(item.lang, list);
  }

  for (const file of listMarkdownBodies(workspaceRoot)) {
    let source: string;
    try {
      source = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const relPath = path.relative(workspaceRoot, file);
    for (const block of findFencedBlocks(source)) {
      if (!block.lang) {
        continue;
      }
      const fns = byLang.get(block.lang);
      if (!fns) {
        continue;
      }
      for (const validate of fns) {
        let findings: FenceFinding[];
        try {
          findings = await Promise.resolve(
            validate({ lang: block.lang, info: block.info, body: block.body }),
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          warnings.push({
            kind: "fence-validator-load-failed",
            message: `Validator for lang ${JSON.stringify(block.lang)} threw: ${message}`,
            path: file,
            relPath,
            line: block.openLine,
          });
          continue;
        }
        if (!Array.isArray(findings)) {
          warnings.push({
            kind: "fence-validator-load-failed",
            message: `Validator for lang ${JSON.stringify(block.lang)} must return an array of findings`,
            path: file,
            relPath,
            line: block.openLine,
          });
          continue;
        }
        for (const finding of findings) {
          if (!finding || typeof finding.message !== "string") {
            continue;
          }
          warnings.push({
            kind: "fence-invalid",
            message: finding.message,
            path: file,
            relPath,
            line: fileLine(block, finding.line),
          });
        }
      }
    }
  }

  return warnings;
}
