export interface FeedbackSignal {
  type: "explicit_thumbs_up" | "explicit_thumbs_down" | "correction" | "acceptance";
  context: Record<string, unknown>;
  timestamp: string;
}

type FeedbackListener = (signal: FeedbackSignal) => void;
const feedbackListeners: Set<FeedbackListener> = new Set();

export function addFeedbackListener(listener: FeedbackListener): () => void {
  feedbackListeners.add(listener);
  return () => feedbackListeners.delete(listener);
}

export function emitFeedbackSignal(type: FeedbackSignal["type"], context: Record<string, unknown>): void {
  const signal: FeedbackSignal = {
    type,
    context,
    timestamp: new Date().toISOString(),
  };
  for (const listener of feedbackListeners) {
    try {
      listener(signal);
    } catch {
      // safe
    }
  }
}

export default function (pi: any) {
  // Can observe tool outcomes or command signals to infer feedback
  pi.on("tool_result", async (event: any) => {
    if (event?.toolName === "record_feedback" && event?.result) {
      emitFeedbackSignal("explicit_thumbs_up", { result: event.result });
    }
  });
}
