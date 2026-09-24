import { describe, expect, it } from "vitest";
import { createDockerSandboxExecutor } from "../src/sandbox/index.js";
import { assertBoundedJson, SANDBOX_MAX_MESSAGE_BYTES } from "../src/sandbox/protocol.js";
import {
  SANDBOX_IMAGE_LABEL, SANDBOX_LAUNCH_LABEL, SANDBOX_OWNER_LABEL, SANDBOX_SESSION_LABEL,
  sandboxContainerIdentity, stopOwnedContainer,
} from "../src/sandbox/container-stop.js";

const image = `sha256:${"a".repeat(64)}`;
const identity = sandboxContainerIdentity("owner_run");
const owned = { name: identity.name, sessionHash: identity.hash, image, launchToken: "launch_1" };
const containerId = "b".repeat(64);
const labels = {
  [SANDBOX_OWNER_LABEL]: "1", [SANDBOX_SESSION_LABEL]: identity.hash,
  [SANDBOX_IMAGE_LABEL]: image, [SANDBOX_LAUNCH_LABEL]: "launch_1",
};
const inspected = { stdout: `${containerId}|${JSON.stringify(labels)}` };

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
    await expect(stopOwnedContainer(owned, async (args) => {
      calls.push(args);
      if (args[0] === "rm") throw new Error("daemon unavailable");
      return inspected;
    })).rejects.toThrow(/still exists/);
    expect(calls.map((args) => args[0])).toEqual(["container", "rm", "container"]);
    expect(calls[1]?.[2]).toBe(containerId);
  });

  it("confirms close only when Docker reports that the owned container is absent", async () => {
    await expect(stopOwnedContainer(owned, async () => {
      throw Object.assign(new Error("not found"), { stderr: "No such container: owned" });
    })).resolves.toBeUndefined();
  });

  it("accepts rm failure only after inspecting the original container ID as absent", async () => {
    const calls: string[][] = [];
    await expect(stopOwnedContainer(owned, async (args) => {
      calls.push(args);
      if (args[0] === "rm") throw new Error("remove returned an error");
      if (args[2] === containerId) throw Object.assign(new Error("gone"), { stderr: `No such container: ${containerId}` });
      return inspected;
    })).resolves.toBeUndefined();
    expect(calls.map((args) => args[0])).toEqual(["container", "rm", "container"]);
  });

  it("maps a trusted session ID to one container name", () => {
    expect(sandboxContainerIdentity("owner_run")).toEqual(identity);
    expect(sandboxContainerIdentity("other_run").name).not.toBe(identity.name);
    expect(() => sandboxContainerIdentity("../wrong")).toThrow(/session ID/);
  });

  it("never stops a same-name container with mismatched ownership labels", async () => {
    const calls: string[][] = [];
    await expect(stopOwnedContainer(owned, async (args) => {
      calls.push(args);
      return { stdout: `${containerId}|${JSON.stringify({ ...labels, [SANDBOX_LAUNCH_LABEL]: "different" })}` };
    })).rejects.toThrow(/ownership mismatch/);
    expect(calls).toHaveLength(1);
  });

  it("treats Docker inspection failure as uncertain", async () => {
    await expect(stopOwnedContainer(owned, async () => { throw new Error("daemon unavailable"); })).rejects.toThrow(/could not be verified/);
  });
});
