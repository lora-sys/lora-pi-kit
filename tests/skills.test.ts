import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { SkillsLock } from "../src/types.js";

describe("Bundled Skills & Lock Integrity", () => {
  const root = path.resolve(__dirname, "..");
  const lockPath = path.join(root, "locks", "skills.lock.json");

  it("should have valid skills.lock.json pinned to the canonical Skills commit", () => {
    expect(fs.existsSync(lockPath)).toBe(true);
    const lock: SkillsLock = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
    expect(lock.sourceRepository).toBe("https://github.com/lora-sys/skills");
    expect(lock.sourceCommit).toBe("cd295366c1dbfc3114eb7e351ea68642d4526dbf");
    expect(lock.includedSkills).toContain("unslop");
    expect(lock.includedSkills).toContain("web-development-team-playbook");
    expect(lock.includedSkills).toContain("agent-browser");
    expect(lock.includedSkills).not.toContain("playwright-cli");

    const agentBrowser = lock.skills["agent-browser"];
    expect(agentBrowser?.sourcePath).toBe("skills/agent-browser");
    expect(agentBrowser?.license).toBe("Apache-2.0");
    const noticePath = path.join(root, "skills/agent-browser/NOTICE");
    const notice = fs.readFileSync(noticePath, "utf-8");
    expect(notice).toContain("https://github.com/vercel-labs/agent-browser/tree/v0.38.1/skill-data/core");
    expect(notice).toContain("Published npm package: agent-browser 0.38.1");
  });

  it("should verify every file in bundled skills against locked SHA256 checksums", () => {
    const lock: SkillsLock = JSON.parse(fs.readFileSync(lockPath, "utf-8"));

    for (const skillName of lock.includedSkills) {
      const meta = lock.skills[skillName];
      expect(meta).toBeDefined();

      const skillDir = path.join(root, "skills", skillName);
      expect(fs.existsSync(path.join(skillDir, "SKILL.md"))).toBe(true);

      for (const f of meta.files) {
        const fullPath = path.join(root, f.path);
        expect(fs.existsSync(fullPath)).toBe(true);

        const content = fs.readFileSync(fullPath);
        const hash = crypto.createHash("sha256").update(content).digest("hex");
        expect(hash).toBe(f.sha256);
      }
    }
  });
});
