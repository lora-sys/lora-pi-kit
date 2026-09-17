import fs from "node:fs";
import path from "node:path";

export interface PiManifestSection {
  extensions?: string[];
  skills?: string[];
  prompts?: string[];
  themes?: string[];
}

export interface KitPackageJson {
  name: string;
  version: string;
  keywords?: string[];
  pi?: PiManifestSection;
}

export class ManifestInspector {
  private rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir ?? process.cwd();
  }

  public readPackageJson(): KitPackageJson {
    const pkgPath = path.join(this.rootDir, "package.json");
    if (!fs.existsSync(pkgPath)) {
      throw new Error(`package.json not found at ${pkgPath}`);
    }
    return JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  }

  public validateManifest(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const pkg = this.readPackageJson();

    if (!pkg.keywords || !pkg.keywords.includes("pi-package")) {
      errors.push("Missing 'pi-package' in package.json keywords");
    }

    if (!pkg.pi) {
      errors.push("Missing 'pi' section in package.json");
    } else {
      if (!pkg.pi.extensions || !Array.isArray(pkg.pi.extensions)) {
        errors.push("Manifest missing 'extensions' list");
      }
      if (!pkg.pi.skills || !Array.isArray(pkg.pi.skills)) {
        errors.push("Manifest missing 'skills' list");
      }
      if (!pkg.pi.prompts || !Array.isArray(pkg.pi.prompts)) {
        errors.push("Manifest missing 'prompts' list");
      }
    }

    // Check directory presence
    const extensionsDir = path.join(this.rootDir, "extensions");
    const skillsDir = path.join(this.rootDir, "skills");
    const promptsDir = path.join(this.rootDir, "prompts");

    if (!fs.existsSync(extensionsDir)) {
      errors.push(`Extensions directory missing at ${extensionsDir}`);
    }
    if (!fs.existsSync(skillsDir)) {
      errors.push(`Skills directory missing at ${skillsDir}`);
    }
    if (!fs.existsSync(promptsDir)) {
      errors.push(`Prompts directory missing at ${promptsDir}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
