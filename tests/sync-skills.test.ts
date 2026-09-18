import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { syncSkills } from "../scripts/sync-skills.js";

it("copies pinned Git blobs and removes stale bundled files without relabeling dirty source contents", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "lora-sync-"));
  const source = path.join(directory, "source");
  const root = path.join(directory, "kit");
  mkdirSync(path.join(source, "skills/unslop"), { recursive: true });
  mkdirSync(path.join(root, "locks"), { recursive: true });
  mkdirSync(path.join(root, "skills/unslop"), { recursive: true });
  const git = (args: string[]) => execFileSync("git", ["-C", source, ...args], { encoding: "utf8", windowsHide: true });
  try {
    git(["init", "--quiet"]);
    git(["remote", "add", "origin", "https://github.com/lora-sys/skills.git"]);
    git(["config", "core.autocrlf", "false"]);
    writeFileSync(path.join(source, "skills/unslop/SKILL.md"), "Pinned content\n");
    git(["add", "."]);
    git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "Fixture"]);
    const commit = git(["rev-parse", "HEAD"]).trim();
    writeFileSync(path.join(root, "locks/skills.lock.json"), JSON.stringify({ sourceCommit: commit, includedSkills: ["unslop"], skills: {} }));
    writeFileSync(path.join(root, "skills/unslop/stale.txt"), "stale");
    writeFileSync(path.join(source, "skills/unslop/SKILL.md"), "UNCOMMITTED_CONTENT");
    const lock = syncSkills({ rootDir: root, sourceDirectory: source });
    expect(lock.sourceCommit).toBe(commit);
    expect(readFileSync(path.join(root, "skills/unslop/SKILL.md"), "utf8")).toBe("Pinned content\n");
    expect(existsSync(path.join(root, "skills/unslop/stale.txt"))).toBe(false);
    const before = readFileSync(path.join(root, "locks/skills.lock.json"), "utf8");
    expect(() => syncSkills({ rootDir: root, sourceDirectory: source, sourceCommit: "../HEAD" })).toThrow("full Skills source commit");
    expect(readFileSync(path.join(root, "locks/skills.lock.json"), "utf8")).toBe(before);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
