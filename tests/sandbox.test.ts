import { describe, expect, it } from "vitest";
import { request as httpRequest } from "node:http";
import { createEgressProxy, isPublicAddress, parseCloudflareDnsJson } from "../src/sandbox/egress-proxy.js";
import { createDockerSandboxExecutor } from "../src/sandbox/index.js";
import { assertBoundedJson, SANDBOX_MAX_MESSAGE_BYTES } from "../src/sandbox/protocol.js";
import {
  SANDBOX_IMAGE_LABEL, SANDBOX_LAUNCH_LABEL, SANDBOX_NETWORK_LABEL, SANDBOX_OWNER_LABEL, SANDBOX_SESSION_LABEL,
  removeOwnedNetwork, sandboxContainerIdentity, stopOwnedContainer,
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

describe("controlled public web egress", () => {
  it("allows globally routed addresses and rejects private, local, and special ranges", () => {
    expect(isPublicAddress("1.1.1.1")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
    for (const address of ["10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.0.1", "224.0.0.1", "::1", "fc00::1", "fe80::1", "64:ff9b::a9fe:a9fe", "64:ff9b:1::1", "2001:2::1", "2001:20::1", "2001:db8::1", "::ffff:127.0.0.1"]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it("validates every Cloudflare DoH A and AAAA answer before use", () => {
    expect(parseCloudflareDnsJson(JSON.stringify({ Status: 0, Answer: [{ type: 1, data: "1.1.1.1" }] }), "A"))
      .toEqual([{ address: "1.1.1.1", family: 4 }]);
    expect(parseCloudflareDnsJson(JSON.stringify({ Status: 0, Answer: [] }), "AAAA")).toEqual([]);
    expect(() => parseCloudflareDnsJson(JSON.stringify({ Status: 0, Answer: [
      { type: 28, data: "2606:4700:4700::1111" }, { type: 28, data: "fd00::1" },
    ] }), "AAAA")).toThrow(/non-public/);
    expect(() => parseCloudflareDnsJson(JSON.stringify({ Status: 0, Answer: [
      { type: 1, data: "1.1.1.1" }, { type: 28, data: "fd00::1" },
    ] }), "A")).toThrow(/non-public/);
    expect(() => parseCloudflareDnsJson(JSON.stringify({ Status: 2 }), "A")).toThrow(/status/);
  });

  it("defaults DNS resolution to system mode and rejects unknown DNS modes", () => {
    expect(() => createDockerSandboxExecutor({ image, dnsMode: "anything" as "system" })).toThrow(/DNS mode/);
    expect(() => createEgressProxy("anything" as "system")).toThrow(/DNS mode/);
  });

  it("rejects private absolute HTTP targets before opening an upstream connection", async () => {
    const proxy = createEgressProxy();
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
    const address = proxy.address();
    if (!address || typeof address === "string") throw new Error("Proxy did not bind a TCP port");
    try {
      const status = await new Promise<number>((resolve, reject) => {
        const request = httpRequest({
          host: "127.0.0.1", port: address.port,
          path: "http://169.254.169.254/latest/meta-data/", method: "GET",
        }, (response) => { response.resume(); response.once("end", () => resolve(response.statusCode ?? 0)); });
        request.once("error", reject);
        request.end();
      });
      expect(status).toBe(403);
    } finally { await new Promise<void>((resolve) => proxy.close(() => resolve())); }
  });

  it("removes only an owned session network and verifies the final absence", async () => {
    const networkId = "c".repeat(64);
    const labels = {
      [SANDBOX_OWNER_LABEL]: "1",
      [SANDBOX_SESSION_LABEL]: identity.hash,
      [SANDBOX_LAUNCH_LABEL]: "launch_1",
      [SANDBOX_NETWORK_LABEL]: "internal-egress",
    };
    const calls: string[][] = [];
    await removeOwnedNetwork({ name: "owned-network", sessionHash: identity.hash, launchToken: "launch_1" }, async (args) => {
      calls.push(args);
      if (args[0] === "network" && args[1] === "inspect") {
        if (args[2] === networkId) throw Object.assign(new Error("gone"), { stderr: `No such network: ${networkId}` });
        return { stdout: `${networkId}|${JSON.stringify(labels)}` };
      }
      return { stdout: networkId };
    });
    expect(calls.map((args) => args.slice(0, 2))).toEqual([["network", "inspect"], ["network", "rm"], ["network", "inspect"]]);
  });
});
