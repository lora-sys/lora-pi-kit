import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { ManifestInspector } from "../src/manifest.js";

describe("Pi Package Manifest Compliance", () => {
  const root = path.resolve(__dirname, "..");
  const inspector = new ManifestInspector(root);

  it("should have valid package.json with pi-package keywords and pi configuration", () => {
    const res = inspector.validateManifest();
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
  });

  it("should contain extensions, skills, and prompts directories", () => {
    expect(fs.existsSync(path.join(root, "extensions"))).toBe(true);
    expect(fs.existsSync(path.join(root, "skills"))).toBe(true);
    expect(fs.existsSync(path.join(root, "prompts"))).toBe(true);
  });
});
