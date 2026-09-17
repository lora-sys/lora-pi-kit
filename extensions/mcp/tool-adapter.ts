import { McpServerManager } from "./registry.js";
import { StdioMcpClient } from "./client.js";

let defaultManager = new McpServerManager();

export function setCustomMcpManager(manager: McpServerManager): void {
  defaultManager = manager;
}

export function getCustomMcpManager(): McpServerManager {
  return defaultManager;
}

export default function (pi: any) {
  // Discover and register tools for enabled MCP servers on session_start
  pi.on("session_start", async (event: any) => {
    const activeProfile = event?.profileName ?? "local-coding";
    const serverConfigs = defaultManager.getServersForProfile(activeProfile);

    for (const srv of serverConfigs) {
      try {
        const client = defaultManager.getClient(srv.name);
        const tools = await client.listTools();

        for (const tool of tools) {
          const registeredName = `mcp_${srv.name}_${tool.name}`;
          if (typeof pi.registerTool === "function") {
            pi.registerTool({
              name: registeredName,
              description: `[MCP: ${srv.name}] ${tool.description ?? tool.name}`,
              parameters: tool.inputSchema ?? { type: "object", properties: {} },
              execute: async (_toolCallId: string, params: Record<string, unknown>, _signal: any, _extra: any) => {
                const res = await client.callTool(tool.name, params);
                if (res.isError) {
                  const errorMsg = res.content.map((c) => c.text ?? "").join("\n");
                  throw new Error(`MCP Tool Error: ${errorMsg}`);
                }
                const output = res.content.map((c) => c.text ?? JSON.stringify(c)).join("\n");
                return {
                  content: [{ type: "text", text: output }],
                };
              },
            });
          }
        }
      } catch {
        // Failing to connect to an optional MCP server should not crash the Pi startup
      }
    }
  });

  pi.on("session_shutdown", async () => {
    await defaultManager.stopAll();
  });
}
