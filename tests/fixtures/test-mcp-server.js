#!/usr/bin/env node
import readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const msg = JSON.parse(trimmed);
    const { id, method, params } = msg;

    if (method === "initialize") {
      sendResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "deterministic-test-mcp-server",
          version: "1.0.0",
        },
      });
    } else if (method === "notifications/initialized") {
      // no-op notification
    } else if (method === "tools/list") {
      sendResult(id, {
        tools: [
          {
            name: "test_echo",
            description: "Echoes back the message",
            inputSchema: {
              type: "object",
              properties: {
                message: { type: "string" },
              },
              required: ["message"],
            },
          },
        ],
      });
    } else if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};
      if (toolName === "test_echo") {
        sendResult(id, {
          content: [
            {
              type: "text",
              text: `echoed: ${toolArgs.message ?? ""}`,
            },
          ],
          isError: false,
        });
      } else {
        sendResult(id, {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${toolName}`,
            },
          ],
          isError: true,
        });
      }
    } else if (id !== undefined) {
      sendResult(id, { status: "ok" });
    }
  } catch (err) {
    // ignore
  }
});

function sendResult(id, result) {
  const payload = {
    jsonrpc: "2.0",
    id,
    result,
  };
  process.stdout.write(JSON.stringify(payload) + "\n");
}
