import type { TraceEvent, TraceListener } from "../../src/types.js";

const listeners: Set<TraceListener> = new Set();
const traceBuffer: TraceEvent[] = [];

export function addTraceListener(listener: TraceListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecordedTraces(): TraceEvent[] {
  return [...traceBuffer];
}

export function clearRecordedTraces(): void {
  traceBuffer.length = 0;
}

function emitTrace(type: TraceEvent["type"], payload: Record<string, unknown>): void {
  const event: TraceEvent = {
    id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type,
    payload,
  };
  traceBuffer.push(event);
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Trace listeners must not crash the agent loop
    }
  }
}

export default function (pi: any) {
  pi.on("agent_start", async (event: any) => {
    emitTrace("agent_start", {
      sessionId: event?.sessionId,
      agentId: event?.agentId,
    });
  });

  pi.on("agent_end", async (event: any) => {
    emitTrace("agent_end", {
      status: event?.status ?? "completed",
    });
  });

  pi.on("turn_start", async (event: any) => {
    emitTrace("turn_start", {
      turnNumber: event?.turnNumber,
    });
  });

  pi.on("turn_end", async (event: any) => {
    emitTrace("turn_end", {
      turnNumber: event?.turnNumber,
    });
  });

  pi.on("tool_execution_start", async (event: any) => {
    emitTrace("tool_call", {
      toolName: event?.toolName,
      input: event?.input,
    });
  });

  pi.on("tool_execution_end", async (event: any) => {
    emitTrace("tool_result", {
      toolName: event?.toolName,
      isError: event?.isError ?? false,
      result: typeof event?.result === "string" ? event.result.slice(0, 500) : event?.result,
    });
  });
}
