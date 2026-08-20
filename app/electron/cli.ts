#!/usr/bin/env node
/**
 * pm-all-in-one CLI — pure Node (no electron imports).
 * Invoked via ELECTRON_RUN_AS_NODE shim or `node dist-electron/cli.js`.
 */
import fs from "node:fs";
import path from "node:path";

import { adoptStray, isFenceSoftWarning, scanWorkspace, type DoctorReport } from "./core/workspace/doctor.js";
import {
  handoffLinkSyntax,
  issueLinkSyntax,
  memberLinkSyntax,
  wikiLinkSyntax,
} from "./core/identity/links.js";
import {
  backfillMemberRefs,
  createMember,
  getMember,
  getMemberSnapshot,
  isMembership,
  setMemberAvatar,
  updateMember,
} from "./core/domain/members.js";
import {
  createHandoff,
  getHandoff,
  getHandoffSnapshot,
  updateHandoff,
} from "./core/domain/handoffs.js";
import {
  createIssue,
  createProject,
  deleteIssue,
  getIssue,
  isValidWorkspace,
  listIssues,
  listProjects,
  moveIssue,
} from "./core/domain/store.js";
import {
  createWikiNode,
  deleteWikiNode,
  flattenWikiContents,
  getWikiSnapshot,
  moveWikiNodeToSidebarPosition,
  type WikiSidebarNode,
} from "./core/domain/wiki.js";
import { rebuildIndex } from "./core/workspace/rebuild-index.js";
import {
  countDescendants,
  formatDescendantCost,
} from "./core/sync/delete-cost.js";
import type { Issue, Membership } from "./core/identity/types.js";
import { isValidEntityId } from "./core/identity/dir-id.js";
import { parseCliArgs } from "./cli-args.js";

function flagStr(flags: Record<string, string | boolean>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = flags[k];
    if (typeof v === "string") {
      return v;
    }
  }
  return undefined;
}

function flagId(flags: Record<string, string | boolean>, ...keys: string[]): string | undefined {
  const s = flagStr(flags, ...keys);
  if (s === undefined) {
    return undefined;
  }
  if (!/^[A-Za-z0-9_-]{21}$/.test(s)) {
    throw new Error(
      `Expected nanoid(21) entity id for --${keys[0]}, got: ${s}`,
    );
  }
  return s;
}

/** README body for handoff create/update. `--body` and `--body-file` cannot both be set. */
function resolveHandoffBody(
  flags: Record<string, string | boolean>,
): string | undefined {
  const body = flagStr(flags, "body");
  const bodyFile = flagStr(flags, "body-file", "bodyFile");
  if (body !== undefined && bodyFile !== undefined) {
    throw new Error("Use --body or --body-file, not both");
  }
  if (bodyFile !== undefined) {
    return fs.readFileSync(path.resolve(bodyFile), "utf8");
  }
  return body;
}

function parseParentId(raw: string | undefined): string | null {
  if (raw === undefined || raw === "root" || raw === "") {
    return null;
  }
  if (!/^[A-Za-z0-9_-]{21}$/.test(raw)) {
    throw new Error(`Invalid --parent: ${raw}`);
  }
  return raw;
}

function findWorkspaceRoot(start: string): string | null {
  let cur = path.resolve(start);
  for (;;) {
    if (isValidWorkspace(cur)) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) {
      return null;
    }
    cur = parent;
  }
}

function resolveWorkspace(flags: Record<string, string | boolean>): string {
  const fromEnv = process.env.LOCAL_PM_WORKSPACE?.trim();
  const fromFlag = flagStr(flags, "workspace", "w");
  const candidate = fromFlag || fromEnv || process.cwd();
  if (isValidWorkspace(candidate)) {
    return path.resolve(candidate);
  }
  const found = findWorkspaceRoot(candidate);
  if (!found) {
    throw new Error(
      `Not a workspace (need issue-hierarchy/ and .pm/): ${candidate}`,
    );
  }
  return found;
}

function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function usage(): string {
  return `pm-all-in-one — manage issue-hierarchy via the app allocator

Usage:
  pm-all-in-one issue create --project <id> [--parent <issueId>] --title <t>
  pm-all-in-one issue move   --project <id> --issue <id> --parent <id|root>
  pm-all-in-one issue delete --project <id> --issue <id> [--force]
  pm-all-in-one issue list   [--project <id>]
  pm-all-in-one project create --title <t>
  pm-all-in-one project list
  pm-all-in-one member create --title <t>
  pm-all-in-one member list
  pm-all-in-one member update <id> [--title <t>] [--membership involved|left]
  pm-all-in-one member avatar <id> --file <path>
  pm-all-in-one member backfill --created-by <id> [--assignee <id>]
  pm-all-in-one handoff create --from <memberId> --to <memberId> --related-project <projectId> [--title <t>] [--description <d>] [--body <md>] [--body-file <path>] [--closed]
  pm-all-in-one handoff list
  pm-all-in-one handoff update <id> [--title <t>] [--description <d>] [--body <md>] [--body-file <path>] [--from <id>] [--to <id>] [--related-project <id>] [--open|--closed]
  pm-all-in-one wiki create --title <t> [--parent <wikiNodeId|root>] [--description <d>]
  pm-all-in-one wiki move   --id <wikiNodeId> --parent <wikiNodeId|root> [--index <n>]
  pm-all-in-one wiki delete --id <wikiNodeId>
  pm-all-in-one wiki list
  pm-all-in-one doctor [--trust-fence-validators]
  pm-all-in-one adopt <path>

Options:
  --workspace <path>   Workspace root (default: LOCAL_PM_WORKSPACE or cwd upward)
  --json               Machine-readable output
  --force              Cascade-delete when the issue has children
  --trust-fence-validators
                       This run: import workspace fence-validator modules
                       (otherwise only when .pm/local.json sets trustFenceValidators)
  -h, --help           Show help
`;
}

function sidebarChildCount(
  nodes: WikiSidebarNode[],
  parentId: string | null,
): number {
  if (parentId === null) {
    return nodes.length;
  }
  const walk = (list: WikiSidebarNode[]): number | null => {
    for (const node of list) {
      if (node.type === "ref" && node.id === parentId) {
        return node.children?.length ?? 0;
      }
      if (node.type === "ref" && node.children) {
        const found = walk(node.children);
        if (found !== null) {
          return found;
        }
      }
      if (node.type === "group") {
        const found = walk(node.children);
        if (found !== null) {
          return found;
        }
      }
    }
    return null;
  };
  const n = walk(nodes);
  if (n === null) {
    throw new Error(`Contents parent not found: ${parentId}`);
  }
  return n;
}

function findWikiPlacement(
  nodes: WikiSidebarNode[],
  id: string,
  parentId: string | null = null,
): { parentId: string | null; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.type === "ref" && node.id === id) {
      return { parentId, index: i };
    }
    if (node.type === "ref" && node.children) {
      const found = findWikiPlacement(node.children, id, node.id);
      if (found) {
        return found;
      }
    }
    if (node.type === "group") {
      const found = findWikiPlacement(node.children, id, parentId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

async function cmdWikiCreate(
  root: string,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const title = flagStr(flags, "title", "t");
  if (!title) {
    throw new Error("--title is required");
  }
  const parentId = parseParentId(flagStr(flags, "parent"));
  const description = flagStr(flags, "description");
  const node = await createWikiNode(root, {
    title,
    parentId,
    ...(description !== undefined ? { description } : {}),
  });
  await rebuildIndex(root);
  const ref = wikiLinkSyntax(node.id);
  if (json) {
    printJson({ ...node, ref });
  } else {
    process.stdout.write(
      `Created ${ref}\n  path: ${node.relPath}\n  title: ${node.title}\n`,
    );
  }
}

async function cmdWikiMove(
  root: string,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const id = flagId(flags, "id");
  const parentRaw = flagStr(flags, "parent");
  if (id === undefined || parentRaw === undefined) {
    throw new Error("--id and --parent are required");
  }
  const parentId = parseParentId(parentRaw);
  const snapBefore = await getWikiSnapshot(root);
  const indexRaw = flagStr(flags, "index");
  let index: number;
  if (indexRaw === undefined) {
    index = sidebarChildCount(snapBefore.sidebar, parentId);
  } else {
    const parsed = Number(indexRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("--index must be a non-negative number");
    }
    index = Math.floor(parsed);
  }
  const snap = await moveWikiNodeToSidebarPosition(root, id, {
    parentId,
    index,
  });
  await rebuildIndex(root);
  const placement = findWikiPlacement(snap.sidebar, id);
  const ref = wikiLinkSyntax(id);
  const parentOut = placement?.parentId ?? parentId;
  const indexOut = placement?.index ?? index;
  if (json) {
    printJson({
      id,
      ref,
      parentId: parentOut,
      index: indexOut,
      sidebar: snap.sidebar,
    });
  } else {
    process.stdout.write(
      `Moved ${ref}\n  parent: ${parentOut ?? "root"}\n  index: ${indexOut}\n`,
    );
  }
}

async function cmdWikiList(root: string, json: boolean): Promise<void> {
  const snap = await getWikiSnapshot(root);
  const rows = flattenWikiContents(snap.sidebar, snap.nodes);
  if (json) {
    printJson(rows);
  } else {
    for (const row of rows) {
      const indent = "  ".repeat(row.depth);
      process.stdout.write(`${indent}${row.ref}\t${row.title}\n`);
    }
  }
}

function countDirectWikiChildren(
  nodes: WikiSidebarNode[],
  id: string,
): number {
  const walk = (list: WikiSidebarNode[]): number | null => {
    for (const node of list) {
      if (node.type === "ref" && node.id === id) {
        return (node.children ?? []).filter((c) => c.type === "ref").length;
      }
      if (node.type === "ref" && node.children) {
        const found = walk(node.children);
        if (found !== null) {
          return found;
        }
      }
      if (node.type === "group") {
        const found = walk(node.children);
        if (found !== null) {
          return found;
        }
      }
    }
    return null;
  };
  return walk(nodes) ?? 0;
}

async function cmdWikiDelete(
  root: string,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const id = flagId(flags, "id");
  if (id === undefined) {
    throw new Error("--id is required");
  }
  const snap = await getWikiSnapshot(root);
  if (!snap.nodes.some((n) => n.id === id)) {
    throw new Error(`Wiki-node not found: ${id}`);
  }
  const lifted = countDirectWikiChildren(snap.sidebar, id);
  const ok = await deleteWikiNode(root, id, { removeFile: true });
  if (!ok) {
    throw new Error(`Failed to delete wiki-node: ${id}`);
  }
  await rebuildIndex(root);
  const ref = wikiLinkSyntax(id);
  if (json) {
    printJson({ ok: true, id, ref, liftedChildren: lifted });
  } else if (lifted > 0) {
    process.stdout.write(
      `Deleted ${ref}\n  Contents children promoted: ${lifted}\n`,
    );
  } else {
    process.stdout.write(`Deleted ${ref}\n`);
  }
}

async function cmdIssueCreate(
  root: string,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const projectId = flagId(flags, "project", "p");
  if (projectId === undefined) {
    throw new Error("--project is required");
  }
  const title = flagStr(flags, "title", "t");
  if (!title) {
    throw new Error("--title is required");
  }
  const parentIssueId = parseParentId(flagStr(flags, "parent"));
  const issue = await createIssue(root, {
    projectId,
    parentIssueId,
    title,
  });
  const ref = issueLinkSyntax(issue.projectId, issue.id);
  if (json) {
    printJson({ ...issue, ref });
  } else {
    process.stdout.write(
      `Created ${ref}\n  path: ${issue.relPath}\n  title: ${issue.title}\n`,
    );
  }
}

async function cmdIssueMove(
  root: string,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const projectId = flagId(flags, "project", "p");
  const issueId = flagId(flags, "issue", "i");
  const parentRaw = flagStr(flags, "parent");
  if (projectId === undefined || issueId === undefined || parentRaw === undefined) {
    throw new Error("--project, --issue, and --parent are required");
  }
  const newParentIssueId = parseParentId(parentRaw);
  const issue = await moveIssue(root, {
    projectId,
    issueId,
    newParentIssueId,
  });
  const ref = issueLinkSyntax(issue.projectId, issue.id);
  if (json) {
    printJson({ ...issue, ref });
  } else {
    process.stdout.write(`Moved ${ref}\n  path: ${issue.relPath}\n`);
  }
}

async function cmdIssueDelete(
  root: string,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const projectId = flagId(flags, "project", "p");
  const issueId = flagId(flags, "issue", "i");
  if (projectId === undefined || issueId === undefined) {
    throw new Error("--project and --issue are required");
  }
  const force = flags.force === true;
  await getIssue(root, projectId, issueId);
  const counts = countDescendants(await listIssues(root), projectId, issueId);
  if (counts.total > 0 && !force) {
    const cost = formatDescendantCost(counts);
    throw new Error(
      `Cannot delete ${issueLinkSyntax(projectId, issueId)}: has children (${cost}). Re-run with --force to cascade-delete.`,
    );
  }
  await deleteIssue(root, projectId, issueId, { cascade: force });
  if (json) {
    printJson({
      ok: true,
      projectId,
      issueId,
      cascade: force,
      removedDescendants: counts.total,
    });
  } else {
    const cost = formatDescendantCost(counts);
    process.stdout.write(
      cost
        ? `Deleted ${issueLinkSyntax(projectId, issueId)} and ${cost}\n`
        : `Deleted ${issueLinkSyntax(projectId, issueId)}\n`,
    );
  }
}

async function cmdIssueList(
  root: string,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const projectId = flagId(flags, "project", "p");
  let issues = await listIssues(root);
  if (projectId !== undefined) {
    issues = issues.filter((i) => i.projectId === projectId);
  }
  if (json) {
    printJson(issues);
  } else {
    for (const i of issues) {
      process.stdout.write(
        `${issueLinkSyntax(i.projectId, i.id)}\t${i.level}\t${i.title}\t${i.relPath}\n`,
      );
    }
  }
}

async function cmdProjectCreate(
  root: string,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const title = flagStr(flags, "title", "t") ?? "New Project";
  const project = await createProject(root, { title });
  if (json) {
    printJson(project);
  } else {
    process.stdout.write(
      `Created project ${project.id}\n  path: ${project.relPath}\n  title: ${project.title}\n`,
    );
  }
}

async function cmdProjectList(
  root: string,
  json: boolean,
): Promise<void> {
  const projects = await listProjects(root);
  if (json) {
    printJson(projects);
  } else {
    for (const p of projects) {
      process.stdout.write(`${p.id}\t${p.title}\t${p.relPath}\n`);
    }
  }
}

async function cmdMemberCreate(
  root: string,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const title = flagStr(flags, "title", "t");
  if (!title) {
    throw new Error("--title is required");
  }
  const member = await createMember(root, { title });
  const ref = memberLinkSyntax(member.id);
  if (json) {
    printJson({ ...member, ref });
  } else {
    process.stdout.write(
      `Created ${ref}\n  path: ${member.relPath}\n  title: ${member.title}\n`,
    );
  }
}

async function cmdMemberList(root: string, json: boolean): Promise<void> {
  const snap = await getMemberSnapshot(root);
  if (json) {
    printJson(snap);
  } else {
    for (const m of snap.nodes) {
      process.stdout.write(
        `${memberLinkSyntax(m.id)}\t${m.membership}\t${m.title}\t${m.relPath}\n`,
      );
    }
  }
}

async function cmdMemberUpdate(
  root: string,
  idArg: string | undefined,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const id = idArg ?? flagStr(flags, "id");
  if (!id || !isValidEntityId(id)) {
    throw new Error("member update requires a valid member id");
  }
  const title = flagStr(flags, "title", "t");
  const membershipRaw = flagStr(flags, "membership");
  let membership: Membership | undefined;
  if (membershipRaw !== undefined) {
    if (!isMembership(membershipRaw)) {
      throw new Error("--membership must be involved|left");
    }
    membership = membershipRaw;
  }
  if (title === undefined && membership === undefined) {
    throw new Error("Provide --title and/or --membership");
  }
  const member = await updateMember(root, id, {
    ...(title !== undefined ? { title } : {}),
    ...(membership !== undefined ? { membership } : {}),
  });
  if (json) {
    printJson(member);
  } else {
    process.stdout.write(
      `Updated ${memberLinkSyntax(member.id)}\n  membership: ${member.membership}\n  title: ${member.title}\n`,
    );
  }
}

async function cmdMemberAvatar(
  root: string,
  idArg: string | undefined,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const id = idArg ?? flagStr(flags, "id");
  const file = flagStr(flags, "file", "f");
  if (!id || !isValidEntityId(id)) {
    throw new Error("member avatar requires a valid member id");
  }
  if (!file) {
    throw new Error("--file is required");
  }
  await getMember(root, id);
  const dest = setMemberAvatar(root, id, path.resolve(file));
  const member = await getMember(root, id);
  if (json) {
    printJson({ ...member, avatarWritten: dest });
  } else {
    process.stdout.write(
      `Avatar set for ${memberLinkSyntax(id)}\n  path: ${path.relative(root, dest)}\n`,
    );
  }
}

async function cmdMemberBackfill(
  root: string,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const createdBy = flagId(flags, "created-by") ?? flagId(flags, "createdBy");
  if (createdBy === undefined) {
    throw new Error("--created-by is required");
  }
  const assigneeRaw = flagId(flags, "assignee");
  const result = await backfillMemberRefs(root, {
    createdBy,
    ...(assigneeRaw !== undefined ? { assignee: assigneeRaw } : {}),
  });
  if (json) {
    printJson(result);
  } else {
    process.stdout.write(
      `Backfilled createdBy=${createdBy}${assigneeRaw ? ` assignee=${assigneeRaw}` : ""}\n` +
        `  projects: ${result.projects}\n  issues: ${result.issues}\n  wiki-nodes: ${result.wikiNodes}\n` +
        `  (updated timestamps preserved)\n`,
    );
  }
}

async function cmdHandoffCreate(
  root: string,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const from = flagId(flags, "from");
  const to = flagId(flags, "to");
  const relatedProject =
    flagId(flags, "related-project") ?? flagId(flags, "relatedProject");
  if (from === undefined) {
    throw new Error("--from is required");
  }
  if (to === undefined) {
    throw new Error("--to is required");
  }
  if (relatedProject === undefined) {
    throw new Error("--related-project is required");
  }
  const title = flagStr(flags, "title", "t");
  const description = flagStr(flags, "description");
  const body = resolveHandoffBody(flags);
  const open = flags.closed === true ? false : true;
  const handoff = await createHandoff(root, {
    from,
    to,
    relatedProject,
    open,
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(body !== undefined ? { body } : {}),
  });
  const ref = handoffLinkSyntax(handoff.id);
  if (json) {
    printJson({ ...handoff, ref });
  } else {
    process.stdout.write(
      `Created ${ref}\n  path: ${handoff.relPath}\n  title: ${handoff.title}\n  relatedProject: ${relatedProject}\n  open: ${handoff.open}\n  from: ${from}\n  to: ${to}\n`,
    );
  }
}

async function cmdHandoffList(root: string, json: boolean): Promise<void> {
  const snap = await getHandoffSnapshot(root);
  if (json) {
    printJson(snap);
  } else {
    for (const h of snap.nodes) {
      process.stdout.write(
        `${handoffLinkSyntax(h.id)}\t${h.open ? "open" : "closed"}\t${h.relatedProject}\t${h.created}\t${h.from}→${h.to}\t${h.title}\t${h.relPath}\n`,
      );
    }
  }
}

async function cmdHandoffUpdate(
  root: string,
  idArg: string | undefined,
  flags: Record<string, string | boolean>,
  json: boolean,
): Promise<void> {
  const id = idArg ?? flagStr(flags, "id");
  if (!id || !isValidEntityId(id)) {
    throw new Error("handoff update requires a valid handoff id");
  }
  const title = flagStr(flags, "title", "t");
  const description = flagStr(flags, "description");
  const body = resolveHandoffBody(flags);
  const from = flagId(flags, "from");
  const to = flagId(flags, "to");
  const relatedProject =
    flagId(flags, "related-project") ?? flagId(flags, "relatedProject");
  let open: boolean | undefined;
  if (flags.open === true) {
    open = true;
  } else if (flags.closed === true) {
    open = false;
  }
  if (
    title === undefined &&
    description === undefined &&
    body === undefined &&
    from === undefined &&
    to === undefined &&
    relatedProject === undefined &&
    open === undefined
  ) {
    throw new Error(
      "Provide --title / --description / --body / --body-file / --from / --to / --related-project / --open / --closed",
    );
  }
  await getHandoff(root, id);
  const handoff = await updateHandoff(root, id, {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(body !== undefined ? { body } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
    ...(relatedProject !== undefined ? { relatedProject } : {}),
    ...(open !== undefined ? { open } : {}),
  });
  if (json) {
    printJson(handoff);
  } else {
    process.stdout.write(
      `Updated ${handoffLinkSyntax(handoff.id)}\n  title: ${handoff.title}\n  relatedProject: ${handoff.relatedProject}\n  open: ${handoff.open}\n  from: ${handoff.from}\n  to: ${handoff.to}\n`,
    );
  }
}

function formatDoctor(report: DoctorReport, offenders: Issue[]): string {
  const lines: string[] = [];
  if (
    report.strays.length === 0 &&
    report.warnings.length === 0 &&
    offenders.length === 0
  ) {
    return "OK — no strays, warnings, or ladder violations.\n";
  }
  if (offenders.length > 0) {
    lines.push(`Ladder violations (${offenders.length}):`);
    for (const issue of offenders) {
      const ref = issueLinkSyntax(issue.projectId, issue.id);
      for (const v of issue.violations) {
        lines.push(`  [${v.kind}] ${ref} ${issue.relPath} — ${v.message}`);
      }
    }
  }
  if (report.strays.length > 0) {
    lines.push(`Strays (${report.strays.length}):`);
    for (const s of report.strays) {
      lines.push(
        `  [${s.kind}] ${s.relPath}${s.adoptable ? " (adoptable)" : ""} — ${s.message}`,
      );
    }
  }
  if (report.warnings.length > 0) {
    lines.push(`Warnings (${report.warnings.length}):`);
    for (const w of report.warnings) {
      const loc =
        w.relPath && w.line != null
          ? `${w.relPath}:${w.line}`
          : w.relPath
            ? w.relPath
            : "";
      lines.push(
        loc
          ? `  [${w.kind}] ${loc} — ${w.message}`
          : `  [${w.kind}] ${w.message}`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

async function cmdDoctor(
  root: string,
  json: boolean,
  trustFenceValidators?: boolean,
): Promise<void> {
  const report = await scanWorkspace(
    root,
    trustFenceValidators ? { trustFenceValidators: true } : undefined,
  );
  const offenders = (await listIssues(root)).filter(
    (i) => i.violations.length > 0,
  );
  if (json) {
    printJson({
      ...report,
      ladder: offenders.map((i) => ({
        ref: issueLinkSyntax(i.projectId, i.id),
        relPath: i.relPath,
        violations: i.violations,
      })),
    });
  } else {
    process.stdout.write(formatDoctor(report, offenders));
  }
  const hardWarnings = report.warnings.filter((w) => !isFenceSoftWarning(w.kind));
  if (report.strays.some((s) => s.adoptable)) {
    process.exitCode = 2;
  } else if (
    report.strays.length > 0 ||
    hardWarnings.length > 0 ||
    offenders.length > 0
  ) {
    process.exitCode = 1;
  }
}

async function cmdAdopt(
  root: string,
  strayPath: string,
  json: boolean,
): Promise<void> {
  const abs = path.isAbsolute(strayPath)
    ? strayPath
    : path.resolve(process.cwd(), strayPath);
  const result = adoptStray(root, abs);
  if (json) {
    printJson(result);
  } else {
    process.stdout.write(
      `Adopted ${result.ref}\n  path: ${result.relPath}\n`,
    );
  }
}

async function main(): Promise<void> {
  const { _, flags } = parseCliArgs(process.argv.slice(2));
  if (flags.help === true || flags.h === true || _.length === 0) {
    process.stdout.write(usage());
    return;
  }
  const json = flags.json === true;
  const [cmd, sub, ...rest] = _;

  if (cmd === "doctor") {
    const root = resolveWorkspace(flags);
    await cmdDoctor(
      root,
      json,
      flags["trust-fence-validators"] === true,
    );
    return;
  }
  if (cmd === "adopt") {
    const target = sub ?? flagStr(flags, "path");
    if (!target) {
      throw new Error("adopt requires a path");
    }
    const root = resolveWorkspace(flags);
    await cmdAdopt(root, target, json);
    return;
  }
  if (cmd === "issue") {
    const root = resolveWorkspace(flags);
    if (sub === "create") {
      await cmdIssueCreate(root, flags, json);
      return;
    }
    if (sub === "move") {
      await cmdIssueMove(root, flags, json);
      return;
    }
    if (sub === "delete") {
      await cmdIssueDelete(root, flags, json);
      return;
    }
    if (sub === "list") {
      await cmdIssueList(root, flags, json);
      return;
    }
    throw new Error(`Unknown issue subcommand: ${sub ?? "(none)"}\n${usage()}`);
  }
  if (cmd === "project") {
    const root = resolveWorkspace(flags);
    if (sub === "create") {
      await cmdProjectCreate(root, flags, json);
      return;
    }
    if (sub === "list") {
      await cmdProjectList(root, json);
      return;
    }
    throw new Error(`Unknown project subcommand: ${sub ?? "(none)"}\n${usage()}`);
  }
  if (cmd === "member") {
    const root = resolveWorkspace(flags);
    if (sub === "create") {
      await cmdMemberCreate(root, flags, json);
      return;
    }
    if (sub === "list") {
      await cmdMemberList(root, json);
      return;
    }
    if (sub === "update") {
      await cmdMemberUpdate(root, rest[0], flags, json);
      return;
    }
    if (sub === "avatar") {
      await cmdMemberAvatar(root, rest[0], flags, json);
      return;
    }
    if (sub === "backfill") {
      await cmdMemberBackfill(root, flags, json);
      return;
    }
    throw new Error(`Unknown member subcommand: ${sub ?? "(none)"}\n${usage()}`);
  }
  if (cmd === "handoff") {
    const root = resolveWorkspace(flags);
    if (sub === "create") {
      await cmdHandoffCreate(root, flags, json);
      return;
    }
    if (sub === "list") {
      await cmdHandoffList(root, json);
      return;
    }
    if (sub === "update") {
      await cmdHandoffUpdate(root, rest[0], flags, json);
      return;
    }
    throw new Error(`Unknown handoff subcommand: ${sub ?? "(none)"}\n${usage()}`);
  }
  if (cmd === "wiki") {
    const root = resolveWorkspace(flags);
    if (sub === "create") {
      await cmdWikiCreate(root, flags, json);
      return;
    }
    if (sub === "move") {
      await cmdWikiMove(root, flags, json);
      return;
    }
    if (sub === "delete") {
      await cmdWikiDelete(root, flags, json);
      return;
    }
    if (sub === "list") {
      await cmdWikiList(root, json);
      return;
    }
    throw new Error(`Unknown wiki subcommand: ${sub ?? "(none)"}\n${usage()}`);
  }

  void rest;
  throw new Error(`Unknown command: ${cmd}\n${usage()}`);
}

main().catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
