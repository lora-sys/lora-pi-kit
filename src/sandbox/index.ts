import { spawn, execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import {
  assertBoundedJson, isRecord, validId, SANDBOX_MAX_MESSAGE_BYTES,
  SANDBOX_TOOL_NAMES, type NativeToolResult, type PiToolName,
  type SandboxRequest, type SandboxResponse, type SandboxToolDefinition,
} from "./protocol.js";
import {
  SANDBOX_IMAGE_LABEL, SANDBOX_LAUNCH_LABEL, SANDBOX_OWNER_LABEL,
  SANDBOX_SESSION_LABEL, sandboxContainerIdentity, stopOwnedContainer,
} from "./container-stop.js";
export type { NativeToolResult, PiToolName, SandboxToolDefinition } from "./protocol.js";

const execFileAsync = promisify(execFile);
const IMAGE_DIGEST = /^(?:[a-z0-9][a-z0-9._/-]*@)?sha256:[a-f0-9]{64}$/;
const MAX_LIFETIME_MS = 60 * 60 * 1000;
const READY_TIMEOUT_MS = 15_000;
function validNativeResult(value: unknown): value is NativeToolResult {
  return isRecord(value) && Array.isArray(value.content) &&
    value.content.every((block: unknown) => isRecord(block) && (
      (block.type === "text" && typeof block.text === "string") ||
      (block.type === "image" && typeof block.data === "string" && typeof block.mimeType === "string")
    )) && (value.isError === undefined || typeof value.isError === "boolean");
}

export interface DockerSandboxConfig {
  image: string;
  dockerBinary?: string;
  maxSessions?: number;
  runAsUid?: number;
  runAsGid?: number;
}
export interface OpenSandboxSessionOptions {
  sessionId: string;
  workspacePath: string;
  writable: boolean;
  policyVersion: string;
  network?: "none";
  maxLifetimeMs?: number;
}
export interface ExecuteSandboxToolOptions {
  id: string;
  name: PiToolName;
  params: unknown;
  signal?: AbortSignal;
  onUpdate?: (result: NativeToolResult) => void;
}
export interface ExecuteSandboxCliOptions {
  id: string;
  executable: "agent-browser";
  args: string[];
  signal?: AbortSignal;
  onUpdate?: (result: NativeToolResult) => void;
}
export interface SandboxSession {
  readonly sessionId: string;
  readonly toolDefinitions: readonly SandboxToolDefinition[];
  execute(options: ExecuteSandboxToolOptions): Promise<NativeToolResult>;
  executeCli(options: ExecuteSandboxCliOptions): Promise<NativeToolResult>;
  cancel(id: string): Promise<void>;
  close(): Promise<void>;
}
export interface SandboxExecutor {
  doctor(): Promise<{ ready: true; provider: "docker"; image: string; availableTools: readonly PiToolName[]; cliAvailable: boolean }>;
  openSession(options: OpenSandboxSessionOptions): Promise<SandboxSession>;
  ensureSessionStopped(sessionId: string): Promise<void>;
  close(): Promise<void>;
}

function validatedConfig(config: DockerSandboxConfig): Required<DockerSandboxConfig> {
  if (!IMAGE_DIGEST.test(config.image)) throw new Error("Sandbox image must be pinned to sha256 digest");
  if (config.dockerBinary && (!/^([A-Za-z]:\\[^\r\n]+|\/[^\r\n]+)$/.test(config.dockerBinary))) throw new Error("Docker binary must be an absolute path");
  const maxSessions = config.maxSessions ?? 4;
  if (!Number.isInteger(maxSessions) || maxSessions < 1 || maxSessions > 32) throw new Error("Invalid session limit");
  const runAsUid = config.runAsUid ?? (process.getuid?.() || 10001);
  const runAsGid = config.runAsGid ?? (process.getgid?.() || 10001);
  if (![runAsUid, runAsGid].every((n) => Number.isInteger(n) && n > 0)) throw new Error("Sandbox user must be nonroot");
  return { ...config, dockerBinary: config.dockerBinary ?? "docker", maxSessions, runAsUid, runAsGid };
}

export function createDockerSandboxExecutor(input: DockerSandboxConfig): SandboxExecutor {
  const config = validatedConfig(input);
  const sessions = new Set<SandboxSession>();
  const opening = new Set<string>();
  let closed = false;
  const runDocker = (args: string[]) => execFileAsync(config.dockerBinary, args, { timeout: 15_000, windowsHide: true });
  async function ensureSessionStopped(sessionId: string): Promise<void> {
    if (closed) throw new Error("Sandbox executor closed");
    const identity = sandboxContainerIdentity(sessionId);
    await stopOwnedContainer({ name: identity.name, sessionHash: identity.hash }, runDocker);
  }
  async function doctor(): Promise<{ ready: true; provider: "docker"; image: string; availableTools: readonly PiToolName[]; cliAvailable: boolean }> {
    if (closed) throw new Error("Sandbox executor closed");
    await execFileAsync(config.dockerBinary, ["info", "--format", "{{.ServerVersion}}"], { timeout: 15_000, windowsHide: true });
    const { stdout } = await execFileAsync(config.dockerBinary, ["image", "inspect", config.image, "--format", "{{.Id}}"], { timeout: 15_000, windowsHide: true });
    if (!/^sha256:[a-f0-9]{64}\s*$/.test(stdout)) throw new Error("Pinned sandbox image unavailable");
    const script = "for name in node bash rg fd pwsh agent-browser; do if command -v \"$name\" >/dev/null 2>&1; then echo \"$name=1\"; else echo \"$name=0\"; fi; done";
    const probe = await execFileAsync(config.dockerBinary, ["run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", `${config.runAsUid}:${config.runAsGid}`, "--entrypoint", "/bin/sh", config.image, "-c", script], { timeout: 30_000, windowsHide: true });
    const flags = new Map(probe.stdout.trim().split(/\r?\n/).map((line) => line.split("=") as [string, string]));
    for (const binary of ["node", "bash", "rg", "fd"]) if (flags.get(binary) !== "1") throw new Error(`Sandbox image lacks ${binary}`);
    const probeRoot = await mkdtemp(join(tmpdir(), "lora-doctor-"));
    try {
      const probeWorkspace = join(probeRoot, "workspace");
      await (await import("node:fs/promises")).mkdir(probeWorkspace);
      await writeFile(join(probeWorkspace, "inside"), "ok");
      await writeFile(join(probeRoot, "outside"), "private");
      await chmod(probeWorkspace, 0o777);
      await chmod(join(probeWorkspace, "inside"), 0o644);
      const networkCheck = "const n=require('node:net').connect(443,'1.1.1.1');n.on('connect',()=>process.exit(2));n.on('error',()=>process.exit(0));setTimeout(()=>process.exit(3),1500)";
      const script = `test "$(cat /workspace/inside)" = ok && test ! -e /workspace/../outside && touch /workspace/wrote && node -e "${networkCheck}"`;
      await execFileAsync(config.dockerBinary, ["run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", `${config.runAsUid}:${config.runAsGid}`, "--mount", `type=bind,source=${probeWorkspace},target=/workspace,bind-recursive=disabled`, "--workdir", "/workspace", "--entrypoint", "/bin/sh", config.image, "-c", script], { timeout: 30_000, windowsHide: true });
      if ((await stat(join(probeWorkspace, "wrote"))).size !== 0) throw new Error("Sandbox write probe failed");
      if ((await readFile(join(probeRoot, "outside"), "utf8")) !== "private") throw new Error("Sandbox host isolation probe failed");
    } finally { await rm(probeRoot, { recursive: true, force: true }); }
    return { ready: true, provider: "docker", image: config.image,
      availableTools: SANDBOX_TOOL_NAMES.filter((name) => name !== "powershell" || flags.get("pwsh") === "1"),
      cliAvailable: flags.get("agent-browser") === "1" };
  }
  async function openSession(options: OpenSandboxSessionOptions): Promise<SandboxSession> {
    if (closed || sessions.size >= config.maxSessions) throw new Error("Sandbox capacity unavailable");
    if (!validId(options.sessionId) || !validId(options.policyVersion)) throw new Error("Invalid sandbox identity or policy version");
    if (options.network !== undefined && options.network !== "none") throw new Error("Unsupported sandbox network policy");
    if (typeof options.writable !== "boolean") throw new Error("Sandbox workspace access must be explicit");
    if (opening.has(options.sessionId) || [...sessions].some((session) => session.sessionId === options.sessionId)) throw new Error("Sandbox session ID already active");
    const lifetime = options.maxLifetimeMs ?? MAX_LIFETIME_MS;
    if (!Number.isInteger(lifetime) || lifetime < 1000 || lifetime > MAX_LIFETIME_MS) throw new Error("Invalid sandbox lifetime");
    opening.add(options.sessionId);
    try {
    const workspace = await realpath(options.workspacePath);
    if (!(await stat(workspace)).isDirectory()) throw new Error("Sandbox workspace must be a directory");
    await doctor();
    const identity = sandboxContainerIdentity(options.sessionId);
    const name = identity.name;
    const launchToken = randomUUID();
    const mount = `type=bind,source=${workspace},target=/workspace,bind-recursive=disabled${options.writable ? "" : ",readonly"}`;
    const args = ["run", "--rm", "--interactive", "--name", name,
      "--label", `${SANDBOX_OWNER_LABEL}=1`,
      "--label", `${SANDBOX_SESSION_LABEL}=${identity.hash}`,
      "--label", `${SANDBOX_IMAGE_LABEL}=${config.image}`,
      "--label", `${SANDBOX_LAUNCH_LABEL}=${launchToken}`,
      "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
      "--user", `${config.runAsUid}:${config.runAsGid}`, "--pids-limit", "64", "--memory", "512m", "--cpus", "1",
      "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=128m,mode=1777", "--mount", mount,
      "--workdir", "/workspace", "--env", "LORA_SANDBOX_WORKER=1", config.image];
    const child = spawn(config.dockerBinary, args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
    const pending = new Map<string, { resolve: (result: NativeToolResult) => void; reject: (error: Error) => void; onUpdate?: (result: NativeToolResult) => void }>();
    const usedIds = new Set<string>();
    let definitions: SandboxToolDefinition[] = [];
    let terminated = false;
    let closing = false;
    let closePromise: Promise<void> | undefined;
    let readyResolve!: () => void;
    let readyReject!: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    const timer = setTimeout(() => { void close().catch(() => undefined); }, lifetime);
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("utf8")).slice(-4096); });
    function fail(error: Error): void {
      if (terminated) return;
      terminated = true;
      clearTimeout(timer);
      sessions.delete(session);
      readyReject(error);
      for (const entry of pending.values()) entry.reject(error);
      pending.clear();
    }
    async function killContainer(): Promise<void> {
      // Verify the launch token so a failed start cannot stop a prior session with the same ID.
      await stopOwnedContainer({ name, sessionHash: identity.hash, image: config.image, launchToken }, runDocker);
      child.kill();
    }
    async function close(): Promise<void> {
      if (terminated) return;
      if (closePromise) return closePromise;
      closing = true;
      for (const entry of pending.values()) entry.reject(new Error("Sandbox call outcome uncertain after close"));
      pending.clear();
      closePromise = killContainer().then(() => { fail(new Error("Sandbox session closed")); }).finally(() => { closePromise = undefined; });
      return closePromise;
    }
    function write(message: SandboxRequest): void {
      if (terminated || closing) throw new Error("Sandbox session closed");
      child.stdin.write(`${assertBoundedJson(message)}\n`);
    }
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    lines.on("line", (line) => {
      try {
        if (Buffer.byteLength(line) > SANDBOX_MAX_MESSAGE_BYTES) throw new Error("Sandbox response exceeds limit");
        const message: unknown = JSON.parse(line);
        if (!isRecord(message) || message.v !== 1 || typeof message.type !== "string") throw new Error("Invalid sandbox response");
        const response = message as unknown as SandboxResponse;
        if (response.type === "ready") {
          if (!Array.isArray(response.definitions) || response.definitions.length !== SANDBOX_TOOL_NAMES.length ||
            response.definitions.some((d) => !SANDBOX_TOOL_NAMES.includes(d.name) || typeof d.available !== "boolean")) throw new Error("Invalid sandbox tool definitions");
          definitions = response.definitions;
          readyResolve(); return;
        }
        if (!validId(response.id)) throw new Error("Invalid response ID");
        const entry = pending.get(response.id);
        if (!entry) throw new Error("Unsolicited sandbox response");
        if (response.type === "update") {
          if (!validNativeResult(response.result)) throw new Error("Invalid sandbox update");
          entry.onUpdate?.(response.result); return;
        }
        if (response.type === "result") {
          if (!validNativeResult(response.result)) throw new Error("Invalid sandbox result");
          pending.delete(response.id);
          entry.resolve(response.result);
        }
        else if (response.type === "error") {
          if (typeof response.message !== "string") throw new Error("Invalid sandbox error");
          pending.delete(response.id);
          entry.reject(new Error(response.message));
        }
        else throw new Error("Invalid sandbox response type");
      } catch (error) { void close(); }
    });
    child.once("error", (error) => {
      readyReject(error);
      void close().catch(() => undefined);
    });
    child.once("exit", (code) => {
      if (closing) return;
      readyReject(new Error(`Sandbox transport exited ${code}: ${stderr}`));
      void close().catch(() => undefined);
    });
    async function submit(id: string, message: SandboxRequest, signal?: AbortSignal, onUpdate?: (result: NativeToolResult) => void): Promise<NativeToolResult> {
      if (!validId(id) || usedIds.has(id) || usedIds.size >= 10_000) throw new Error("Invalid, duplicate, or exhausted sandbox call ID");
      if (signal?.aborted) throw new Error("Sandbox call cancelled");
      usedIds.add(id);
      let abort: (() => void) | undefined;
      const result = new Promise<NativeToolResult>((resolve, reject) => {
        pending.set(id, { resolve, reject, onUpdate });
        abort = () => { void close().catch(() => undefined); };
        signal?.addEventListener("abort", abort, { once: true });
        try { write(message); }
        catch (error) { pending.delete(id); reject(error as Error); }
      });
      return result.finally(() => { if (abort) signal?.removeEventListener("abort", abort); });
    }
    const session: SandboxSession = {
      sessionId: options.sessionId,
      get toolDefinitions() { return definitions; },
      execute(call) {
        if (!SANDBOX_TOOL_NAMES.includes(call.name)) throw new Error("Unknown Pi tool");
        if (!options.writable && ["write", "edit", "bash", "powershell"].includes(call.name)) throw new Error("Tool requires writable sandbox");
        return submit(call.id, { v: 1, type: "execute", id: call.id, name: call.name, params: call.params }, call.signal, call.onUpdate);
      },
      executeCli(call) {
        if (call.executable !== "agent-browser") throw new Error("CLI unavailable");
        return submit(call.id, { v: 1, type: "cli", id: call.id, executable: call.executable, args: call.args }, call.signal, call.onUpdate);
      },
      async cancel(id) { if (pending.has(id)) await close(); },
      close,
    };
    sessions.add(session);
    let readyTimer: NodeJS.Timeout | undefined;
    try { await Promise.race([ready, new Promise<never>((_, reject) => { readyTimer = setTimeout(() => reject(new Error("Sandbox readiness timeout")), READY_TIMEOUT_MS); })]); }
    catch (error) { await close(); throw error; }
    finally { if (readyTimer) clearTimeout(readyTimer); }
    return session;
    } finally { opening.delete(options.sessionId); }
  }
  return { doctor, openSession, ensureSessionStopped,
    async close() { closed = true; await Promise.all([...sessions].map((session) => session.close())); } };
}
