import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import type { SkillsLock, SkillMetadata } from "../src/types.js";
import { kitRoot } from "../src/paths.js";

interface DiscoveredSkill {
  name: string;
  description: string;
  license?: string;
  sourcePath: string;
}

function frontmatterValue(content: string, key: string): string | undefined {
  const normalized = content.replace(/\r\n/gu, "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/u.exec(normalized);
  if (!match) return undefined;
  const lines = match[1]!.split("\n");
  const index = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (index < 0) return undefined;
  const raw = lines[index]!.slice(key.length + 1).trim();
  if (raw === ">" || raw === "|") return undefined;
  return raw.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/u, "$1$2").trim() || undefined;
}

function foldedFrontmatterValue(content: string, key: string): string | undefined {
  const normalized = content.replace(/\r\n/gu, "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/u.exec(normalized);
  if (!match) return undefined;
  const lines = match[1]!.split("\n");
  const index = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (index < 0) return undefined;
  const raw = lines[index]!.slice(key.length + 1).trim();
  if (raw !== ">" && raw !== "|") return frontmatterValue(content, key);
  const values: string[] = [];
  for (const line of lines.slice(index + 1)) {
    if (!/^\s+/u.test(line)) break;
    values.push(line.trim());
  }
  return values.join(raw === ">" ? " " : "\n").trim() || undefined;
}

function discoverSkills(
  git: (args: string[]) => Buffer,
  commit: string,
): { skills: DiscoveredSkill[]; excluded: Array<{ sourcePath: string; reason: string }> } {
  const files = git(["ls-tree", "-rz", "--name-only", commit, "--", "skills/"])
    .toString("utf8")
    .split("\0")
    .filter((entry) => /(?:^|\/)SKILL\.md$/u.test(entry));
  if (files.length === 0) throw new Error("No validated Skills found at the source commit");
  const discovered: DiscoveredSkill[] = [];
  const excluded: Array<{ sourcePath: string; reason: string }> = [];
  for (const entrypoint of files) {
    if (!/^skills\/(?:[a-zA-Z0-9_-]+\/)+SKILL\.md$/u.test(entrypoint))
      throw new Error("Invalid Skill entrypoint path");
    const content = git(["show", `${commit}:${entrypoint}`]).toString("utf8");
    const name = frontmatterValue(content, "name");
    const description = foldedFrontmatterValue(content, "description");
    const sourcePath = path.posix.dirname(entrypoint);
    const parent = path.posix.basename(sourcePath);
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name) || name !== parent) {
      excluded.push({ sourcePath, reason: "invalid_name" });
      continue;
    }
    if (!description || description.length > 1024) {
      excluded.push({ sourcePath, reason: "invalid_description" });
      continue;
    }
    discovered.push({
      name,
      description,
      sourcePath,
      ...(frontmatterValue(content, "license")
        ? { license: frontmatterValue(content, "license") }
        : {}),
    });
  }
  const names = discovered.map((skill) => skill.name);
  if (new Set(names).size !== names.length) throw new Error("Duplicate validated Skill name");
  return {
    skills: discovered.sort((left, right) => left.name.localeCompare(right.name)),
    excluded: excluded.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath)),
  };
}

/** Copy every structurally valid Skill from an immutable reviewed Git commit. */
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
  const discovery = discoverSkills(git, commit);
  const discovered = discovery.skills;
  if (discovered.length === 0) throw new Error("No validated Skills found at the source commit");
  const skills = discovered.map((skill) => skill.name);
  const entriesBySkill = new Map(
    discovered.map((skill) => [
      skill.name,
      git(["ls-tree", "-rz", "--full-tree", commit, "--", `${skill.sourcePath}/`])
        .toString("utf8")
        .split("\0")
        .filter(Boolean),
    ]),
  );
  const stage = fs.mkdtempSync(path.join(root, ".skills-sync-"));
  const backup = path.join(stage, "previous-skills");
  const target = path.join(root, "skills");
  const metadata: Record<string, SkillMetadata> = {};
  let activated = false;
  let succeeded = false;
  try {
    for (const skill of discovered) {
      metadata[skill.name] = {
        name: skill.name,
        description: skill.description,
        sourcePath: skill.sourcePath,
        ...(skill.license ? { license: skill.license } : {}),
        files: [],
      };
      for (const entry of entriesBySkill.get(skill.name) ?? []) {
        const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/u.exec(entry);
        if (!match) throw new Error("Skills snapshot contains a non-regular file");
        const sourceRelative = match[3]!;
        if (!sourceRelative.startsWith(`${skill.sourcePath}/`))
          throw new Error("Invalid Skills source path");
        const suffix = sourceRelative.slice(skill.sourcePath.length + 1);
        const segments = suffix.split("/");
        if (segments.some((part) => !part || part === "." || part === ".." || /[\\:\0]/u.test(part)))
          throw new Error("Invalid Skills source path");
        const relative = path.posix.join("skills", skill.name, suffix);
        const content = git(["cat-file", "blob", match[2]!]);
        const file = path.join(stage, ...relative.split("/"));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
        metadata[skill.name].files.push({
          path: relative,
          bytes: content.length,
          sha256: crypto.createHash("sha256").update(content).digest("hex"),
        });
      }
    }
    for (const name of skills) if (!metadata[name]?.files.some((file) => file.path === `skills/${name}/SKILL.md`)) throw new Error(`Missing selected Skill: ${name}`);
    const lock: SkillsLock = {
      sourceRepository: remote,
      sourceCommit: commit,
      syncedAt: new Date().toISOString(),
      includedSkills: skills,
      excludedSkills: discovery.excluded,
      skills: metadata,
    };
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
