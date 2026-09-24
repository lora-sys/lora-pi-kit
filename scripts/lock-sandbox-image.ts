import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const image = process.argv[2];
if (!image || !/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error("Pass a local Docker sha256 image ID");
const inspected = await exec("docker", ["image", "inspect", image, "--format", "{{.Id}}"], { timeout: 5000 });
if (inspected.stdout.trim() !== image) throw new Error("Image ID changed");
const artifacts = [
  "dist/src/sandbox/index.js", "dist/src/sandbox/worker.js", "dist/src/sandbox/protocol.js",
  "dist/src/sandbox/container-stop.js", "dist/scripts/run.js", "extensions/core/sandbox-tools.ts",
  "Dockerfile.sandbox", "package-lock.json",
];
const sha256 = async (relative: string) => createHash("sha256").update(await readFile(path.join(root, relative))).digest("hex");
const hashes = Object.fromEntries(await Promise.all(artifacts.map(async (relative) => [relative, await sha256(relative)])));
for (const relative of ["dist/src/sandbox/worker.js", "dist/src/sandbox/protocol.js"]) {
  const inImage = await exec("docker", ["run", "--rm", "--entrypoint", "sha256sum", image, `/opt/lora/${relative}`], { timeout: 5000 });
  if (inImage.stdout.split(" ")[0] !== hashes[relative]) throw new Error(`Image is stale for ${relative}`);
}
const lock = {
  schemaVersion: 1,
  image,
  platform: "linux/amd64",
  pi: "0.85.1",
  node: "24.21.0",
  ripgrep: "13.0.0",
  fd: "10.5.0",
  powershell: "7.5.3",
  agentBrowser: "0.38.1",
  sha256: hashes,
};
await writeFile(path.join(root, "locks", "sandbox-image.json"), `${JSON.stringify(lock, null, 2)}\n`);
console.log(image);
