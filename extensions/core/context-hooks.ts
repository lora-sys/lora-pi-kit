export default function (pi: any) {
  pi.on("before_agent_start", async (event: any) => {
    if (typeof event.systemPrompt === "string") return { systemPrompt: event.systemPrompt + "\nEnvironment: Lora PI Kit, Pi 0.85.1 compatible." };
  });
}
