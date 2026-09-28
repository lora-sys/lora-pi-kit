export const SANDBOX_PROTOCOL_VERSION = 1;
export const SANDBOX_MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
export const SANDBOX_TOOL_NAMES = ["read", "grep", "find", "ls", "write", "edit", "bash", "powershell"] as const;
export type PiToolName = (typeof SANDBOX_TOOL_NAMES)[number];

export interface NativeToolResult {
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
  details?: unknown;
  isError?: boolean;
}

export interface SandboxToolDefinition {
  name: PiToolName;
  description: string;
  parameters: unknown;
  available: boolean;
}

export type SandboxRequest =
  | { v: 1; type: "execute"; id: string; name: PiToolName; params: unknown }
  | { v: 1; type: "cli"; id: string; executable: "agent-browser"; args: string[] }
  | { v: 1; type: "cancel"; id: string }
  | { v: 1; type: "close" };

export type SandboxResponse =
  | { v: 1; type: "ready"; definitions: SandboxToolDefinition[] }
  | { v: 1; type: "update"; id: string; result: NativeToolResult }
  | { v: 1; type: "result"; id: string; result: NativeToolResult }
  | { v: 1; type: "error"; id?: string; message: string };

export function assertBoundedJson(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > SANDBOX_MAX_MESSAGE_BYTES) {
    throw new Error("Sandbox protocol message exceeds limit");
  }
  return serialized;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function validId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value);
}
