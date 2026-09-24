import { createHash } from "node:crypto";
import { validId } from "./protocol.js";

export const SANDBOX_OWNER_LABEL = "io.lora.pi-kit.sandbox";
export const SANDBOX_SESSION_LABEL = "io.lora.pi-kit.session-hash";
export const SANDBOX_IMAGE_LABEL = "io.lora.pi-kit.image";
export const SANDBOX_LAUNCH_LABEL = "io.lora.pi-kit.launch-token";

export function sandboxContainerIdentity(sessionId: string): { name: string; hash: string } {
  if (!validId(sessionId)) throw new Error("Invalid sandbox session ID");
  const hash = createHash("sha256").update(sessionId, "utf8").digest("hex");
  return { name: `lora-kit-${hash}`, hash };
}

export interface OwnedContainer {
  name: string;
  sessionHash: string;
  image?: string;
  launchToken?: string;
}

function notFound(error: unknown): boolean {
  const stderr = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string" ? error.stderr : "";
  return /No such (object|container)/i.test(stderr);
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
