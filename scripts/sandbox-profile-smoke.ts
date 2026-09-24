import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ProfileResolver } from "../src/profiles/resolver.js";

const { default: sandboxExtension } = await import(new URL("../extensions/core/sandbox-tools.ts", import.meta.url).href) as { default: (pi: any) => Promise<void> };

const image = JSON.parse(await readFile(new URL("../locks/sandbox-image.json", import.meta.url), "utf8")).image as string;
for (const profileName of ["local-coding", "herdr-worker"]) {
  const profile = new ProfileResolver(fileURLToPath(new URL("../profiles", import.meta.url))).resolveProfile(profileName);
  assert.equal(profile.sandboxExecution, "required");
  const workspace = await mkdtemp(join(tmpdir(), `lora-${profileName}-`));
  process.env.LORA_SANDBOX_IMAGE = image;
  process.env.LORA_SANDBOX_WORKSPACE = workspace;
  process.env.LORA_SANDBOX_SESSION_ID = `probe_${profileName.replace("-", "_")}`;
  process.env.LORA_SANDBOX_POLICY_VERSION = "probe_v1";
  const registered = new Map<string, any>();
  let shutdown: (() => Promise<void>) | undefined;
  try {
    await sandboxExtension({
      registerTool(tool: any) { registered.set(tool.name, tool); },
      on(event: string, handler: () => Promise<void>) { if (event === "session_shutdown") shutdown = handler; },
    });
    assert.equal(registered.size, 8);
    await registered.get("write").execute("write_1", { path: "probe.txt", content: profileName });
    const result = await registered.get("read").execute("read_1", { path: "probe.txt" });
    assert.match(JSON.stringify(result.content), new RegExp(profileName));
    console.log(`${profileName} registered eight isolated Pi tools`);
  } finally {
    await shutdown?.();
    await rm(workspace, { recursive: true, force: true });
  }
}
