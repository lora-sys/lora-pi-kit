import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import type { SkillsLock, SkillMetadata } from "../src/types.js";
import { kitRoot } from "../src/paths.js";

/** Copy immutable Git blobs from the reviewed source commit, never re-label local edits. */
export function syncSkills(options: { sourceDirectory: string; sourceCommit?: string; rootDir?: string }): SkillsLock {
  const root = fs.realpathSync(options.rootDir ?? kitRoot());
  const lockPath = path.join(root, "locks/skills.lock.json");
  const previous: SkillsLock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  const commit = options.sourceCommit ?? previous.sourceCommit;
  if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error("A full Skills source commit is required");
  const git = (args: string[]) => execFileSync("git", ["-C", options.sourceDirectory, ...args], { maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  const remote = git(["remote", "get-url", "origin"]).toString("utf8").trim().replace(/\.git$/u, "");
  if (remote !== "https://github.com/lora-sys/skills") throw new Error("Skills source must be the canonical repository");
  if (git(["rev-parse", "--verify", `${commit}^{commit}`]).toString("utf8").trim() !== commit) throw new Error("Skills commit mismatch");
  const skills = previous.includedSkills;
  if (!skills.length || skills.some((name) => !/^[a-zA-Z0-9_-]+$/u.test(name))) throw new Error("Invalid selected Skills");
  const entries = git(["ls-tree", "-rz", "--full-tree", commit, "--", ...skills.map((name) => `skills/${name}/`)]).toString("utf8").split("\0").filter(Boolean);
  const stage = fs.mkdtempSync(path.join(root, ".skills-sync-"));
  const backup = path.join(stage, "previous-skills");
  const target = path.join(root, "skills");
  const metadata: Record<string, SkillMetadata> = {};
  let activated = false;
  let succeeded = false;
  try {
    for (const entry of entries) {
      const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/u.exec(entry);
      if (!match) throw new Error("Skills snapshot contains a non-regular file");
      const relative = match[3]!;
      const segments = relative.split("/");
      const skill = segments[1]!;
      if (segments[0] !== "skills" || !skills.includes(skill) || segments.some((part) => !part || part === "." || part === ".." || /[\\:\0]/u.test(part))) throw new Error("Invalid Skills source path");
      const content = git(["cat-file", "blob", match[2]!]);
      const file = path.join(stage, ...segments);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
      metadata[skill] ??= { name: skill, description: previous.skills[skill]?.description ?? skill,
        license: previous.skills[skill]?.license, files: [] };
      metadata[skill].files.push({ path: relative, bytes: content.length, sha256: crypto.createHash("sha256").update(content).digest("hex") });
    }
    for (const name of skills) if (!metadata[name]?.files.some((file) => file.path === `skills/${name}/SKILL.md`)) throw new Error(`Missing selected Skill: ${name}`);
    const lock: SkillsLock = { sourceRepository: remote, sourceCommit: commit, syncedAt: new Date().toISOString(), includedSkills: skills, skills: metadata };
    fs.writeFileSync(path.join(stage, "skills.lock.json"), JSON.stringify(lock, null, 2) + "\n");
    if (fs.existsSync(target)) fs.renameSync(target, backup);
    fs.renameSync(path.join(stage, "skills"), target);
    activated = true;
    fs.renameSync(path.join(stage, "skills.lock.json"), lockPath);
    succeeded = true;
    return lock;
  } finally {
    if (path.dirname(stage) !== root || path.dirname(target) !== root) throw new Error("Invalid Skills staging path");
    if (!succeeded && fs.existsSync(backup)) {
      if (activated) fs.rmSync(target, { recursive: true, force: true });
      fs.renameSync(backup, target);
    }
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { source: { type: "string" }, commit: { type: "string" }, root: { type: "string" } } });
  if (!values.source) throw new Error("Required: --source <canonical repository checkout> [--commit <40-character SHA>]");
  console.log(JSON.stringify(syncSkills({ sourceDirectory: values.source, sourceCommit: values.commit, rootDir: values.root }), null, 2));
}
