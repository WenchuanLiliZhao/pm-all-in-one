import http from "node:http";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { adoptStray, scanStrays } from "../electron/core/doctor.js";
import {
  createWikiNode,
  deleteWikiNode,
  ensureWiki,
  getWikiNode,
  getWikiSnapshot,
  moveWikiNodeInSidebar,
  moveWikiNodeToSidebarPosition,
  setWikiSidebar,
  updateWikiNode,
  type CreateWikiNodeInput,
  type WikiNodePatch,
  type WikiSidebarMove,
  type WikiSidebarNode,
  type WikiSidebarPlacement,
} from "../electron/core/wiki.js";
import {
  createMember,
  ensureMembers,
  getMember,
  getMemberAvatarDataUrl,
  getMemberSnapshot,
  setMemberAvatar,
  updateMember,
} from "../electron/core/members.js";
import {
  createHandoff,
  ensureHandoffs,
  getHandoff,
  getHandoffSnapshot,
  updateHandoff,
} from "../electron/core/handoffs.js";
import { readLocalConfig, writeLocalConfig } from "../electron/core/local-config.js";
import { ensureLocalJsonGitignore } from "../electron/core/workspace-gitignore.js";
import { rebuildIndex } from "../electron/core/index.js";
import {
  setLastWorkspaceRoot,
} from "../electron/core/settings.js";
import {
  assertSupportedLayout,
  createIssue,
  createProject,
  deleteIssue,
  deleteProject,
  getCustomPropsForProject,
  getIssue,
  isValidWorkspace,
  listIssues,
  listProjects,
  moveIssue,
  updateCustomPropsForProject,
  updateIssue,
  updateProject,
} from "../electron/core/store.js";
import type {
  CreateHandoffInput,
  CreateMemberInput,
  CustomPropsSchema,
  HandoffPatch,
  IssueCreateInput,
  IssuePatch,
  MemberPatch,
  MoveIssueInput,
  ProjectCreateInput,
  ProjectPatch,
  WorkspacePatch,
} from "../electron/core/types.js";
import {
  ensureWorkspaceMeta,
  updateWorkspaceMeta,
} from "../electron/core/workspace-meta.js";
import {
  createView,
  deleteView,
  ensureViews,
  listViews,
  updateView,
  type CreateViewInput,
  type UpdateViewInput,
} from "../electron/core/views.js";
import {
  ensureViewOrders,
  getAllViewOrders,
  getViewOrder,
  pruneKeyFromOtherViews,
  setViewOrder,
  type ViewOrder,
} from "../electron/core/view-orders.js";
import {
  WorkspaceWatcher,
  type WorkspaceChangePayload,
} from "../electron/core/watch.js";
import { parseStaleWrite } from "../electron/core/detail-diff.js";

const PORT = Number(process.env.LOCAL_PM_API_PORT ?? 8787);
const workspaceRoot = resolveWorkspaceRoot();

const watcher = new WorkspaceWatcher();
const sseClients = new Set<ServerResponse>();

/** npm scripts run with cwd = app (package root). */
function resolveWorkspaceRoot(): string {
  const raw = process.env.LOCAL_PM_WORKSPACE ?? "/Users/wenchuanzhao/Documents/GitHub/new-world";
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function cors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return undefined;
  }
  return JSON.parse(raw) as unknown;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  cors(res);
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

// ↔ electron/core/detail-diff.ts — parseStaleWrite / encodeStaleWriteMessage SoT
// ↔ electron/main.ts — IPC rethrows encodeStaleWriteMessage; we emit 409 JSON
// ↔ src/lib/bridge/http-pm.ts — request() reconstructs StaleWriteError from body
function sendError(res: ServerResponse, status: number, error: unknown): void {
  const stale = parseStaleWrite(error);
  if (stale) {
    sendJson(res, 409, {
      error: stale.message,
      code: "stale-write",
      conflictPaths: stale.conflictPaths,
    });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  sendJson(res, status, { error: message });
}

function splitExpected<T extends object>(
  body: unknown,
): { patch: T; expected: unknown | undefined } {
  if (!body || typeof body !== "object") {
    return { patch: {} as T, expected: undefined };
  }
  const { expected, ...rest } = body as T & { expected?: unknown };
  return { patch: rest as T, expected };
}

function broadcast(event: string, data: unknown): void {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(chunk);
  }
}

async function openSnapshot(root: string) {
  if (!isValidWorkspace(root)) {
    throw new Error(
      `Not a workspace (need issue-hierarchy/ and .pm/): ${root}`,
    );
  }
  assertSupportedLayout(root);
  setLastWorkspaceRoot(root);
  ensureViews(root);
  ensureViewOrders(root);
  ensureLocalJsonGitignore(root);
  await ensureWiki(root);
  await ensureMembers(root);
  await ensureHandoffs(root);
  const meta = await ensureWorkspaceMeta(root);
  const tree = await rebuildIndex(root);
  const projects = await listProjects(root);
  const issues = await listIssues(root);
  const strays = scanStrays(root);

  watcher.start(root, (payload: WorkspaceChangePayload) => {
    broadcast("changed", payload);
  });

  return { root, meta, projects, tree, issues, strays };
}

function match(
  pathname: string,
  pattern: string,
): Record<string, string> | null {
  const pathParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) {
    return null;
  }
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    const vp = pathParts[i]!;
    if (pp.startsWith(":")) {
      params[pp.slice(1)] = decodeURIComponent(vp);
    } else if (pp !== vp) {
      return null;
    }
  }
  return params;
}

// ↔ electron/main.ts registerIpc — desktop twin; both call electron/core
// ↔ src/lib/bridge/http-pm.ts — client for these /api routes + SSE /api/events
// ↔ src/lib/bridge/pm-api.ts — method surface this server must cover (or stub)
// ↔ electron/core/index.ts — rebuildIndex after mutations / watch
async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  url: URL,
): Promise<void> {
  const method = req.method ?? "GET";
  const root = workspaceRoot;

  if (method === "GET" && pathname === "/api/workspace") {
    sendJson(res, 200, await openSnapshot(root));
    return;
  }

  if (method === "PATCH" && pathname === "/api/workspace") {
    const { patch, expected } = splitExpected<WorkspacePatch>(await readJson(req));
    sendJson(
      res,
      200,
      await updateWorkspaceMeta(root, patch, {
        expected: expected as never,
      }),
    );
    return;
  }

  if (method === "GET" && pathname === "/api/events") {
    cors(res);
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
    });
    return;
  }

  if (method === "GET" && pathname === "/api/tree") {
    sendJson(res, 200, await rebuildIndex(root));
    return;
  }
  if (method === "GET" && pathname === "/api/projects") {
    sendJson(res, 200, await listProjects(root));
    return;
  }
  if (method === "GET" && pathname === "/api/issues") {
    sendJson(res, 200, await listIssues(root));
    return;
  }

  {
    const params = match(pathname, "/api/issues/:projectId/:issueId");
    if (params && method === "GET") {
      sendJson(
        res,
        200,
        await getIssue(root, params.projectId, params.issueId),
      );
      return;
    }
    if (params && method === "PATCH") {
      const { patch, expected } = splitExpected<IssuePatch>(await readJson(req));
      sendJson(
        res,
        200,
        await updateIssue(root, params.projectId, params.issueId, patch, {
          expected: expected as never,
        }),
      );
      return;
    }
    if (params && method === "DELETE") {
      const cascade = url.searchParams.get("cascade") === "true";
      await deleteIssue(root, params.projectId, params.issueId, {
        cascade,
      });
      sendJson(res, 200, true);
      return;
    }
  }

  if (method === "POST" && pathname === "/api/projects") {
    const input = ((await readJson(req)) ?? {}) as ProjectCreateInput;
    const me = readLocalConfig(root).me;
    sendJson(res, 200, await createProject(root, input, { actorMemberId: me }));
    return;
  }

  {
    const params = match(pathname, "/api/projects/:projectId");
    if (params && method === "PATCH") {
      const { patch, expected } = splitExpected<ProjectPatch>(
        await readJson(req),
      );
      sendJson(
        res,
        200,
        await updateProject(root, params.projectId, patch, {
          expected: expected as never,
        }),
      );
      return;
    }
    if (params && method === "DELETE") {
      const cascade = url.searchParams.get("cascade") !== "false";
      await deleteProject(root, params.projectId, { cascade });
      sendJson(res, 200, true);
      return;
    }
  }

  if (method === "POST" && pathname === "/api/issues") {
    const input = (await readJson(req)) as IssueCreateInput;
    const me = readLocalConfig(root).me;
    sendJson(res, 200, await createIssue(root, input, { actorMemberId: me }));
    return;
  }

  if (method === "POST" && pathname === "/api/issues/move") {
    const input = (await readJson(req)) as MoveIssueInput;
    sendJson(res, 200, await moveIssue(root, input));
    return;
  }

  {
    const params = match(pathname, "/api/projects/:projectId/custom-props");
    if (params && method === "GET") {
      sendJson(
        res,
        200,
        await getCustomPropsForProject(root, params.projectId),
      );
      return;
    }
    if (params && method === "PUT") {
      const schema = (await readJson(req)) as CustomPropsSchema;
      sendJson(
        res,
        200,
        await updateCustomPropsForProject(
          root,
          params.projectId,
          schema,
        ),
      );
      return;
    }
  }

  if (method === "GET" && pathname === "/api/views") {
    sendJson(res, 200, listViews(root));
    return;
  }
  if (method === "POST" && pathname === "/api/views") {
    const input = ((await readJson(req)) ?? {}) as CreateViewInput;
    sendJson(res, 200, createView(root, input));
    return;
  }
  {
    const params = match(pathname, "/api/views/:viewId");
    if (params && method === "PATCH") {
      const patch = (await readJson(req)) as UpdateViewInput;
      sendJson(res, 200, updateView(root, params.viewId!, patch));
      return;
    }
    if (params && method === "DELETE") {
      sendJson(res, 200, deleteView(root, params.viewId!));
      return;
    }
  }

  if (method === "GET" && pathname === "/api/view-orders") {
    sendJson(res, 200, getAllViewOrders(root));
    return;
  }
  if (method === "POST" && pathname === "/api/view-orders/prune") {
    const body = (await readJson(req)) as {
      movedKey?: string;
      activeViewKey?: string;
    };
    if (!body?.movedKey || !body?.activeViewKey) {
      throw new Error("movedKey and activeViewKey required");
    }
    pruneKeyFromOtherViews(root, body.movedKey, body.activeViewKey);
    sendJson(res, 200, { ok: true });
    return;
  }
  {
    const params = match(pathname, "/api/view-orders/:viewKey");
    if (params && method === "GET") {
      sendJson(res, 200, getViewOrder(root, decodeURIComponent(params.viewKey!)));
      return;
    }
    if (params && method === "PUT") {
      const order = (await readJson(req)) as ViewOrder;
      sendJson(
        res,
        200,
        setViewOrder(root, decodeURIComponent(params.viewKey!), order),
      );
      return;
    }
  }

  if (method === "GET" && pathname === "/api/doctor") {
    sendJson(res, 200, scanStrays(root));
    return;
  }
  if (method === "POST" && pathname === "/api/doctor/adopt") {
    const body = (await readJson(req)) as { strayPath?: string };
    if (!body?.strayPath) {
      throw new Error("strayPath required");
    }
    const result = adoptStray(root, body.strayPath);
    sendJson(res, 200, result);
    return;
  }

  if (method === "GET" && pathname === "/api/wiki") {
    sendJson(res, 200, await getWikiSnapshot(root));
    return;
  }
  if (method === "POST" && pathname === "/api/wiki") {
    const input = ((await readJson(req)) ?? {}) as CreateWikiNodeInput;
    const me = readLocalConfig(root).me;
    sendJson(
      res,
      200,
      await createWikiNode(root, {
        ...input,
        actorMemberId:
          input.actorMemberId !== undefined ? input.actorMemberId : me,
      }),
    );
    return;
  }
  if (method === "PUT" && pathname === "/api/wiki/sidebar") {
    const body = (await readJson(req)) as { nodes?: WikiSidebarNode[] };
    sendJson(res, 200, await setWikiSidebar(root, body?.nodes ?? []));
    return;
  }
  if (method === "POST" && pathname === "/api/wiki/sidebar/move") {
    const body = (await readJson(req)) as {
      id?: string;
      move?: WikiSidebarMove;
    };
    if (!body?.id || !body?.move) {
      throw new Error("id and move required");
    }
    sendJson(res, 200, await moveWikiNodeInSidebar(root, body.id, body.move));
    return;
  }
  if (method === "POST" && pathname === "/api/wiki/sidebar/move-to") {
    const body = (await readJson(req)) as {
      id?: string;
      placement?: WikiSidebarPlacement;
    };
    if (!body?.id || !body?.placement) {
      throw new Error("id and placement required");
    }
    sendJson(
      res,
      200,
      await moveWikiNodeToSidebarPosition(root, body.id, body.placement),
    );
    return;
  }
  {
    const params = match(pathname, "/api/wiki/:id");
    if (params && method === "GET") {
      sendJson(res, 200, await getWikiNode(root, params.id!));
      return;
    }
    if (params && method === "PATCH") {
      const { patch, expected } = splitExpected<WikiNodePatch>(
        await readJson(req),
      );
      sendJson(
        res,
        200,
        await updateWikiNode(root, params.id!, patch, {
          expected: expected as never,
        }),
      );
      return;
    }
    if (params && method === "DELETE") {
      const removeFile = url.searchParams.get("removeFile") !== "false";
      sendJson(
        res,
        200,
        await deleteWikiNode(root, params.id!, { removeFile }),
      );
      return;
    }
  }

  if (method === "GET" && pathname === "/api/members") {
    sendJson(res, 200, await getMemberSnapshot(root));
    return;
  }
  if (method === "POST" && pathname === "/api/members") {
    const input = ((await readJson(req)) ?? {}) as CreateMemberInput;
    sendJson(res, 200, await createMember(root, input));
    return;
  }
  {
    const params = match(pathname, "/api/members/:id/avatar-data");
    if (params && method === "GET") {
      sendJson(res, 200, {
        dataUrl: getMemberAvatarDataUrl(root, params.id!),
      });
      return;
    }
  }
  {
    const params = match(pathname, "/api/members/:id/avatar");
    if (params && method === "POST") {
      const body = ((await readJson(req)) ?? {}) as { sourcePath?: string };
      if (!body.sourcePath || typeof body.sourcePath !== "string") {
        throw new Error("sourcePath required");
      }
      setMemberAvatar(root, params.id!, body.sourcePath);
      sendJson(res, 200, await getMember(root, params.id!));
      return;
    }
  }
  {
    const params = match(pathname, "/api/members/:id");
    if (params && method === "GET") {
      sendJson(res, 200, await getMember(root, params.id!));
      return;
    }
    if (params && method === "PATCH") {
      const { patch, expected } = splitExpected<MemberPatch>(
        await readJson(req),
      );
      sendJson(
        res,
        200,
        await updateMember(root, params.id!, patch, {
          expected: expected as never,
        }),
      );
      return;
    }
  }

  if (method === "GET" && pathname === "/api/handoffs") {
    sendJson(res, 200, await getHandoffSnapshot(root));
    return;
  }
  if (method === "POST" && pathname === "/api/handoffs") {
    const input = (await readJson(req)) as CreateHandoffInput;
    sendJson(res, 200, await createHandoff(root, input));
    return;
  }
  {
    const params = match(pathname, "/api/handoffs/:id");
    if (params && method === "GET") {
      sendJson(res, 200, await getHandoff(root, params.id!));
      return;
    }
    if (params && method === "PATCH") {
      const { patch, expected } = splitExpected<HandoffPatch>(
        await readJson(req),
      );
      sendJson(
        res,
        200,
        await updateHandoff(root, params.id!, patch, {
          expected: expected as never,
        }),
      );
      return;
    }
  }

  if (method === "GET" && pathname === "/api/local-config") {
    const { me } = readLocalConfig(root);
    sendJson(res, 200, { me });
    return;
  }
  if (method === "PUT" && pathname === "/api/local-config/me") {
    const body = ((await readJson(req)) ?? {}) as { me?: string | null };
    if (!("me" in body)) {
      throw new Error("me required (string | null)");
    }
    if (body.me !== null && typeof body.me !== "string") {
      throw new Error("me must be string | null");
    }
    const next = writeLocalConfig(root, { me: body.me });
    sendJson(res, 200, { me: next.me });
    return;
  }

  sendJson(res, 404, { error: `No route ${method} ${pathname}` });
}

async function main(): Promise<void> {
  if (!isValidWorkspace(workspaceRoot)) {
    console.error(
      `[local-pm-server] Invalid workspace at ${workspaceRoot} (set LOCAL_PM_WORKSPACE)`,
    );
    process.exit(1);
  }

  // Warm open so watcher is running before first client
  await openSnapshot(workspaceRoot);
  console.log(`[local-pm-server] workspace: ${workspaceRoot}`);

  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
        if (req.method === "OPTIONS") {
          cors(res);
          res.writeHead(204);
          res.end();
          return;
        }
        // Browser habit: open the printed API URL. This is JSON API only —
        // the React UI is Vite on :5173 (proxies /api here).
        if (url.pathname === "/" || url.pathname === "") {
          const ui = "http://127.0.0.1:5173/";
          const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>local-pm API</title>
<style>
  body{font:14px/1.45 system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;color:#1a1a1a}
  code{background:#f3f3f3;padding:.1em .35em;border-radius:3px}
  a{color:#0b57d0}
</style></head><body>
<h1>local-pm API</h1>
<p>This port (<code>${PORT}</code>) is the HTTP API, not the app UI.</p>
<p>Open the Vite UI: <a href="${ui}">${ui}</a></p>
<p>Example: <a href="/api/workspace"><code>GET /api/workspace</code></a></p>
</body></html>`;
          cors(res);
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
          return;
        }
        if (!url.pathname.startsWith("/api/")) {
          sendJson(res, 404, { error: "Not found" });
          return;
        }
        await handleApi(req, res, url.pathname, url);
      } catch (e) {
        sendError(res, 500, e);
      }
    })();
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[local-pm-server] API http://127.0.0.1:${PORT}  (UI → http://127.0.0.1:5173/)`);
  });

  const shutdown = () => {
    watcher.stop();
    for (const client of sseClients) {
      client.end();
    }
    sseClients.clear();
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
