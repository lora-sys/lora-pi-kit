export interface TasteItem {
  id: string;
  scope: "global" | "project" | "channel";
  category: string;
  statement: string;
  confidence: number;
}

let activeTasteProjection: TasteItem[] = [];

export function setActiveTasteProjection(items: TasteItem[]): void {
  activeTasteProjection = [...items];
}

export function clearActiveTasteProjection(): void {
  activeTasteProjection = [];
}

export default function (pi: any) {
  pi.on("before_agent_start", async (event: any) => {
    if (activeTasteProjection.length === 0) {
      return;
    }

    const tasteGuidelines = activeTasteProjection
      .map((item) => `- [${item.category}] ${item.statement} (confidence: ${(item.confidence * 100).toFixed(0)}%)`)
      .join("\n");

    const section = [
      "\n### User Taste & Preferences (Advisory Only)",
      "The following preferences reflect learned user taste. They are advisory guidelines and must never override authorization, security rules, or explicit user prompts:",
      tasteGuidelines,
    ].join("\n");

    if (event && event.systemPromptOptions) {
      event.systemPromptOptions.customInstructions = (event.systemPromptOptions.customInstructions ?? "") + "\n" + section;
    }
  });
}
