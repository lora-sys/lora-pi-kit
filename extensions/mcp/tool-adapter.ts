import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { McpServerManager } from "./registry.js";

export interface McpAdapterOptions {
  profileName: string;
  enabledServers: readonly string[];
  registryPath?: string;
  authorize?: (request: { serverName: string; toolName: string; input: Record<string, unknown> }) => Promise<boolean> | boolean;
}

/** One manager per session. The embedding product supplies current authorization. */
export function createMcpExtension(options: McpAdapterOptions) {
  return async (pi: ExtensionAPI): Promise<void> => {
    const manager = new McpServerManager(options.registryPath);
    pi.on("session_shutdown", () => manager.stopAll());
    const configured = manager.getServersForProfile(options.profileName);
    try {
      for (const name of options.enabledServers) {
        const server = configured.find((entry) => entry.name === name);
        if (!server) throw new Error(`MCP server is not enabled for profile: ${name}`);
        if (!/^[a-zA-Z0-9_-]+$/u.test(name)) throw new Error("Invalid MCP server name");
        const client = manager.getClient(name);
        const tools = await client.listTools();
        for (const tool of tools) {
          if (!/^[a-zA-Z0-9_-]+$/u.test(tool.name)) throw new Error("Invalid MCP tool name");
          pi.registerTool({
            name: `mcp_${name}_${tool.name}`,
            label: tool.name,
            description: tool.description ?? tool.name,
            parameters: tool.inputSchema as ToolDefinition["parameters"],
            async execute(_callId, params) {
              const input = params as Record<string, unknown>;
              const allowed = options.authorize
                ? await options.authorize({ serverName: name, toolName: tool.name, input })
                : ["local-coding", "test"].includes(options.profileName);
              if (!allowed) throw new Error("mcp_authorization_denied");
              const result = await client.callTool(tool.name, input);
              if (result.isError) throw new Error("mcp_tool_failed");
              return { content: result.content.map((part) => ({ type: "text" as const, text: part.text ?? JSON.stringify(part) })), details: {} };
            },
          });
        }
      }
    } catch (error) {
      await manager.stopAll();
      throw error;
    }
  };
}

// Package discovery alone grants no MCP capability. Profile installation or an
// embedding host creates the configured factory above.
export default function (_pi: ExtensionAPI): void {}
