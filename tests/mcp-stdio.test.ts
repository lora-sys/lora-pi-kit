import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { StdioMcpClient } from "../extensions/mcp/client.js";

describe("Stdio MCP Client & Protocol Integration", () => {
  const serverPath = path.resolve(__dirname, "fixtures/test-mcp-server.js");
  const client = new StdioMcpClient("node", [serverPath]);

  afterAll(async () => {
    await client.stop();
  });

  it("should initialize with stdio MCP server", async () => {
    const initRes = await client.initialize("test-client", "1.0.0");
    expect(initRes).toBeDefined();
    expect(initRes.protocolVersion).toBe("2024-11-05");
    expect(initRes.serverInfo.name).toBe("deterministic-test-mcp-server");
  });

  it("should list available tools over JSON-RPC 2.0 stdio", async () => {
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].name).toBe("test_echo");
    expect(tools[0].inputSchema.properties?.message).toBeDefined();
  });

  it("should execute tool call and return structured content", async () => {
    const res = await client.callTool("test_echo", { message: "hello-glassbox" });
    expect(res.isError).toBe(false);
    expect(res.content[0].type).toBe("text");
    expect(res.content[0].text).toBe("echoed: hello-glassbox");
  });

  it("waits for process handles to close before releasing its temporary working directory", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "kit-mcp-close-"));
    const isolated = new StdioMcpClient(process.execPath, [serverPath], {}, directory);
    try {
      await isolated.callTool("test_echo", { message: "close-check" });
      await isolated.stop();
      // No retry or delay: stop must wait for the child's actual close event.
      await rm(directory, { recursive: true });
    } finally {
      await isolated.stop();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
