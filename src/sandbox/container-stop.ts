import { createHash } from "node:crypto";
import { validId } from "./protocol.js";

export const SANDBOX_OWNER_LABEL = "io.lora.pi-kit.sandbox";
export const SANDBOX_SESSION_LABEL = "io.lora.pi-kit.session-hash";
export const SANDBOX_IMAGE_LABEL = "io.lora.pi-kit.image";
export const SANDBOX_LAUNCH_LABEL = "io.lora.pi-kit.launch-token";
export const SANDBOX_NETWORK_LABEL = "io.lora.pi-kit.sandbox-network";

export function sandboxContainerIdentity(sessionId: string): { name: string; hash: string } {
  if (!validId(sessionId)) throw new Error("Invalid sandbox session ID");
  const hash = createHash("sha256").update(sessionId, "utf8").digest("hex");
  return { name: `lora-kit-${hash}`, hash };
}

export function sandboxNetworkIdentity(sessionId: string): { name: string; hash: string } {
  const identity = sandboxContainerIdentity(sessionId);
  return { name: `${identity.name}-net`, hash: identity.hash };
}

export interface OwnedContainer {
  name: string;
  sessionHash: string;
  image?: string;
  launchToken?: string;
}

function notFound(error: unknown): boolean {
  const stderr = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string" ? error.stderr : "";
  return /(?:No such (?:object|container|network)|(?:container|network) .+ not found)/i.test(stderr);
}

async function inspect(
  reference: string,
  run: (args: string[]) => Promise<{ stdout: string }>,
): Promise<{ id: string; labels: Record<string, string> } | null> {
  let output: string;
  try {
    const inspected = await run(["container", "inspect", reference, "--format", "{{.Id}}|{{json .Config.Labels}}"]);
    output = inspected.stdout.trim();
  } catch (error) {
    if (notFound(error)) return null;
    throw new Error(`Sandbox container inspection could not be verified: ${String(error)}`);
  }
  const separator = output.indexOf("|");
  const id = output.slice(0, separator);
  if (separator < 0 || !/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid Docker container identity");
  const labels: unknown = JSON.parse(output.slice(separator + 1));
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) throw new Error("Invalid Docker container labels");
  return { id, labels: labels as Record<string, string> };
}

/** A missing container is a positively verified stopped state. A Docker error is not. */
export async function stopOwnedContainer(
  expected: OwnedContainer,
  run: (args: string[]) => Promise<{ stdout: string }>,
): Promise<void> {
  const current = await inspect(expected.name, run);
  if (!current) return;
  const labels = current.labels;
  if (labels[SANDBOX_OWNER_LABEL] !== "1" ||
      labels[SANDBOX_SESSION_LABEL] !== expected.sessionHash ||
      (expected.image && labels[SANDBOX_IMAGE_LABEL] !== expected.image) ||
      (expected.launchToken && labels[SANDBOX_LAUNCH_LABEL] !== expected.launchToken)) {
    throw new Error("Sandbox container ownership mismatch");
  }
  await run(["rm", "--force", current.id]).catch(() => undefined);
  if (await inspect(current.id, run)) throw new Error("Sandbox container still exists after close");
}

export interface OwnedNetwork {
  name: string;
  sessionHash: string;
  launchToken?: string;
}

async function inspectNetwork(
  reference: string,
  run: (args: string[]) => Promise<{ stdout: string }>,
): Promise<{ id: string; labels: Record<string, string> } | null> {
  let output: string;
  try {
    output = (await run(["network", "inspect", reference, "--format", "{{.Id}}|{{json .Labels}}"])).stdout.trim();
  } catch (error) {
    if (notFound(error)) return null;
    throw new Error(`Sandbox network inspection could not be verified: ${String(error)}`);
  }
  const separator = output.indexOf("|");
  const id = output.slice(0, separator);
  if (separator < 0 || !/^[a-f0-9]{64}$/u.test(id)) throw new Error("Invalid Docker network identity");
  const labels: unknown = JSON.parse(output.slice(separator + 1));
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) throw new Error("Invalid Docker network labels");
  return { id, labels: labels as Record<string, string> };
}

/** Removes only the network created for this session and confirms Docker removed it. */
export async function removeOwnedNetwork(
  expected: OwnedNetwork,
  run: (args: string[]) => Promise<{ stdout: string }>,
): Promise<void> {
  const current = await inspectNetwork(expected.name, run);
  if (!current) return;
  const labels = current.labels;
  if (labels[SANDBOX_OWNER_LABEL] !== "1" ||
      labels[SANDBOX_SESSION_LABEL] !== expected.sessionHash ||
      (expected.launchToken && labels[SANDBOX_LAUNCH_LABEL] !== expected.launchToken) ||
      labels[SANDBOX_NETWORK_LABEL] !== "internal-egress") {
    throw new Error("Sandbox network ownership mismatch");
  }
  await run(["network", "rm", current.id]).catch(() => undefined);
  if (await inspectNetwork(current.id, run)) throw new Error("Sandbox network still exists after close");
}
