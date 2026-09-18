import { spawn, type ChildProcess } from "node:child_process";
import readline from "node:readline";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpToolResult {
  content: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  isError?: boolean;
}

export class StdioMcpClient {
  private command: string;
  private args: string[];
  private env?: NodeJS.ProcessEnv;
  private process: ChildProcess | null = null;
  private nextId = 1;
  private pendingRequests = new Map<
    number,
    {
      resolve: (val: any) => void;
      reject: (err: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();
  private rl: readline.Interface | null = null;
  private initialized = false;

  constructor(command: string, args: string[] = [], env?: Record<string, string>, private readonly cwd?: string) {
    this.command = command;
    this.args = args;
    this.env = { ...process.env, ...env };
  }

  public async start(): Promise<void> {
    if (this.process) return;

    this.process = spawn(this.command, this.args, {
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      cwd: this.cwd,
    });

    this.process.on("error", (err) => {
      this.rejectAllPending(new Error(`MCP process failed: ${err.message}`));
    });

    this.process.on("exit", (code) => {
      this.rejectAllPending(new Error(`MCP process exited with code ${code}`));
      this.process = null;
      this.initialized = false;
    });

    if (this.process.stdout) {
      this.rl = readline.createInterface({ input: this.process.stdout });
      this.rl.on("line", (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const msg = JSON.parse(trimmed) as JsonRpcResponse;
          if (typeof msg.id === "number" && this.pendingRequests.has(msg.id)) {
            const req = this.pendingRequests.get(msg.id)!;
            this.pendingRequests.delete(msg.id);
            clearTimeout(req.timer);

            if (msg.error) {
              req.reject(new Error(`JSON-RPC Error ${msg.error.code}: ${msg.error.message}`));
            } else {
              req.resolve(msg.result);
            }
          }
        } catch {
          // Ignore non-json lines
        }
      });
    }
  }

  public async initialize(clientName = "lora-pi-kit", clientVersion = "0.1.0"): Promise<any> {
    if (!this.process) {
      await this.start();
    }

    const initResult = await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      clientInfo: {
        name: clientName,
        version: clientVersion,
      },
    });

    // Send initialized notification
    this.sendNotification("notifications/initialized", {});
    this.initialized = true;
    return initResult;
  }

  public async listTools(): Promise<McpToolDefinition[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const res = (await this.sendRequest("tools/list", {})) as { tools: McpToolDefinition[] };
    return res?.tools ?? [];
  }

  public async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const res = (await this.sendRequest("tools/call", {
      name,
      arguments: args,
    })) as McpToolResult;

    return res;
  }

  public async stop(): Promise<void> {
    this.rejectAllPending(new Error("MCP client stopped"));
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.initialized = false;
  }

  private sendRequest(method: string, params: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        return reject(new Error("MCP process is not running"));
      }

      const id = this.nextId++;
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request '${method}' timed out after 10000ms`));
        }
      }, 10000);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const payload: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.process.stdin.write(JSON.stringify(payload) + "\n", (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingRequests.delete(id);
          reject(err);
        }
      });
    });
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    if (!this.process || !this.process.stdin) return;
    const payload = {
      jsonrpc: "2.0",
      method,
      params,
    };
    this.process.stdin.write(JSON.stringify(payload) + "\n");
  }

  private rejectAllPending(err: Error): void {
    for (const [, req] of this.pendingRequests) {
      clearTimeout(req.timer);
      req.reject(err);
    }
    this.pendingRequests.clear();
  }
}
