import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadInstalledProfile } from "../src/installed-profile.js";
import { createDockerSandboxExecutor } from "../src/sandbox/index.js";

const args = process.argv.slice(2);
if (args[0] !== "--agent-dir" || !args[1]) throw new Error("Required: --agent-dir <absolute path> [--workspace <absolute path>] [-- <Pi arguments>]");
const agentDir = args[1];
const configured = await loadInstalledProfile(agentDir);
const resources = configured.loaderOptions;
const cli = fileURLToPath(new URL("./cli.js", import.meta.resolve("@earendil-works/pi-coding-agent")));
const separator = args.indexOf("--", 2);
const launcherArgs = args.slice(2, separator < 0 ? undefined : separator);
const forwarded = separator < 0 ? [] : args.slice(separator + 1);
let workspace: string | undefined;
for (let i = 0; i < launcherArgs.length; i += 2) {
  if (launcherArgs[i] !== "--workspace" || !launcherArgs[i + 1] || workspace) throw new Error("Only one --workspace <absolute path> launcher option is supported");
  workspace = launcherArgs[i + 1];
}
let sandboxImage: string | undefined;
if (configured.profile.sandboxExecution === "required") {
  if (!workspace || !path.isAbsolute(workspace)) throw new Error("This profile requires an absolute --workspace path and Docker sandbox");
  workspace = await realpath(workspace);
  if (!(await stat(workspace)).isDirectory()) throw new Error("Sandbox workspace must be a directory");
  const lock = JSON.parse(await readFile(path.join(configured.root, "locks", "sandbox-image.json"), "utf8"));
  sandboxImage = lock.image;
  if (typeof sandboxImage !== "string") throw new Error("Kit sandbox image lock is missing");
  const executor = createDockerSandboxExecutor({ image: sandboxImage });
  try { await executor.doctor(); } finally { await executor.close(); }
} else if (workspace) throw new Error("This profile has no sandbox execution contract");
const child = spawn(process.execPath, [cli, "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-themes", "--no-context-files",
  ...(sandboxImage ? ["--no-builtin-tools"] : []),
  "--system-prompt", resources.systemPrompt,
  ...resources.additionalExtensionPaths.flatMap((value) => ["--extension", value]),
  ...(sandboxImage ? ["--extension", path.join(configured.root, "extensions", "core", "sandbox-tools.ts")] : []),
  ...resources.additionalSkillPaths.flatMap((value) => ["--skill", value]),
  ...resources.additionalPromptTemplatePaths.flatMap((value) => ["--prompt-template", value]),
  ...forwarded], { env: { ...process.env, PI_CODING_AGENT_DIR: agentDir,
    ...(sandboxImage ? { LORA_SANDBOX_IMAGE: sandboxImage, LORA_SANDBOX_WORKSPACE: workspace,
      LORA_SANDBOX_SESSION_ID: randomUUID(), LORA_SANDBOX_POLICY_VERSION: `kit_${configured.profile.name}_v1` } : {}) },
  stdio: "inherit", shell: false });
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { child.kill(signal); });
}
child.on("error", () => { process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
