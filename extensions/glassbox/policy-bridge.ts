import type { PolicyChecker, PolicyCheckRequest, PolicyCheckResult } from "../../src/types.js";

// Global policy registry for Glassbox runtime bridge
let activePolicyChecker: PolicyChecker | null = null;
let activeCallerContext: PolicyCheckRequest["context"] = {};

export function setGlassboxPolicyChecker(checker: PolicyChecker | null): void {
  activePolicyChecker = checker;
}

export function setGlassboxCallerContext(context: PolicyCheckRequest["context"]): void {
  activeCallerContext = context;
}

export function resetGlassboxPolicyBridge(): void {
  activePolicyChecker = null;
  activeCallerContext = {};
}

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
export default function (pi: any) {
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
            reason: `Glassbox Policy: Dangerous bash command blocked in non-interactive mode: ${command.slice(0, 50)}`,
          };
        }
      }
    }

    // 2. If Glassbox policy checker is registered, run authoritative authorization gate
    if (activePolicyChecker) {
      const decision = await activePolicyChecker({
        toolName,
        input,
        context: activeCallerContext,
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
}
