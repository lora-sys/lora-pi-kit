import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import { ProfileResolver } from "../src/profiles/resolver.js";

describe("Runtime Isolation Smoke Test", () => {
  const resolver = new ProfileResolver(path.resolve(__dirname, "../profiles"));

  it("should never use ~/.pi for Glassbox profiles by default", () => {
    const mainProfile = resolver.resolveProfile("main-agent");
    const testProfile = resolver.resolveProfile("test");
    const workerProfile = resolver.resolveProfile("herdr-worker");

    const baseDir = path.join(os.tmpdir(), "glassbox-test-runtime");
    const mainDir = resolver.resolveAgentDir(mainProfile, baseDir);
    const testDir = resolver.resolveAgentDir(testProfile, baseDir);
    const workerDir = resolver.resolveAgentDir(workerProfile, baseDir);

    expect(mainDir).toContain(path.join("pi", "main"));
    expect(testDir).toContain(path.join("pi", "test"));
    expect(workerDir).toContain(path.join("pi", "workers"));

    expect(mainDir).not.toContain(path.join(".pi", "agent"));
    expect(testDir).not.toContain(path.join(".pi", "agent"));
    expect(workerDir).not.toContain(path.join(".pi", "agent"));
  });
});
