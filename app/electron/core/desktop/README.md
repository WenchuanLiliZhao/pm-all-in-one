# `electron/core/desktop/`

<!-- ↔ AGENTS.md — Electron-only boundary -->
<!-- ↔ ../README.md — category map -->

Desktop / packaging concerns that must not enter the HTTP server or CLI publish graph.

**Who may import:** Electron main (and its tests) only.

| File | Role |
| --- | --- |
| `pty.ts` | `node-pty` session manager |
| `local-pm-shim.ts` | `userData/bin/pm-all-in-one` shim (`ELECTRON_RUN_AS_NODE`) |
| `cli-install.ts` | Symlink shim into PATH |
| `git-sync.ts` | Status / FF pull via git shell-out |
| `git-changes.ts` | Unsynced paths aggregated by node (local only; ignores props timestamp-only noise) |
| `git-config.ts` | Best-effort `user.name` / `user.email` |
| `esbuild-binary.ts` | `ESBUILD_BINARY_PATH` for asar.unpacked |
