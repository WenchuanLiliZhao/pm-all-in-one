import os from "node:os";
import path from "node:path";
import * as pty from "node-pty";

export interface PtySession {
  id: string;
  process: pty.IPty;
}

type DataHandler = (sessionId: string, data: string) => void;
type ExitHandler = (sessionId: string, exitCode: number) => void;

export class PtyManager {
  private sessions = new Map<string, PtySession>();
  private seq = 0;
  private onData: DataHandler | null = null;
  private onExit: ExitHandler | null = null;
  private cwd: string = os.homedir();
  private workspaceRoot: string | null = null;
  private binDir: string | null = null;

  setHandlers(onData: DataHandler, onExit: ExitHandler): void {
    this.onData = onData;
    this.onExit = onExit;
  }

  setCwd(cwd: string): void {
    this.cwd = cwd;
  }

  setWorkspaceRoot(root: string | null): void {
    this.workspaceRoot = root;
  }

  setBinDir(binDir: string | null): void {
    this.binDir = binDir;
  }

  create(cols = 80, rows = 24): string {
    const id = `pty-${++this.seq}`;
    const shell =
      process.env.SHELL ||
      (process.platform === "win32" ? "powershell.exe" : "/bin/zsh");

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
    };
    if (this.binDir) {
      const pathKey = process.platform === "win32" ? "Path" : "PATH";
      const prev = env[pathKey] ?? env.PATH ?? "";
      env[pathKey] = `${this.binDir}${path.delimiter}${prev}`;
      env.PATH = env[pathKey];
    }
    if (this.workspaceRoot) {
      env.LOCAL_PM_WORKSPACE = this.workspaceRoot;
    }
    // Inherited Electron/npm PWD points at app; shells (zsh) trust $PWD
    // over the spawn cwd for prompt/`pwd` unless we align it.
    const spawnCwd = this.cwd;
    env.PWD = spawnCwd;

    const term = pty.spawn(shell, [], {
      name: "xterm-color",
      cols,
      rows,
      cwd: spawnCwd,
      env,
    });

    term.onData((data) => {
      this.onData?.(id, data);
    });

    term.onExit(({ exitCode }) => {
      this.sessions.delete(id);
      this.onExit?.(id, exitCode);
    });

    this.sessions.set(id, { id, process: term });
    return id;
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown terminal session: ${sessionId}`);
    }
    session.process.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.process.resize(cols, rows);
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    try {
      session.process.kill();
    } catch {
      // already dead
    }
    this.sessions.delete(sessionId);
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.kill(id);
    }
  }

  listIds(): string[] {
    return [...this.sessions.keys()];
  }
}
