import { strict as assert } from "node:assert";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDockerSandboxExecutor, type PiToolName } from "../src/sandbox/index.js";

const image = process.argv[2];
if (!image) throw new Error("Pass a reviewed sha256 image ID");
const workspace = await mkdtemp(join(tmpdir(), "lora-sandbox-smoke-"));
const executor = createDockerSandboxExecutor({ image, maxSessions: 1, runAsUid: 10001, runAsGid: 10001 });
let session: Awaited<ReturnType<typeof executor.openSession>> | undefined;
try {
  const status = await executor.doctor();
  assert.equal(status.availableTools.length, 8);
  session = await executor.openSession({ sessionId: "smoke", workspacePath: workspace, writable: true, policyVersion: "test_v1", network: "none" });
  assert.equal(session.toolDefinitions.length, 8);
  let index = 0;
  const run = (name: PiToolName, params: unknown) => session!.execute({ id: `call_${++index}`, name, params });
  const write = await run("write", { path: "sample.txt", content: "alpha\n" });
  assert.equal(write.isError, undefined);
  assert.equal(await readFile(join(workspace, "sample.txt"), "utf8"), "alpha\n");
  const read = await run("read", { path: "sample.txt" });
  assert.match(JSON.stringify(read.content), /alpha/);
  await copyFile(new URL("../../skills/lora-visual/assets/golden/mode-b/mochi-sitting.png", import.meta.url), join(workspace, "pixel.png"));
  const image = await run("read", { path: "pixel.png" });
  assert.equal(image.content.some((block) => block.type === "image"), true);
  const edit = await run("edit", { path: "sample.txt", edits: [{ oldText: "alpha", newText: "beta" }] });
  assert.match(JSON.stringify(edit.details), /beta/);
  assert.equal(await readFile(join(workspace, "sample.txt"), "utf8"), "beta\n");
  assert.match(JSON.stringify((await run("grep", { pattern: "beta" })).content), /sample.txt/);
  assert.match(JSON.stringify((await run("find", { pattern: "*.txt" })).content), /sample.txt/);
  assert.match(JSON.stringify((await run("ls", {})).content), /sample.txt/);
  assert.match(JSON.stringify((await run("bash", { command: "pwd" })).content), /workspace/);
  assert.match(JSON.stringify((await run("powershell", { command: "Get-Location" })).content), /workspace/);
  await writeFile(join(workspace, "host-only.txt"), "test", "utf8");
  const escaped = await run("read", { path: "/tmp/host-only.txt" }).catch((error) => String(error));
  assert.doesNotMatch(JSON.stringify(escaped), /"test"/);
  await assert.rejects(run("bash", { command: "curl --connect-timeout 2 -fsS https://example.com" }), /Could not resolve host|Network is unreachable/);
  const cli = await session.executeCli({ id: `call_${++index}`, executable: "agent-browser", args: ["--version"] });
  assert.match(JSON.stringify(cli.content), /0\.38\.1/);
  console.log("Sandbox smoke passed for all eight Pi tools and blocked network");
} finally {
  await session?.close();
  await executor.close();
  await rm(workspace, { recursive: true, force: true });
}
