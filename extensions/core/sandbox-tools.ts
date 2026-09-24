/** Loaded only by the trusted run-profile launcher after --no-builtin-tools. */
export default async function (pi: any) {
  const fatal = (error: unknown): never => { console.error("Sandbox tool initialization failed", error); process.exit(1); };
  const { createDockerSandboxExecutor } = await import(new URL("../../dist/src/sandbox/index.js", import.meta.url).href).catch(fatal) as typeof import("../../src/sandbox/index.js");
  const required = (name: string): string => process.env[name] || fatal(new Error(`Sandbox launcher configuration missing: ${name}`));
  const image = required("LORA_SANDBOX_IMAGE");
  const workspacePath = required("LORA_SANDBOX_WORKSPACE");
  const sessionId = required("LORA_SANDBOX_SESSION_ID");
  const policyVersion = required("LORA_SANDBOX_POLICY_VERSION");
  const executor = createDockerSandboxExecutor({ image });
  const session = await executor.openSession({
    sessionId, workspacePath, policyVersion, writable: true, network: "none",
  }).catch(async (error: unknown) => { await executor.close(); return fatal(error); });
  try {
    for (const definition of session.toolDefinitions.filter((tool) => tool.available)) {
      pi.registerTool({
        name: definition.name,
        label: definition.name,
        description: definition.description,
        parameters: definition.parameters,
        execute(toolCallId: string, params: unknown, signal?: AbortSignal, onUpdate?: (result: unknown) => void) {
          return session.execute({ id: toolCallId, name: definition.name, params, signal, onUpdate });
        },
      });
    }
  } catch (error) { await session.close(); await executor.close(); fatal(error); }
  pi.on("session_shutdown", async () => {
    await session.close();
    await executor.close();
  });
}
