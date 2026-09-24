import fs from "node:fs";
import path from "node:path";
import type { KitProfile } from "../types.js";

export class ProfileResolver {
  private profilesDir: string;

  constructor(profilesDir?: string) {
    this.profilesDir = profilesDir ?? path.resolve(process.cwd(), "profiles");
  }

  /**
   * List all available profile names
   */
  public listProfiles(): string[] {
    if (!fs.existsSync(this.profilesDir)) {
      return [];
    }
    const files = fs.readdirSync(this.profilesDir);
    return files
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.basename(file, ".json"));
  }

  /**
   * Load and validate a profile by name
   */
  public resolveProfile(name: string): KitProfile {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u.test(name)) throw new Error("Invalid profile name");
    const profilePath = path.join(this.profilesDir, `${name}.json`);
    if (!fs.existsSync(profilePath)) {
      throw new Error(`Profile not found: ${name} at ${profilePath}`);
    }

    const raw = fs.readFileSync(profilePath, "utf-8");
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid JSON in profile ${name}: ${(err as Error).message}`);
    }

    this.validateProfile(parsed);
    return parsed as KitProfile;
  }

  /**
   * Validate that a profile contains required fields and correct types
   */
  public validateProfile(profile: any): void {
    if (!profile || typeof profile !== "object") {
      throw new Error("Profile must be an object");
    }
    if (!profile.name || typeof profile.name !== "string") {
      throw new Error("Profile must have a valid 'name' string");
    }
    if (!profile.description || typeof profile.description !== "string") {
      throw new Error("Profile must have a valid 'description' string");
    }
    if (typeof profile.promptTemplate !== "string" || !/^[a-zA-Z0-9_-]+$/u.test(profile.promptTemplate)) {
      throw new Error("Profile must specify a 'promptTemplate'");
    }
    if (!["none", "low", "medium", "high"].includes(profile.thinkingLevel)) {
      throw new Error(`Invalid thinkingLevel: ${profile.thinkingLevel}`);
    }
    if (!Array.isArray(profile.enabledExtensions) || profile.enabledExtensions.some((value: unknown) => typeof value !== "string" || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/u.test(value))) {
      throw new Error("Profile must have 'enabledExtensions' array");
    }
    if (!Array.isArray(profile.enabledSkills) || profile.enabledSkills.some((value: unknown) => typeof value !== "string" || !/^[a-zA-Z0-9_-]+$/u.test(value))) {
      throw new Error("Profile must have 'enabledSkills' array");
    }
    if (!Array.isArray(profile.enabledMcpServers)) {
      throw new Error("Profile must have 'enabledMcpServers' array");
    }
    if (!Array.isArray(profile.activeTools)) {
      throw new Error("Profile must have 'activeTools' array");
    }
    if (profile.sandboxExecution !== undefined && profile.sandboxExecution !== "required") {
      throw new Error("Invalid sandboxExecution policy");
    }
  }

  /**
   * Generate effective Pi agent directory path for the given profile and base directory
   */
  public resolveAgentDir(profile: KitProfile, baseDir?: string): string {
    const root = baseDir ?? path.resolve(process.env.HOME || process.env.USERPROFILE || ".", ".glassbox");
    const subpath = profile.runtimeIsolation?.defaultAgentDirSubpath ?? `pi/${profile.name}`;
    const resolved = path.resolve(root, subpath);
    const relative = path.relative(root, resolved);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Profile state escapes isolated root");
    return resolved;
  }
}
