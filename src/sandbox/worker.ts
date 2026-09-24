import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
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
    send({ v: 1, type: "result", id: request.id, result });
  } finally { active.delete(request.id); }
}

async function cli(request: Extract<SandboxRequest, { type: "cli" }>): Promise<void> {
  if (request.executable !== "agent-browser") throw new Error("CLI unavailable");
  if (request.args.some((arg) => typeof arg !== "string" || arg.length > 4096 || arg.includes("\0"))) throw new Error("Invalid CLI argument");
  const controller = new AbortController();
  active.set(request.id, controller);
  try {
    const child = spawn("/opt/lora/bin/agent-browser", request.args, {
      cwd: "/workspace", env: { HOME: "/tmp", PATH: "/opt/lora/bin:/usr/local/bin:/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe"], signal: controller.signal,
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (Buffer.byteLength(output) > SANDBOX_MAX_MESSAGE_BYTES / 2) controller.abort();
      else send({ v: 1, type: "update", id: request.id, result: { content: [{ type: "text", text: chunk.toString("utf8") }] } });
    });
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject); child.once("close", resolve);
    });
    send({ v: 1, type: "result", id: request.id, result: { content: [{ type: "text", text: output }], isError: code !== 0, details: { exitCode: code } } });
  } finally { active.delete(request.id); }
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
    if (value.type === "cli" && value.executable === "agent-browser" && Array.isArray(value.args)) {
      void cli(value as Extract<SandboxRequest, { type: "cli" }>).catch((error: unknown) => send({ v: 1, type: "error", id, message: String(error) }));
      return;
    }
    throw new Error("Invalid sandbox request");
  } catch (error) { send({ v: 1, type: "error", id, message: String(error) }); }
});
process.stdin.once("end", () => { for (const controller of active.values()) controller.abort(); process.exit(0); });
