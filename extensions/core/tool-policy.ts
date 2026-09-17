let allowedToolNames: Set<string> | null = null;

export function setActiveToolFilter(tools: string[] | null): void {
  allowedToolNames = tools ? new Set(tools) : null;
}

export function resetActiveToolFilter(): void {
  allowedToolNames = null;
}

export default function (pi: any) {
  pi.on("tool_call", async (event: any) => {
    if (allowedToolNames !== null && !allowedToolNames.has(event.toolName)) {
      return {
        block: true,
        reason: `Tool '${event.toolName}' is disabled by the active profile tool policy`,
      };
    }
    return undefined;
  });
}
