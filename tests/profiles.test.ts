import { describe, it, expect } from "vitest";
import path from "node:path";
import { ProfileResolver } from "../src/profiles/resolver.js";

describe("Kit Profile Resolver", () => {
  const resolver = new ProfileResolver(path.resolve(__dirname, "../profiles"));

  it("should list all 6 required profiles", () => {
    const profiles = resolver.listProfiles();
    expect(profiles).toContain("main-agent");
    expect(profiles).toContain("local-coding");
    expect(profiles).toContain("owner-direct");
    expect(profiles).toContain("qq-group");
    expect(profiles).toContain("herdr-worker");
    expect(profiles).toContain("test");
  });

  it("should resolve and validate main-agent profile", () => {
    const p = resolver.resolveProfile("main-agent");
    expect(p.name).toBe("main-agent");
    expect(p.promptTemplate).toBe("base");
    expect(p.thinkingLevel).toBe("high");
    expect(p.enabledExtensions).toContain("glassbox/policy-bridge");
    expect(p.enabledExtensions).toContain("glassbox/trace-hooks");
  });

  it("should enforce narrow safe tool surface on qq-group profile", () => {
    const p = resolver.resolveProfile("qq-group");
    expect(p.activeTools).toEqual(["read"]);
    expect(p.activeTools).not.toContain("bash");
    expect(p.activeTools).not.toContain("edit");
    expect(p.activeTools).not.toContain("write");
  });

  it("should enforce disposable/isolated agentDir on test profile", () => {
    const p = resolver.resolveProfile("test");
    expect(p.runtimeIsolation?.isolateSessionState).toBe(true);
    expect(p.runtimeIsolation?.disposable).toBe(true);

    const agentDir = resolver.resolveAgentDir(p, "/fake/isolated/root");
    expect(agentDir).toContain(path.join("pi", "test"));
    expect(agentDir).not.toContain(".pi");
  });
});
