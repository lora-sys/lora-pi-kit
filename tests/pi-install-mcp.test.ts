import { mkdtemp, rm, readFile, cp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { installKit } from "../scripts/install.js";
import { updateKit } from "../scripts/update.js";
import { createMcpExtension } from "../extensions/mcp/tool-adapter.js";
import { kitRoot } from "../src/paths.js";
import { loadInstalledProfile } from "../src/installed-profile.js";

async function localModel(directory: string, expectedAllowed: () => boolean) {
  const models = await ModelRuntime.create({ authPath: path.join(directory, "auth.json"), modelsPath: null,
    modelsStorePath: path.join(directory, "model-cache"), allowModelNetwork: false, refreshOnCreate: false });
  let step = 0;
  models.registerProvider("fixture", { api: "openai-completions", apiKey: "test", baseUrl: "http://127.0.0.1:1",
    models: [{ id: "local", name: "Local", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 8192, maxTokens: 512 }],
    streamSimple(model, context) {
      const call = ++step % 2 === 1;
      if (!call) {
        const result = context.messages.filter((entry) => entry.role === "toolResult").at(-1)!;
        expect(JSON.stringify(result).includes("echoed: MCP_CANARY")).toBe(expectedAllowed());
        expect(Boolean(result.isError)).toBe(!expectedAllowed());
      }
      const message: AssistantMessage = { role: "assistant", api: model.api, provider: model.provider, model: model.id,
        content: call ? [{ type: "toolCall", id: `call-${step}`, name: "mcp_test-mcp_test_echo", arguments: { message: "MCP_CANARY" } }] : [{ type: "text", text: "Checked" }],
        stopReason: call ? "toolUse" : "stop", timestamp: Date.now(),
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      const stream = createAssistantMessageEventStream();
      stream.push({ type: "start", partial: message });
      stream.push({ type: "done", reason: call ? "toolUse" : "stop", message });
      stream.end(message);
      return stream;
    } });
  return { models, model: models.getModel("fixture", "local")! };
}

it("installs a profile into fresh Pi state and runs its bundled Skill and MCP Extension", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lora-install-"));
  const agentDir = path.join(directory, "agent");
  let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
  try {
    await installKit({ agentDir, profile: "test" });
    const { models, model } = await localModel(directory, () => true);
    const settings = SettingsManager.create(directory, agentDir);
    const installedProfile = await loadInstalledProfile(agentDir);
    const loader = new DefaultResourceLoader({ cwd: directory, settingsManager: settings, ...installedProfile.loaderOptions });
    await loader.reload();
    expect(loader.getExtensions().errors).toEqual([]);
    expect(loader.getSkills().skills.map((skill) => skill.name)).toEqual(["unslop"]);
    expect(loader.getSystemPrompt()).toContain("You are Lora's Personal Agent.");
    ({ session } = await createAgentSession({ cwd: directory, agentDir, settingsManager: settings,
      resourceLoader: loader, sessionManager: SessionManager.inMemory(directory), modelRuntime: models, model }));
    await session.bindExtensions({});
    expect(session.getActiveToolNames()).toContain("mcp_test-mcp_test_echo");
    expect(session.getActiveToolNames()).not.toContain("bash");
    await session.prompt("Call the test MCP");
    expect(JSON.stringify(session.messages)).toContain("echoed: MCP_CANARY");
    const originalSettings = await readFile(path.join(agentDir, "settings.json"), "utf8");
    const installed = JSON.parse(originalSettings);
    expect(installed.packages).toHaveLength(1);
    expect(installed.packages[0].source).toBe(kitRoot());
    expect(installed.packages[0].skills).toEqual(["skills/unslop/SKILL.md"]);
    // A failed controlled upgrade must leave the selected installation intact.
    const invalidRoot = path.join(directory, "invalid-kit");
    await mkdir(invalidRoot);
    await expect(updateKit({ agentDir, rootDir: invalidRoot })).rejects.toThrow("doctor failed");
    expect(await readFile(path.join(agentDir, "settings.json"), "utf8")).toBe(originalSettings);
    const nextRoot = path.join(directory, "next-kit");
    await cp(kitRoot(), nextRoot, { recursive: true, filter: (source) => !["node_modules", ".git", "dist"].includes(path.relative(kitRoot(), source).split(path.sep)[0]!) });
    await updateKit({ agentDir, rootDir: nextRoot });
    const updated = JSON.parse(await readFile(path.join(agentDir, "settings.json"), "utf8"));
    expect(updated.packages).toHaveLength(1);
    expect(updated.packages[0].source).toBe(nextRoot);
    expect((await loadInstalledProfile(agentDir)).root).toBe(nextRoot);
  } finally {
    await session?.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
    session?.dispose();
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);

it("reauthorizes each MCP call and isolates parallel session policy", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lora-mcp-policy-"));
  const sessions: Awaited<ReturnType<typeof createAgentSession>>["session"][] = [];
  let granted = true;
  try {
    for (const index of [0, 1]) {
      const agentDir = path.join(directory, String(index));
      await mkdir(agentDir);
      const allowed = () => index === 0 && granted;
      const { models, model } = await localModel(agentDir, allowed);
      const settings = SettingsManager.inMemory();
      const loader = new DefaultResourceLoader({ cwd: agentDir, agentDir, settingsManager: settings,
        noExtensions: true, noSkills: true, noThemes: true, noContextFiles: true,
        extensionFactories: [createMcpExtension({ profileName: "test", enabledServers: ["test-mcp"], authorize: allowed })] });
      await loader.reload();
      expect(loader.getExtensions().errors).toEqual([]);
      const { session } = await createAgentSession({ cwd: agentDir, agentDir, settingsManager: settings, resourceLoader: loader,
        sessionManager: SessionManager.inMemory(agentDir), modelRuntime: models, model, noTools: "all", tools: ["mcp_test-mcp_test_echo"] });
      sessions.push(session);
      await session.bindExtensions({});
    }
    await Promise.all(sessions.map((session) => session.prompt("Call MCP")));
    granted = false;
    await sessions[0]!.prompt("Call MCP again after revocation");
  } finally {
    for (const session of sessions) { await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" }); session.dispose(); }
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);
