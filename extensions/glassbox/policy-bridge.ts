import type { PolicyChecker, PolicyCheckRequest, PolicyCheckResult } from "../../src/types.js";

/**
 * Dangerous commands pattern list blocked by default unless authorized
 */
const DANGEROUS_COMMANDS = [
  /\brm\s+(-rf?|--recursive)/i,
  /\bsudo\b/i,
  /\b(chmod|chown)\b.*777/i,
  /\bmkfs\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
];

/**
 * Pi Extension entry point
 */
export function createGlassboxPolicyBridge(
  checker?: PolicyChecker,
  getContext: () => PolicyCheckRequest["context"] = () => ({}),
) {
  return function (pi: any) {
  pi.on("tool_call", async (event: any, ctx: any) => {
    const toolName = event.toolName;
    const input = (event.input ?? {}) as Record<string, unknown>;

    // 1. If bash execution, guard dangerous commands
    if (toolName === "bash") {
      const command = (input.command as string) ?? "";
      const isDangerous = DANGEROUS_COMMANDS.some((pattern) => pattern.test(command));
      if (isDangerous) {
        // If interactive UI is available, delegate to confirmation; otherwise block
        if (!ctx?.hasUI) {
          return {
            block: true,
            reason: "Glassbox Policy: Dangerous bash command blocked in non-interactive mode",
          };
        }
      }
    }

    // 2. If Glassbox policy checker is registered, run authoritative authorization gate
    if (checker) {
      const decision = await checker({
        toolName,
        input,
        context: getContext(),
      });

      if (!decision.allow) {
        return {
          block: true,
          reason: decision.reason ?? `Glassbox Policy Denied: tool '${toolName}' is not authorized for current principal`,
        };
      }
    }

    return undefined;
  });
  };
}

// Standalone guardrails are not Glassbox permissions. Product hosts pass their
// per-session checker or register product-authorized Tools directly.
export default createGlassboxPolicyBridge();
