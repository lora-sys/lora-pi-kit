import fs from "node:fs";
import path from "node:path";
import { runDoctor } from "./doctor.js";
import type { PiLock, CompatibilityMetadata } from "../src/types.js";

export function updateKit(options: { rootDir?: string; checkOnly?: boolean } = {}): {
  upToDate: boolean;
  message: string;
} {
  const root = options.rootDir ?? path.resolve(process.cwd());
  const piLockPath = path.join(root, "locks", "pi.lock.json");
  const compatPath = path.join(root, "locks", "compatibility.json");

  const piLock: PiLock = JSON.parse(fs.readFileSync(piLockPath, "utf-8"));
  const compat: CompatibilityMetadata = JSON.parse(fs.readFileSync(compatPath, "utf-8"));

  const isAligned = piLock.version === compat.pinnedPiVersion;
  const doc = runDoctor(root);

  if (!doc.allPassed) {
    return {
      upToDate: false,
      message: "Update verification failed: environment has failing diagnostic checks.",
    };
  }

  return {
    upToDate: isAligned,
    message: isAligned
      ? `Lora PI Kit is up to date and aligned with pinned Pi ${piLock.version} (commit: ${piLock.commit.slice(0, 8)}).`
      : `Version divergence detected: lock has ${piLock.version}, compat requires ${compat.pinnedPiVersion}.`,
  };
}

if (process.argv[1] && process.argv[1].endsWith("update.ts")) {
  const res = updateKit();
  console.log(res.message);
  process.exit(res.upToDate ? 0 : 1);
}
