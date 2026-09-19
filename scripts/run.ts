import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadInstalledProfile } from "../src/installed-profile.js";

const args = process.argv.slice(2);
if (args[0] !== "--agent-dir" || !args[1]) throw new Error("Required: --agent-dir <absolute path> [-- <Pi arguments>]");
const agentDir = args[1];
const configured = await loadInstalledProfile(agentDir);
const resources = configured.loaderOptions;
const cli = fileURLToPath(new URL("./cli.js", import.meta.resolve("@earendil-works/pi-coding-agent")));
const forwarded = args.slice(args[2] === "--" ? 3 : 2);
const child = spawn(process.execPath, [cli, "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-themes", "--no-context-files",
  "--system-prompt", resources.systemPrompt,
  ...resources.additionalExtensionPaths.flatMap((value) => ["--extension", value]),
  ...resources.additionalSkillPaths.flatMap((value) => ["--skill", value]),
  ...resources.additionalPromptTemplatePaths.flatMap((value) => ["--prompt-template", value]),
  ...forwarded], { env: { ...process.env, PI_CODING_AGENT_DIR: agentDir }, stdio: "inherit", shell: false });
child.on("error", () => { process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
