import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createDockerSandboxExecutor, type PiToolName } from "../src/sandbox/index.js";
import { sandboxContainerIdentity } from "../src/sandbox/container-stop.js";

const image = process.argv[2];
if (!image) throw new Error("Pass a reviewed sha256 image ID");
const execFileAsync = promisify(execFile);
const workspace = await mkdtemp(join(tmpdir(), "lora-sandbox-smoke-"));
const executor = createDockerSandboxExecutor({ image, maxSessions: 1, runAsUid: 10001, runAsGid: 10001, dnsMode: "cloudflare_doh" });
let session: Awaited<ReturnType<typeof executor.openSession>> | undefined;
try {
  const status = await executor.doctor();
  assert.equal(status.availableTools.length, 8);
  session = await executor.openSession({ sessionId: `smoke_${randomUUID()}`, workspacePath: workspace, writable: true, policyVersion: "test_v1", network: "none" });
  assert.equal(session.toolDefinitions.length, 8);
  let index = 0;
  const run = (name: PiToolName, params: unknown) => session!.execute({ id: `call_${++index}`, name, params });
  const write = await run("write", { path: "sample.txt", content: "alpha\n" });
  assert.equal(write.isError, undefined);
  assert.equal(await readFile(join(workspace, "sample.txt"), "utf8"), "alpha\n");
  const read = await run("read", { path: "sample.txt" });
  assert.match(JSON.stringify(read.content), /alpha/);
  await copyFile(new URL("../../skills/lora-visual/assets/golden/mode-b/mochi-sitting.png", import.meta.url), join(workspace, "pixel.png"));
  const imageResult = await run("read", { path: "pixel.png" });
  assert.equal(imageResult.content.some((block) => block.type === "image"), true);
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
  await session.close();
  const systemDnsExecutor = createDockerSandboxExecutor({ image, maxSessions: 1, runAsUid: 10001, runAsGid: 10001, dnsMode: "system" });
  try {
    const systemDnsSession = await systemDnsExecutor.openSession({
      sessionId: `system_dns_${randomUUID()}`, workspacePath: workspace, writable: true, policyVersion: "test_v1", network: "public_web",
    });
    const systemDnsResult = await systemDnsSession.execute({ id: `call_${++index}`, name: "bash", params: {
      command: "curl --connect-timeout 4 -sS -o /dev/null -w '%{http_code}' -x http://lora-egress-proxy:3128 http://example.com",
    } });
    assert.match(JSON.stringify(systemDnsResult.content), /403/u);
    await systemDnsSession.close();
  } finally { await systemDnsExecutor.close(); }
  session = await executor.openSession({ sessionId: `web_${randomUUID()}`, workspacePath: workspace, writable: true, policyVersion: "test_v1", network: "public_web" });
  const webRun = (args: string[], extra: { maxArtifactBytes?: number; signal?: AbortSignal } = {}) => session!.executeCli({
    id: `call_${++index}`, executable: "agent-browser", args, ...extra,
  });
  const detail = (result: unknown) => (result as { details?: Record<string, unknown> }).details ?? {};
  const publicIp = await run("bash", { command: "curl -ksS --connect-timeout 5 -o /dev/null -w '%{http_code}' -x http://lora-egress-proxy:3128 https://1.1.1.1/" });
  assert.match(JSON.stringify(publicIp.content), /301/u);
  const privateTarget = await run("bash", { command: "curl --connect-timeout 3 -sS -o /dev/null -w '%{http_code}' -x http://lora-egress-proxy:3128 http://169.254.169.254/latest/meta-data/" });
  assert.match(JSON.stringify(privateTarget.content), /403/u);
  const browserTlsEgress = await run("bash", { command: "curl --connect-timeout 8 -fsS -x http://lora-egress-proxy:3128 https://example.com" });
  assert.match(JSON.stringify(browserTlsEgress.content), /Example Domain/u);
  await assert.rejects(run("bash", { command: "curl --connect-timeout 2 -fsS https://example.com" }));
  const opened = await webRun(["--json", "--session", "kit-smoke", "open", "https://example.com"]);
  if (detail(opened).exitCode !== 0) {
    const proxyName = `${sandboxContainerIdentity(session.sessionId).name}-proxy`;
    const logs = await execFileAsync("docker", ["logs", proxyName], { windowsHide: true }).then((result) => result.stdout + result.stderr).catch((error) => String(error));
    throw new Error(`Browser navigation failed: ${JSON.stringify(detail(opened))}; proxy log: ${logs}`);
  }
  assert.equal((JSON.parse(String(detail(opened).stdout)) as { success?: boolean }).success, true);
  const snapshot = await webRun(["--json", "--session", "kit-smoke", "snapshot"]);
  assert.equal(detail(snapshot).exitCode, 0);
  const snapshotJson = JSON.parse(String(detail(snapshot).stdout)) as { success?: boolean; data?: unknown };
  assert.equal(snapshotJson.success, true);
  assert.ok(snapshotJson.data);
  assert.match(JSON.stringify(snapshotJson.data), /Example Domain/u);
  const screenshot = await webRun(["--json", "--session", "kit-smoke", "screenshot"], { maxArtifactBytes: 2 * 1024 * 1024 });
  const artifact = detail(screenshot).artifact as { mimeType?: string; data?: string; sizeBytes?: number } | undefined;
  assert.equal(artifact?.mimeType, "image/png");
  assert.ok(artifact?.data && Buffer.from(artifact.data, "base64").subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
  assert.equal(Buffer.from(artifact!.data!, "base64").byteLength, artifact!.sizeBytes);
  const cancelController = new AbortController();
  const cancelled = webRun(["--json", "--session", "kit-smoke", "wait", "20000"], { signal: cancelController.signal });
  setTimeout(() => cancelController.abort(), 400);
  await assert.rejects(cancelled);
  let processCheck;
  try {
    processCheck = await run("bash", { command: "ps -eo args | grep -E '[a]gent-browser|[c]hromium' || true" });
  } catch {
    const closedSessionId = session.sessionId;
    let stopped = false;
    let lastError: unknown;
    for (let attempt = 0; attempt < 10 && !stopped; attempt++) {
      try { await executor.ensureSessionStopped(closedSessionId); stopped = true; }
      catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, 100)); }
    }
    if (!stopped) throw lastError;
    session = await executor.openSession({ sessionId: `web_after_cancel_${randomUUID()}`, workspacePath: workspace, writable: true, policyVersion: "test_v1", network: "public_web" });
    processCheck = await run("bash", { command: "ps -eo args | grep -E '[a]gent-browser|[c]hromium' || true" });
  }
  assert.doesNotMatch(JSON.stringify(processCheck.content), /agent-browser|chromium/iu);
  const afterCancel = await webRun(["--json", "--session", "kit-smoke", "open", "https://example.com"]);
  assert.equal(detail(afterCancel).exitCode, 0, JSON.stringify(detail(afterCancel)));
  assert.equal((JSON.parse(String(detail(afterCancel).stdout)) as { success?: boolean }).success, true);
  const oldExecutor = createDockerSandboxExecutor({ image, maxSessions: 1, runAsUid: 10001, runAsGid: 10001 });
  const restartedExecutor = createDockerSandboxExecutor({ image, maxSessions: 1, runAsUid: 10001, runAsGid: 10001 });
  const recoveryId = `recovery_${randomUUID()}`;
  const oldSession = await oldExecutor.openSession({ sessionId: recoveryId, workspacePath: workspace, writable: true, policyVersion: "test_v1", network: "none" });
  try {
    await restartedExecutor.ensureSessionStopped(recoveryId);
    await oldSession.close();
    await restartedExecutor.ensureSessionStopped(recoveryId);
  } finally {
    await oldExecutor.close();
    await restartedExecutor.close();
  }
  console.log("Sandbox smoke passed for all eight Pi tools, system DNS fail-closed behavior, Cloudflare DoH public domain navigation, screenshot Artifact, cancellation, and recovery");
} finally {
  await session?.close();
  await executor.close();
  await rm(workspace, { recursive: true, force: true });
}
