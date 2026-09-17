export default function (pi: any) {
  pi.on("before_agent_start", async (event: any) => {
    if (event?.systemPromptOptions) {
      const banner = "Environment: Lora PI Kit (Pi 0.85.1 compatible)";
      event.systemPromptOptions.customInstructions =
        (event.systemPromptOptions.customInstructions ? event.systemPromptOptions.customInstructions + "\n" : "") + banner;
    }
  });
}
