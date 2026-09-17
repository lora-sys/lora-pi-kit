import { describe, it, expect, beforeEach } from "vitest";
import policyBridgeExtension, {
  setGlassboxPolicyChecker,
  setGlassboxCallerContext,
  resetGlassboxPolicyBridge,
} from "../extensions/glassbox/policy-bridge.js";

describe("Glassbox Policy Bridge Extension", () => {
  beforeEach(() => {
    resetGlassboxPolicyBridge();
  });

  it("should block dangerous commands when no UI context is present", async () => {
    let toolCallHandler: any = null;
    const fakePi = {
      on: (event: string, handler: any) => {
        if (event === "tool_call") {
          toolCallHandler = handler;
        }
      },
    };

    policyBridgeExtension(fakePi);
    expect(toolCallHandler).toBeDefined();

    // Call with rm -rf and no UI
    const res = await toolCallHandler(
      { toolName: "bash", input: { command: "rm -rf /some/path" } },
      { hasUI: false }
    );
    expect(res).toBeDefined();
    expect(res.block).toBe(true);
    expect(res.reason).toContain("Dangerous bash command blocked");
  });

  it("should enforce authoritative decision from Glassbox policy checker", async () => {
    let toolCallHandler: any = null;
    const fakePi = {
      on: (event: string, handler: any) => {
        if (event === "tool_call") {
          toolCallHandler = handler;
        }
      },
    };

    policyBridgeExtension(fakePi);

    // Register a checker that denies tool 'secret_tool'
    setGlassboxPolicyChecker((req) => {
      if (req.toolName === "secret_tool") {
        return { allow: false, reason: "Unauthorized resource access" };
      }
      return { allow: true };
    });

    const denied = await toolCallHandler({ toolName: "secret_tool", input: {} }, { hasUI: true });
    expect(denied).toBeDefined();
    expect(denied.block).toBe(true);
    expect(denied.reason).toBe("Unauthorized resource access");

    const allowed = await toolCallHandler({ toolName: "safe_tool", input: {} }, { hasUI: true });
    expect(allowed).toBeUndefined();
  });
});
