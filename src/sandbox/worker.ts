import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { connect as connectSocket } from "node:net";
import { accessSync, constants } from "node:fs";
import { mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import {
  createReadTool, createGrepTool, createFindTool, createLsTool,
  createWriteTool, createEditTool, createBashTool, createPowerShellTool,
} from "@earendil-works/pi-coding-agent";
import {
  SANDBOX_MAX_MESSAGE_BYTES, SANDBOX_PROTOCOL_VERSION, SANDBOX_TOOL_NAMES,
  assertBoundedJson, isRecord, validId, type NativeToolResult,
  type PiToolName, type SandboxRequest, type SandboxResponse,
} from "./protocol.js";

if (process.env.LORA_SANDBOX_WORKER !== "1" || process.cwd() !== "/workspace") {
  throw new Error("Sandbox worker must start in its fixed container runtime");
}

const tools = {
  read: createReadTool("/workspace"), grep: createGrepTool("/workspace"),
  find: createFindTool("/workspace"), ls: createLsTool("/workspace"),
  write: createWriteTool("/workspace"), edit: createEditTool("/workspace"),
  bash: createBashTool("/workspace", { exposeSessionEnvironment: false }),
  powershell: createPowerShellTool("/workspace", {
    exposeSessionEnvironment: false,
    operations: {
      exec(command, cwd, options) {
        return new Promise((resolve, reject) => {
          const child = spawn("/usr/bin/pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
            "try { [Console]::OutputEncoding=[System.Text.Encoding]::UTF8 } catch {}\n" + command],
          { cwd, env: options.env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
          let done = false;
          let timedOut = false;
          let timeout: NodeJS.Timeout | undefined;
          const stop = () => { if (child.pid) { try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); } } };
          options.signal?.addEventListener("abort", stop, { once: true });
          if (options.signal?.aborted) stop();
          if (options.timeout !== undefined) timeout = setTimeout(() => { timedOut = true; stop(); }, options.timeout * 1000);
          child.stdout.on("data", options.onData);
          child.stderr.on("data", options.onData);
          child.once("error", (error) => { if (!done) { done = true; reject(error); } });
          child.once("close", (code) => {
            if (timeout) clearTimeout(timeout);
            options.signal?.removeEventListener("abort", stop);
            if (!done) {
              done = true;
              if (options.signal?.aborted) reject(new Error("aborted"));
              else if (timedOut) reject(new Error(`timeout:${options.timeout}`));
              else resolve({ exitCode: code });
            }
          });
        });
      },
    },
  }),
};
const available = (name: PiToolName) => {
  if (name === "powershell") {
    try { accessSync("/usr/bin/pwsh", constants.X_OK); return true; }
    catch { return false; }
  }
  return true;
};
const active = new Map<string, AbortController>();
function send(message: SandboxResponse): void {
  try { process.stdout.write(`${assertBoundedJson(message)}\n`); }
  catch { process.stderr.write("Sandbox protocol output exceeded limit\n"); process.exit(1); }
}

function browserSessionName(args: readonly string[]): string {
  const index = args.findIndex((arg) => arg === "--session" || arg.startsWith("--session="));
  const value = index < 0 ? "default" : args[index]!.startsWith("--session=")
    ? args[index]!.slice("--session=".length)
    : args[index + 1];
  if (!value || !/^[A-Za-z0-9_-]{1,80}$/u.test(value)) throw new Error("Invalid agent-browser session name");
  return value;
}

async function closeBrowserSession(sessionName: string, proxyUrl?: string): Promise<void> {
  const args = [
    "--executable-path", "/opt/lora/browser/chrome",
    ...(proxyUrl ? ["--proxy", proxyUrl, "--proxy-bypass", ""] : []),
    "--session", sessionName, "close",
  ];
  const child = spawn("/opt/lora/bin/agent-browser", args, {
    cwd: "/workspace",
    env: {
      HOME: "/tmp", PATH: "/opt/lora/bin:/usr/local/bin:/usr/bin:/bin",
      AGENT_BROWSER_EXECUTABLE_PATH: "/opt/lora/browser/chrome",
      ...(proxyUrl ? { HTTP_PROXY: proxyUrl, HTTPS_PROXY: proxyUrl, ALL_PROXY: proxyUrl, NO_PROXY: "", no_proxy: "" } : {}),
    },
    stdio: "ignore", detached: true,
  });
  const timeout = setTimeout(() => stopProcessGroup(child), 5000);
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject); child.once("close", resolve);
    });
    if (code !== 0) throw new Error("agent-browser session close was not confirmed");
  } finally { clearTimeout(timeout); }
}

async function waitForProxy(): Promise<void> {
  const proxyUrl = process.env.LORA_SANDBOX_PROXY_URL;
  if (!proxyUrl) return;
  const proxy = new URL(proxyUrl);
  if (proxy.protocol !== "http:" || proxy.hostname !== "lora-egress-proxy" || proxy.port !== "3128") {
    throw new Error("Invalid sandbox proxy configuration");
  }
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = connectSocket({ host: proxy.hostname, port: Number(proxy.port) });
        socket.setTimeout(1000, () => { socket.destroy(); reject(new Error("proxy probe timeout")); });
        socket.once("connect", () => { socket.destroy(); resolve(); });
        socket.once("error", reject);
      });
      return;
    } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  throw new Error("Controlled egress proxy unavailable");
}

await waitForProxy();
send({ v: SANDBOX_PROTOCOL_VERSION, type: "ready", definitions: SANDBOX_TOOL_NAMES.map((name) => ({
  name, description: tools[name].description, parameters: tools[name].parameters, available: available(name),
})) });

async function execute(request: Extract<SandboxRequest, { type: "execute" }>): Promise<void> {
  const tool = tools[request.name];
  if (!available(request.name)) throw new Error(`${request.name} unavailable in sandbox image`);
  const controller = new AbortController();
  active.set(request.id, controller);
  try {
    const params = tool.prepareArguments ? tool.prepareArguments(request.params) : request.params;
    const result = await tool.execute(request.id, params as never, controller.signal, (update: NativeToolResult) => {
      send({ v: 1, type: "update", id: request.id, result: update });
    });
    send(controller.signal.aborted
      ? { v: 1, type: "cancelled", id: request.id }
      : { v: 1, type: "result", id: request.id, result });
  } catch (error) {
    if (controller.signal.aborted) send({ v: 1, type: "cancelled", id: request.id });
    else throw error;
  } finally { active.delete(request.id); }
}

async function cli(request: Extract<SandboxRequest, { type: "cli" }>): Promise<void> {
  if (request.executable !== "agent-browser") throw new Error("CLI unavailable");
  if (request.args.some((arg) => typeof arg !== "string" || arg.length > 4096 || arg.includes("\0"))) throw new Error("Invalid CLI argument");
  const controller = new AbortController();
  active.set(request.id, controller);
  let artifactDirectory: string | undefined;
  try {
    const proxyUrl = process.env.LORA_SANDBOX_PROXY_URL;
    if (request.args.some((arg) => arg === "--proxy" || arg.startsWith("--proxy=") || arg === "--proxy-bypass" || arg.startsWith("--proxy-bypass="))) {
      throw new Error("CLI proxy settings are controlled by the sandbox");
    }
    let args = ["--executable-path", "/opt/lora/browser/chrome", ...(proxyUrl ? ["--proxy", proxyUrl, "--proxy-bypass", ""] : []), ...request.args];
    const browserSession = browserSessionName(request.args);
    if (request.maxArtifactBytes !== undefined) {
      if (!Number.isInteger(request.maxArtifactBytes) || request.maxArtifactBytes < 1 || request.maxArtifactBytes > 2 * 1024 * 1024) {
        throw new Error("Invalid screenshot Artifact size limit");
      }
      let commandIndex = 0;
      while (commandIndex < request.args.length) {
        const arg = request.args[commandIndex]!;
        if (arg === "--json") { commandIndex++; continue; }
        if (arg === "--session" || arg === "--timeout") {
          if (!request.args[commandIndex + 1] || request.args[commandIndex + 1]!.startsWith("-")) throw new Error("Invalid agent-browser global option");
          commandIndex += 2;
          continue;
        }
        break;
      }
      if (request.args[commandIndex] !== "screenshot") {
        throw new Error("Artifact output is limited to one screenshot command");
      }
      const screenshotArgs = request.args.slice(commandIndex + 1);
      const acceptedFlags = new Set(["--full", "--annotate", "--if-changed"]);
      for (let index = 0; index < screenshotArgs.length; index++) {
        const arg = screenshotArgs[index]!;
        if (arg === "--threshold") {
          index++;
          if (!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/u.test(screenshotArgs[index] ?? "")) throw new Error("Invalid screenshot threshold");
          continue;
        }
        if (!acceptedFlags.has(arg)) throw new Error("Screenshot Artifact cannot select a file path or extra command");
      }
      if (request.args.slice(commandIndex + 1).some((arg) => arg === "screenshot")) throw new Error("Nested screenshot commands are not allowed");
      artifactDirectory = await mkdtemp(join(tmpdir(), "lora-artifact-"));
      args = [...args, join(artifactDirectory, "capture.png")];
    }
    const child = spawn("/opt/lora/bin/agent-browser", args, {
      cwd: artifactDirectory ?? "/workspace",
      env: {
        HOME: "/tmp", PATH: "/opt/lora/bin:/usr/local/bin:/usr/bin:/bin",
        AGENT_BROWSER_EXECUTABLE_PATH: "/opt/lora/browser/chrome",
        ...(proxyUrl ? { HTTP_PROXY: proxyUrl, HTTPS_PROXY: proxyUrl, ALL_PROXY: proxyUrl, NO_PROXY: "", no_proxy: "" } : {}),
      },
      stdio: ["ignore", "pipe", "pipe"], detached: true,
    });
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdoutTruncated = false;
    let stderrTruncated = false;
    const append = (stream: NodeJS.ReadableStream, kind: "stdout" | "stderr") => stream.on("data", (chunk: Buffer) => {
      const isStdout = kind === "stdout";
      const limit = isStdout ? 512 * 1024 : 128 * 1024;
      const current = isStdout ? stdoutBytes : stderrBytes;
      const raw = Buffer.from(chunk);
      const piece = raw.subarray(0, Math.max(0, Math.min(raw.length, limit - current, 32 * 1024)));
      const text = piece.toString("utf8");
      if (isStdout) { stdout += text; stdoutBytes += piece.length; stdoutTruncated ||= piece.length < raw.length; }
      else { stderr += text; stderrBytes += piece.length; stderrTruncated ||= piece.length < raw.length; }
      if (!artifactDirectory && piece.length > 0) send({ v: 1, type: "update", id: request.id, result: {
        content: [{ type: "text", text }],
        details: { stdout: isStdout ? text : "", stderr: isStdout ? "" : text, exitCode: null },
      } });
      if (piece.length < raw.length) stopProcessGroup(child);
    });
    append(child.stdout, "stdout");
    append(child.stderr, "stderr");
    const abort = () => stopProcessGroup(child);
    controller.signal.addEventListener("abort", abort, { once: true });
    if (controller.signal.aborted) abort();
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject); child.once("close", resolve);
    });
    controller.signal.removeEventListener("abort", abort);
    try { if (child.pid) process.kill(-child.pid, "SIGKILL"); } catch { /* process group already exited */ }
    if (controller.signal.aborted) {
      await closeBrowserSession(browserSession, proxyUrl);
      send({ v: 1, type: "cancelled", id: request.id });
    }
    else {
      let artifact: { mimeType: "image/png"; data: string; sizeBytes: number } | undefined;
      if (artifactDirectory && code === 0) {
        try {
          const artifactPath = join(artifactDirectory, "capture.png");
          const [directoryPath, filePath, fileStat] = await Promise.all([
            realpath(artifactDirectory), realpath(artifactPath), stat(artifactPath),
          ]);
          const relativePath = relative(directoryPath, filePath);
          if (relativePath !== "capture.png" || relativePath.startsWith(`..${sep}`) || resolve(directoryPath, relativePath) !== filePath || !fileStat.isFile()) {
            throw new Error("Screenshot Artifact path failed validation");
          }
          if (fileStat.size < 8 || fileStat.size > request.maxArtifactBytes!) throw new Error("Screenshot Artifact size limit exceeded");
          const bytes = await readFile(filePath);
          if (!bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
            throw new Error("Screenshot Artifact is not a PNG image");
          }
          artifact = { mimeType: "image/png", data: bytes.toString("base64"), sizeBytes: bytes.byteLength };
        } catch {
          throw new Error("Screenshot Artifact validation failed");
        }
      }
      const safeOutput = (value: string) => artifactDirectory ? value.split(artifactDirectory).join("[screenshot Artifact]") : value;
      const safeStdout = safeOutput(stdout);
      const safeStderr = safeOutput(stderr);
      send({ v: 1, type: "result", id: request.id, result: {
        content: [{ type: "text", text: safeStdout }, { type: "text", text: safeStderr }],
        isError: code !== 0,
        details: { stdout: safeStdout, stderr: safeStderr, exitCode: code, stdoutTruncated, stderrTruncated, ...(artifact ? { artifact } : {}) },
      } });
    }
  } finally {
    if (artifactDirectory) await rm(artifactDirectory, { recursive: true, force: true });
    active.delete(request.id);
  }
}

function stopProcessGroup(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  const timer = setTimeout(() => {
    if (child.pid) { try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); } }
  }, 1000);
  timer.unref();
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", (line) => {
  let id: string | undefined;
  try {
    if (Buffer.byteLength(line) > SANDBOX_MAX_MESSAGE_BYTES) throw new Error("Request exceeds limit");
    const value: unknown = JSON.parse(line);
    if (!isRecord(value) || value.v !== 1 || typeof value.type !== "string") throw new Error("Invalid protocol message");
    if (value.type === "close") { for (const controller of active.values()) controller.abort(); process.exit(0); }
    if (!validId(value.id)) throw new Error("Invalid request ID");
    id = value.id;
    if (value.type === "cancel") { active.get(id)?.abort(); return; }
    if (active.has(id)) throw new Error("Duplicate request ID");
    if (value.type === "execute" && SANDBOX_TOOL_NAMES.includes(value.name as PiToolName) && isRecord(value.params)) {
      void execute(value as Extract<SandboxRequest, { type: "execute" }>).catch((error: unknown) => send({ v: 1, type: "error", id, message: String(error) }));
      return;
    }
    if (value.type === "cli" && value.executable === "agent-browser" && Array.isArray(value.args) &&
      (value.maxArtifactBytes === undefined || Number.isInteger(value.maxArtifactBytes))) {
      void cli(value as Extract<SandboxRequest, { type: "cli" }>).catch((error: unknown) => send({ v: 1, type: "error", id, message: String(error) }));
      return;
    }
    throw new Error("Invalid sandbox request");
  } catch (error) { send({ v: 1, type: "error", id, message: String(error) }); }
});
process.stdin.once("end", () => { for (const controller of active.values()) controller.abort(); process.exit(0); });
