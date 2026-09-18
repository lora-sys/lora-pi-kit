import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { DefaultPackageManager, SettingsManager, VERSION } from "@earendil-works/pi-coding-agent";
import { runDoctor } from "./doctor.js";
import { ProfileResolver } from "../src/profiles/resolver.js";
import { kitRoot } from "../src/paths.js";

export async function installKit(options: { rootDir?: string; agentDir: string; profile: string }) {
  const root = path.resolve(options.rootDir ?? kitRoot());
  if (!path.isAbsolute(options.agentDir)) throw new Error("An absolute isolated agentDir is required");
  const result = runDoctor(root);
  if (!result.allPassed) throw new Error("Kit doctor failed before installation");
  const lock = JSON.parse(await readFile(path.join(root, "locks/pi.lock.json"), "utf8"));
  if (VERSION !== lock.version) throw new Error("Installed Pi does not match the Kit compatibility lock");
  const profile = new ProfileResolver(path.join(root, "profiles")).resolveProfile(options.profile);
  let previousRoot: string | undefined;
  try {
    previousRoot = JSON.parse(await readFile(path.join(options.agentDir, "lora-installation.json"), "utf8")).packageRoot;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await mkdir(path.join(options.agentDir, "extensions"), { recursive: true, mode: 0o700 });
  const settings = SettingsManager.create(options.agentDir, options.agentDir);
  const packages = new DefaultPackageManager({ cwd: options.agentDir, agentDir: options.agentDir, settingsManager: settings });
  await packages.installAndPersist(root);
  settings.setPackages(settings.getPackages().filter((entry) => {
    const source = path.resolve(options.agentDir, typeof entry === "string" ? entry : entry.source);
    return source !== previousRoot || source === root;
  }).map((entry) => {
    if (path.resolve(options.agentDir, typeof entry === "string" ? entry : entry.source) !== root) return entry;
    return { source: root,
      extensions: profile.enabledExtensions.filter((name) => name !== "mcp/tool-adapter").map((name) => `extensions/${name}.ts`),
      skills: profile.enabledSkills.map((name) => `skills/${name}/SKILL.md`),
      prompts: [`prompts/${profile.promptTemplate}.md`], themes: [] };
  }));
  settings.setDefaultThinkingLevel(profile.thinkingLevel === "none" ? "off" : profile.thinkingLevel);
  await settings.flush();
  if (settings.drainErrors().length) throw new Error("Pi settings could not be persisted");
  const adapter = pathToFileURL(path.join(root, "extensions/mcp/tool-adapter.ts")).href;
  const mcpOptions = { profileName: profile.name, enabledServers: profile.enabledMcpServers, registryPath: path.join(root, "mcp/registry.json") };
  const prefixes = profile.enabledMcpServers.map((name) => `mcp_${name}_`);
  const wrapper = `import { createMcpExtension } from ${JSON.stringify(adapter)};\nexport default async function(pi) {\n  await createMcpExtension(${JSON.stringify(mcpOptions)})(pi);\n  pi.on("session_start", () => {\n    const mcp = pi.getAllTools().map(tool => tool.name).filter(name => ${JSON.stringify(prefixes)}.some(prefix => name.startsWith(prefix)));\n    pi.setActiveTools([...${JSON.stringify(profile.activeTools)}, ...mcp]);\n  });\n}\n`;
  await writeFile(path.join(options.agentDir, "extensions/lora-profile.ts"), wrapper, { mode: 0o600 });
  const installation = { packageRoot: root, profile: profile.name, piVersion: VERSION, installedAt: new Date().toISOString() };
  await writeFile(path.join(options.agentDir, "lora-installation.json"), JSON.stringify(installation, null, 2) + "\n", { mode: 0o600 });
  return { success: true, ...installation, agentDir: options.agentDir };
}

export function installArguments() {
  const { values } = parseArgs({ options: { "agent-dir": { type: "string" }, profile: { type: "string" }, root: { type: "string" } } });
  if (!values["agent-dir"] || !values.profile) throw new Error("Required: --agent-dir <absolute path> --profile <name>");
  return { agentDir: values["agent-dir"], profile: values.profile, rootDir: values.root };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await installKit(installArguments()), null, 2));
}
