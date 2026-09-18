import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installKit, installArguments } from "./install.js";

/** Activate a previously obtained, doctor-verified local Kit revision. No floating pull. */
export async function updateKit(options: { rootDir: string; agentDir: string; profile?: string }) {
  const previous = JSON.parse(await readFile(path.join(options.agentDir, "lora-installation.json"), "utf8"));
  const result = await installKit({ ...options, profile: options.profile ?? previous.profile });
  return { ...result, previousPackageRoot: previous.packageRoot };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = installArguments();
  if (!options.rootDir) throw new Error("Update requires --root pointing to the verified target checkout");
  console.log(JSON.stringify(await updateKit({ ...options, rootDir: options.rootDir }), null, 2));
}
