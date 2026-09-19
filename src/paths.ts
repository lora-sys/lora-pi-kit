import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function kitRoot(): string {
  let directory = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    const manifest = path.join(directory, "package.json");
    if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, "utf8")).name === "@lora-sys/pi-kit") return directory;
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error("Lora PI Kit package root is unavailable");
    directory = parent;
  }
}
