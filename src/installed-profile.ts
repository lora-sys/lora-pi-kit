import { readFile } from "node:fs/promises";
import path from "node:path";
import { ProfileResolver } from "./profiles/resolver.js";
import { runDoctor } from "../scripts/doctor.js";

/** Public Pi loader options for the installed profile, with ambient discovery off. */
export async function loadInstalledProfile(agentDir: string) {
  if (!path.isAbsolute(agentDir)) throw new Error("An absolute isolated agentDir is required");
  const installation = JSON.parse(await readFile(path.join(agentDir, "lora-installation.json"), "utf8"));
  const root = installation.packageRoot as string;
  if (!runDoctor(root).allPassed) throw new Error("Installed Kit doctor failed");
  const profile = new ProfileResolver(path.join(root, "profiles")).resolveProfile(installation.profile);
  const systemPrompt = (await readFile(path.join(root, "prompts", `${profile.promptTemplate}.md`), "utf8"))
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, "").trim();
  return {
    root, profile,
    loaderOptions: {
      agentDir, systemPrompt, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      additionalExtensionPaths: [
        ...profile.enabledExtensions.filter((name) => name !== "mcp/tool-adapter").map((name) => path.join(root, "extensions", `${name}.ts`)),
        path.join(agentDir, "extensions/lora-profile.ts"),
      ],
      additionalSkillPaths: profile.enabledSkills.map((name) => path.join(root, "skills", name)),
      additionalPromptTemplatePaths: [path.join(root, "prompts", `${profile.promptTemplate}.md`)],
    },
  };
}
