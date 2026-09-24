import { describe, expect, it } from "vitest";
import { createDockerSandboxExecutor } from "../src/sandbox/index.js";
import { assertBoundedJson, SANDBOX_MAX_MESSAGE_BYTES } from "../src/sandbox/protocol.js";
import { stopOwnedContainer } from "../src/sandbox/container-stop.js";

const image = `sha256:${"a".repeat(64)}`;

describe("Docker sandbox boundary", () => {
  it("rejects floating images and root execution", () => {
    expect(() => createDockerSandboxExecutor({ image: "lora-sandbox:latest" })).toThrow(/sha256/);
    expect(() => createDockerSandboxExecutor({ image, runAsUid: 0 })).toThrow(/nonroot/);
  });

  it("rejects unsupported network policies before starting Docker", async () => {
    const executor = createDockerSandboxExecutor({ image });
    await expect(executor.openSession({
      sessionId: "owner_run", workspacePath: ".", writable: true,
      policyVersion: "v1", network: "bridge" as "none",
    })).rejects.toThrow(/network policy/);
  });

  it("bounds structured protocol messages", () => {
    expect(assertBoundedJson({ v: 1, type: "close" })).toContain('"v":1');
    expect(() => assertBoundedJson({ value: "x".repeat(SANDBOX_MAX_MESSAGE_BYTES) })).toThrow(/limit/);
  });

  it("does not confirm close when Docker removal fails and the container remains", async () => {
    const calls: string[][] = [];
    await expect(stopOwnedContainer("owned", async (args) => {
      calls.push(args);
      if (args[0] === "rm") throw new Error("daemon unavailable");
      return { stdout: "running" };
    })).rejects.toThrow(/still exists/);
    expect(calls.map((args) => args[0])).toEqual(["rm", "container"]);
  });

  it("confirms close only when Docker reports that the owned container is absent", async () => {
    await expect(stopOwnedContainer("owned", async (args) => {
      if (args[0] === "rm") throw new Error("already gone");
      throw Object.assign(new Error("not found"), { stderr: "No such container: owned" });
    })).resolves.toBeUndefined();
  });
});
