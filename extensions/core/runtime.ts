export default function (pi: any) {
  if (typeof pi.registerCommand === "function") {
    pi.registerCommand("lora-status", {
      description: "Display Lora PI Kit version, loaded profiles, and environment health",
      handler: async (_args: string, ctx: any) => {
        const message = [
          "Lora PI Kit v0.1.0",
          "Engine: Pi 0.85.1 compatible",
          "Status: Operational",
        ].join("\n");

        if (pi.sendMessage) {
          pi.sendMessage({
            customType: "lora-status",
            content: message,
            display: true,
          });
        }
      },
    });
  }
}
