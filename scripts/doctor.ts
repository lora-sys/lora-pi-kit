import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { ProfileResolver } from "../src/profiles/resolver.js";
import { ManifestInspector } from "../src/manifest.js";
import type { SkillsLock, PiLock, CompatibilityMetadata } from "../src/types.js";

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

export function runDoctor(rootDir?: string): DoctorResult {
  const root = rootDir ?? path.resolve(process.cwd());
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
    const requiredProfiles = ["main-agent", "local-coding", "owner-direct", "qq-group", "herdr-worker", "test"];
    const missing = requiredProfiles.filter((p) => !profiles.includes(p));

    let allValid = missing.length === 0;
    const validatedProfiles: string[] = [];

    for (const p of profiles) {
      try {
        resolver.resolveProfile(p);
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

  const allPassed = checks.every((c) => c.passed);
  return {
    allPassed,
    checks,
    timestamp: new Date().toISOString(),
  };
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith("doctor.ts")) {
  console.log("Running Lora PI Kit doctor...\n");
  const result = runDoctor();

  for (const c of result.checks) {
    const badge = c.passed ? "[PASS]" : "[FAIL]";
    console.log(`${badge} ${c.name}: ${c.message}`);
  }

  console.log(`\nResult: ${result.allPassed ? "All checks passed!" : "Doctor found issues."}`);
  process.exit(result.allPassed ? 0 : 1);
}
