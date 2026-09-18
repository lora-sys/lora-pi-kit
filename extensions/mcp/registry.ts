import fs from "node:fs";
import path from "node:path";
import type { McpRegistry, McpServerConfig } from "../../src/types.js";
import { StdioMcpClient } from "./client.js";
import { kitRoot } from "../../src/paths.js";

export class McpServerManager {
  private registryPath: string;
  private registry: McpRegistry | null = null;
  private activeClients = new Map<string, StdioMcpClient>();

  constructor(registryPath?: string) {
    this.registryPath = registryPath ?? path.join(kitRoot(), "mcp", "registry.json");
  }

  public getRegistry(): McpRegistry {
    if (!this.registry) {
      if (!fs.existsSync(this.registryPath)) {
        this.registry = { version: "1.0.0", servers: {} };
      } else {
        const raw = fs.readFileSync(this.registryPath, "utf-8");
        this.registry = JSON.parse(raw);
      }
    }
    return this.registry!;
  }

  public getServerConfig(name: string): McpServerConfig | undefined {
    const reg = this.getRegistry();
    return reg.servers[name];
  }

  public getServersForProfile(profileName: string): McpServerConfig[] {
    const reg = this.getRegistry();
    return Object.values(reg.servers).filter((srv) => {
      if (!srv.enabledProfiles || srv.enabledProfiles.length === 0) return false;
      return srv.enabledProfiles.includes(profileName);
    });
  }

  public getClient(name: string): StdioMcpClient {
    if (this.activeClients.has(name)) {
      return this.activeClients.get(name)!;
    }

    const config = this.getServerConfig(name);
    if (!config) {
      throw new Error(`MCP server '${name}' not found in registry`);
    }

    if (config.transport !== "stdio") throw new Error("Only stdio MCP is supported");
    const client = new StdioMcpClient(config.command, config.args ?? [], config.env, path.dirname(this.registryPath));
    this.activeClients.set(name, client);
    return client;
  }

  public async stopAll(): Promise<void> {
    for (const [, client] of this.activeClients) {
      await client.stop();
    }
    this.activeClients.clear();
  }
}
