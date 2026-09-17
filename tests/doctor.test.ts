import { describe, it, expect } from "vitest";
import path from "node:path";
import { runDoctor } from "../scripts/doctor.js";

describe("Kit Doctor Diagnostic Suite", () => {
  const root = path.resolve(__dirname, "..");

  it("should pass all doctor diagnostic checks", () => {
    const result = runDoctor(root);
    expect(result.allPassed).toBe(true);

    const checkNames = result.checks.map((c) => c.name);
    expect(checkNames).toContain("Node.js Version");
    expect(checkNames).toContain("Pi Package Manifest");
    expect(checkNames).toContain("Pi Runtime Compatibility Lock");
    expect(checkNames).toContain("Skills Snapshot Integrity");
    expect(checkNames).toContain("Runtime Profiles");
    expect(checkNames).toContain("MCP Registry");

    for (const check of result.checks) {
      expect(check.passed).toBe(true);
    }
  });
});
