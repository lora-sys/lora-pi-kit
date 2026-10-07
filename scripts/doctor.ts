import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { ProfileResolver } from "../src/profiles/resolver.js";
import { ManifestInspector } from "../src/manifest.js";
import type { SkillsLock, PiLock, CompatibilityMetadata, KitProfile, McpRegistry } from "../src/types.js";
import { kitRoot } from "../src/paths.js";

export interface DiagnosticCheck {
  name: string;
  passed: boolean;
  message: string;
  details?: unknown;
}

export interface DoctorResult {
  allPassed: boolean;
  checks: DiagnosticCheck[];
  timestamp: string;
}

export interface DoctorOptions {
  /** Profile names to deep-validate in addition to the global checks. */
  profiles?: string[];
}

export function runDoctor(rootDir?: string, options?: DoctorOptions): DoctorResult {
  const root = rootDir ?? kitRoot();
  const checks: DiagnosticCheck[] = [];

  // 1. Check Node.js version
  const nodeVer = process.version.replace(/^v/, "");
  const [major, minor] = nodeVer.split(".").map(Number);
  const nodeOk = major > 22 || (major === 22 && minor >= 19);
  checks.push({
    name: "Node.js Version",
    passed: nodeOk,
    message: nodeOk
      ? `Node.js ${process.version} meets requirement (>=22.19.0)`
      : `Node.js ${process.version} is unsupported (requires >=22.19.0)`,
  });

  // 2. Check Pi Package Manifest
  try {
    const inspector = new ManifestInspector(root);
    const manifestCheck = inspector.validateManifest();
    checks.push({
      name: "Pi Package Manifest",
      passed: manifestCheck.valid,
      message: manifestCheck.valid
        ? "package.json contains valid 'pi-package' keywords and 'pi' manifest"
        : `Manifest errors: ${manifestCheck.errors.join("; ")}`,
      details: manifestCheck.errors,
    });
  } catch (err) {
    checks.push({
      name: "Pi Package Manifest",
      passed: false,
      message: `Failed to inspect manifest: ${(err as Error).message}`,
    });
  }

  // 3. Check Pi Locks & Compatibility
  try {
    const piLockPath = path.join(root, "locks", "pi.lock.json");
    const compatPath = path.join(root, "locks", "compatibility.json");
    if (fs.existsSync(piLockPath) && fs.existsSync(compatPath)) {
      const piLock: PiLock = JSON.parse(fs.readFileSync(piLockPath, "utf-8"));
      const compat: CompatibilityMetadata = JSON.parse(fs.readFileSync(compatPath, "utf-8"));
      const lockValid = piLock.version === "0.85.1" && compat.pinnedPiVersion === "0.85.1";
      checks.push({
        name: "Pi Runtime Compatibility Lock",
        passed: lockValid,
        message: lockValid
          ? `Pinned Pi version ${piLock.version} matches compatibility metadata (tested: ${compat.testedPiVersions.join(", ")})`
          : `Pi version mismatch: lock has ${piLock.version}, compat has ${compat.pinnedPiVersion}`,
      });
    } else {
      checks.push({
        name: "Pi Runtime Compatibility Lock",
        passed: false,
        message: "Missing locks/pi.lock.json or locks/compatibility.json",
      });
    }
  } catch (err) {
    checks.push({
      name: "Pi Runtime Compatibility Lock",
      passed: false,
      message: `Error reading compatibility locks: ${(err as Error).message}`,
    });
  }

  // 4. Check Skills Snapshot Integrity
  try {
    const skillsLockPath = path.join(root, "locks", "skills.lock.json");
    if (!fs.existsSync(skillsLockPath)) {
      checks.push({
        name: "Skills Snapshot Integrity",
        passed: false,
        message: "Missing locks/skills.lock.json",
      });
    } else {
      const skillsLock: SkillsLock = JSON.parse(fs.readFileSync(skillsLockPath, "utf-8"));
      let mismatches = 0;
      let totalFiles = 0;

      for (const skillName of skillsLock.includedSkills) {
        const skill = skillsLock.skills[skillName];
        if (!skill) {
          mismatches++;
          continue;
        }
        for (const fileEntry of skill.files) {
          totalFiles++;
          const fullPath = path.join(root, fileEntry.path);
          if (!fs.existsSync(fullPath)) {
            mismatches++;
            continue;
          }
          const content = fs.readFileSync(fullPath);
          const computedHash = crypto.createHash("sha256").update(content).digest("hex");
          if (computedHash !== fileEntry.sha256) {
            mismatches++;
          }
        }
      }

      const passed = mismatches === 0 && totalFiles > 0;
      checks.push({
        name: "Skills Snapshot Integrity",
        passed,
        message: passed
          ? `All ${totalFiles} files in ${skillsLock.includedSkills.length} bundled skills match locks/skills.lock.json SHA256 hashes (source commit: ${skillsLock.sourceCommit.slice(0, 8)})`
          : `Skills integrity check failed: ${mismatches} file mismatch(es)`,
      });
    }
  } catch (err) {
    checks.push({
      name: "Skills Snapshot Integrity",
      passed: false,
      message: `Error validating skills: ${(err as Error).message}`,
    });
  }

  // 5. Check Profiles
  try {
    const resolver = new ProfileResolver(path.join(root, "profiles"));
    const profiles = resolver.listProfiles();
    const requiredProfiles = ["main-agent", "local-coding", "owner-direct", "qq-group", "herdr-worker", "test", "minimal"];
    const missing = requiredProfiles.filter((p) => !profiles.includes(p));

    let allValid = missing.length === 0;
    const validatedProfiles: string[] = [];

    for (const p of profiles) {
      try {
        const profile = resolver.resolveProfile(p);
        for (const name of profile.enabledExtensions) if (!fs.existsSync(path.join(root, "extensions", `${name}.ts`))) throw new Error("Missing profile Extension");
        for (const name of profile.enabledSkills) if (!fs.existsSync(path.join(root, "skills", name, "SKILL.md"))) throw new Error("Missing profile Skill");
        if (!fs.existsSync(path.join(root, "prompts", `${profile.promptTemplate}.md`))) throw new Error("Missing profile prompt");
        validatedProfiles.push(p);
      } catch {
        allValid = false;
      }
    }

    checks.push({
      name: "Runtime Profiles",
      passed: allValid,
      message: allValid
        ? `All ${validatedProfiles.length} profiles validated successfully (${requiredProfiles.join(", ")})`
        : `Missing or invalid profiles: missing=[${missing.join(", ")}]`,
      details: { profiles: validatedProfiles, missing },
    });
  } catch (err) {
    checks.push({
      name: "Runtime Profiles",
      passed: false,
      message: `Error validating profiles: ${(err as Error).message}`,
    });
  }

  // 6. Check MCP Registry
  try {
    const mcpRegistryPath = path.join(root, "mcp", "registry.json");
    if (fs.existsSync(mcpRegistryPath)) {
      const parsed = JSON.parse(fs.readFileSync(mcpRegistryPath, "utf-8"));
      const serverCount = Object.keys(parsed.servers || {}).length;
      checks.push({
        name: "MCP Registry",
        passed: true,
        message: `MCP registry is valid (${serverCount} server definitions: ${Object.keys(parsed.servers || {}).join(", ")})`,
      });
    } else {
      checks.push({
        name: "MCP Registry",
        passed: false,
        message: "Missing mcp/registry.json",
      });
    }
  } catch (err) {
    checks.push({
      name: "MCP Registry",
      passed: false,
      message: `Error reading MCP registry: ${(err as Error).message}`,
    });
  }

  // 7. Deep-validate explicitly requested profiles (--profile)
  for (const profileName of options?.profiles ?? []) {
    checks.push(deepValidateProfile(root, profileName));
  }

  const allPassed = checks.every((c) => c.passed);
  return {
    allPassed,
    checks,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Deep-validate a single profile: resolver schema, name consistency, extension/prompt
 * existence and manifest coverage, skill snapshot consistency, and MCP registry
 * cross-references.
 */
export function deepValidateProfile(root: string, profileName: string): DiagnosticCheck {
  const checkName = `Profile Deep Validation: ${profileName}`;

  let profile: KitProfile;
  try {
    const resolver = new ProfileResolver(path.join(root, "profiles"));
    profile = resolver.resolveProfile(profileName);
    if (profile.name !== profileName) {
      throw new Error(`Profile file '${profileName}.json' declares name '${profile.name}'`);
    }
  } catch (err) {
    return {
      name: checkName,
      passed: false,
      message: `Profile '${profileName}' failed deep validation: ${(err as Error).message}`,
      details: { errors: [(err as Error).message] },
    };
  }

  const errors: string[] = [];

  // Extensions must exist on disk and be covered by the pi package manifest globs.
  const manifestGlobs = readPiExtensionGlobs(root);
  for (const extension of profile.enabledExtensions) {
    const extensionPath = path.join(root, "extensions", `${extension}.ts`);
    if (!fs.existsSync(extensionPath)) {
      errors.push(`Missing extension file: extensions/${extension}.ts`);
    } else if (!matchesAnyGlob(`extensions/${extension}.ts`, manifestGlobs)) {
      errors.push(`Extension '${extension}' is not covered by package.json pi.extensions globs`);
    }
  }

  // Prompt template must exist.
  if (!fs.existsSync(path.join(root, "prompts", `${profile.promptTemplate}.md`))) {
    errors.push(`Missing prompt template: prompts/${profile.promptTemplate}.md`);
  }

  // Skills must exist in the bundled snapshot and in the skills lock.
  const lockedSkills = readSkillsLockIncludedSkills(root);
  for (const skill of profile.enabledSkills) {
    if (!fs.existsSync(path.join(root, "skills", skill, "SKILL.md"))) {
      errors.push(`Missing skill: skills/${skill}/SKILL.md`);
    }
    if (lockedSkills && !lockedSkills.has(skill)) {
      errors.push(`Skill '${skill}' is not included in locks/skills.lock.json`);
    }
  }

  // MCP servers must exist in the registry and list this profile in enabledProfiles.
  if (profile.enabledMcpServers.length > 0) {
    const registryPath = path.join(root, "mcp", "registry.json");
    if (!fs.existsSync(registryPath)) {
      errors.push("Missing mcp/registry.json; cannot verify MCP server references");
    } else {
      const registry: McpRegistry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
      for (const serverName of profile.enabledMcpServers) {
        const server = registry.servers?.[serverName];
        if (!server) {
          errors.push(`MCP server '${serverName}' is not defined in mcp/registry.json`);
        } else if (!server.enabledProfiles?.includes(profileName)) {
          errors.push(`MCP server '${serverName}' does not list profile '${profileName}' in enabledProfiles`);
        }
      }
    }
  }

  const passed = errors.length === 0;
  return {
    name: checkName,
    passed,
    message: passed
      ? `Profile '${profileName}' deep validation passed (${profile.enabledExtensions.length} extensions, ${profile.enabledSkills.length} skills, ${profile.enabledMcpServers.length} MCP servers)`
      : `Profile '${profileName}' deep validation failed: ${errors.length} issue(s)`,
    details: {
      errors,
      extensions: profile.enabledExtensions,
      skills: profile.enabledSkills,
      mcpServers: profile.enabledMcpServers,
    },
  };
}

function readPiExtensionGlobs(root: string): string[] {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
  return Array.isArray(pkg?.pi?.extensions) ? pkg.pi.extensions : [];
}

function readSkillsLockIncludedSkills(root: string): Set<string> | null {
  const lockPath = path.join(root, "locks", "skills.lock.json");
  if (!fs.existsSync(lockPath)) return null;
  const lock: SkillsLock = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
  return new Set(lock.includedSkills);
}

function matchesAnyGlob(posixPath: string, globs: string[]): boolean {
  return globs.some((glob) => globToRegExp(glob).test(posixPath));
}

function globToRegExp(glob: string): RegExp {
  const normalized = glob.replace(/^\.\//, "");
  const source = normalized
    .split("**")
    .map((part) =>
      part
        .split("*")
        .map(escapeRegExp)
        .join("[^/]*")
    )
    .join(".*");
  return new RegExp(`^${source}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse repeatable `--profile <name>` / `--profile=<name>` flags; throws when a flag has no value. */
export function parseDoctorProfileArgs(argv: string[]): string[] {
  const profiles: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--profile") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("--profile requires a profile name");
      profiles.push(value);
      i++;
    } else if (arg.startsWith("--profile=")) {
      const value = arg.slice("--profile=".length);
      if (!value) throw new Error("--profile requires a profile name");
      profiles.push(value);
    }
  }
  return profiles;
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith("doctor.ts")) {
  console.log("Running Lora PI Kit doctor...\n");
  let profiles: string[] = [];
  try {
    profiles = parseDoctorProfileArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Usage: tsx scripts/doctor.ts [--profile <name>]...\n${(err as Error).message}`);
    process.exit(2);
  }
  const result = runDoctor(undefined, { profiles });

  for (const c of result.checks) {
    const badge = c.passed ? "[PASS]" : "[FAIL]";
    console.log(`${badge} ${c.name}: ${c.message}`);
  }

  console.log(`\nResult: ${result.allPassed ? "All checks passed!" : "Doctor found issues."}`);
  process.exit(result.allPassed ? 0 : 1);
}
