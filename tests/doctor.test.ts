import { describe, it, expect } from "vitest";
import path from "node:path";
import { runDoctor, parseDoctorProfileArgs } from "../scripts/doctor.js";

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

describe("Doctor --profile Deep Validation", () => {
  const root = path.resolve(__dirname, "..");

  it("deep-validates the minimal profile", () => {
    const result = runDoctor(root, { profiles: ["minimal"] });
    const check = result.checks.find((c) => c.name === "Profile Deep Validation: minimal");
    expect(check).toBeDefined();
    expect(check?.passed).toBe(true);
    expect(result.allPassed).toBe(true);
  });

  it("fails deep validation for an unknown profile", () => {
    const result = runDoctor(root, { profiles: ["no-such-profile"] });
    const check = result.checks.find((c) => c.name === "Profile Deep Validation: no-such-profile");
    expect(check?.passed).toBe(false);
    expect(result.allPassed).toBe(false);
  });

  it("parses repeatable --profile flags", () => {
    expect(parseDoctorProfileArgs(["--profile", "minimal", "--profile=test"])).toEqual(["minimal", "test"]);
    expect(() => parseDoctorProfileArgs(["--profile"])).toThrow();
  });
});
