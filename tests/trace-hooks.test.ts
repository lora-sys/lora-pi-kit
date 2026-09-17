import { describe, it, expect, beforeEach } from "vitest";
import traceHooksExtension, {
  addTraceListener,
  getRecordedTraces,
  clearRecordedTraces,
} from "../extensions/glassbox/trace-hooks.js";
import type { TraceEvent } from "../src/types.js";

describe("Glassbox Trace Hooks Extension", () => {
  beforeEach(() => {
    clearRecordedTraces();
  });

  it("should record append-only trace events across execution lifecycle", async () => {
    const handlers: Record<string, any> = {};
    const fakePi = {
      on: (event: string, handler: any) => {
        handlers[event] = handler;
      },
    };

    traceHooksExtension(fakePi);

    const captured: TraceEvent[] = [];
    const unsubscribe = addTraceListener((ev) => captured.push(ev));

    // Simulate lifecycle events
    await handlers["agent_start"]?.({ agentId: "personal-agent", sessionId: "sess-1" });
    await handlers["turn_start"]?.({ turnNumber: 1 });
    await handlers["tool_execution_start"]?.({ toolName: "read", input: { path: "foo.txt" } });
    await handlers["tool_execution_end"]?.({ toolName: "read", isError: false, result: "content" });
    await handlers["turn_end"]?.({ turnNumber: 1 });
    await handlers["agent_end"]?.({ status: "completed" });

    expect(captured.length).toBe(6);
    expect(captured[0].type).toBe("agent_start");
    expect(captured[1].type).toBe("turn_start");
    expect(captured[2].type).toBe("tool_call");
    expect(captured[3].type).toBe("tool_result");
    expect(captured[4].type).toBe("turn_end");
    expect(captured[5].type).toBe("agent_end");

    const traces = getRecordedTraces();
    expect(traces.length).toBe(6);

    unsubscribe();
  });
});
