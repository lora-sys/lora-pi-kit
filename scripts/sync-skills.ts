import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SkillsLock, SkillMetadata, SkillLockEntry } from "../src/types.js";

export function syncSkills(options: {
  rootDir?: string;
  sourceCommit?: string;
  sourceRepository?: string;
} = {}): SkillsLock {
  const root = options.rootDir ?? path.resolve(process.cwd());
  const skillsDir = path.join(root, "skills");
  const locksDir = path.join(root, "locks");
  const lockFilePath = path.join(locksDir, "skills.lock.json");

  if (!fs.existsSync(skillsDir)) {
    throw new Error(`Skills directory not found at ${skillsDir}`);
  }

  let existingLock: Partial<SkillsLock> = {};
  if (fs.existsSync(lockFilePath)) {
    existingLock = JSON.parse(fs.readFileSync(lockFilePath, "utf-8"));
  }

  const skillEntries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const includedSkills: string[] = [];
  const skillsRecord: Record<string, SkillMetadata> = {};

  for (const entry of skillEntries) {
    if (!entry.isDirectory()) continue;
    const skillName = entry.name;
    const skillPath = path.join(skillsDir, skillName);
    const skillMdPath = path.join(skillPath, "SKILL.md");

    if (!fs.existsSync(skillMdPath)) continue;

    includedSkills.push(skillName);
    const filesList: SkillLockEntry[] = [];

    function walk(dir: string) {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          walk(full);
        } else if (item.isFile()) {
          const content = fs.readFileSync(full);
          const hash = crypto.createHash("sha256").update(content).digest("hex");
          const rel = path.relative(root, full).replace(/\\/g, "/");
          filesList.push({
            path: rel,
            sha256: hash,
            bytes: content.length,
          });
        }
      }
    }

    walk(skillPath);

    // Extract description from existing or SKILL.md
    const existingSkill = existingLock.skills?.[skillName];
    skillsRecord[skillName] = {
      name: skillName,
      description: existingSkill?.description ?? `Pinned skill ${skillName}`,
      license: existingSkill?.license ?? "MIT",
      files: filesList,
    };
  }

  const newLock: SkillsLock = {
    sourceRepository: options.sourceRepository ?? existingLock.sourceRepository ?? "https://github.com/lora-sys/skills",
    sourceCommit: options.sourceCommit ?? existingLock.sourceCommit ?? "54bf1404a040395a6744549f3d4723d62022fb5b",
    syncedAt: new Date().toISOString(),
    includedSkills,
    skills: skillsRecord,
  };

  fs.mkdirSync(locksDir, { recursive: true });
  fs.writeFileSync(lockFilePath, JSON.stringify(newLock, null, 2) + "\n", "utf-8");
  return newLock;
}

if (process.argv[1] && process.argv[1].endsWith("sync-skills.ts")) {
  console.log("Synchronizing skills and updating locks/skills.lock.json...");
  const lock = syncSkills();
  console.log(`Synced ${lock.includedSkills.length} skills: ${lock.includedSkills.join(", ")}`);
  console.log(`Lockfile written with source commit: ${lock.sourceCommit}`);
}
