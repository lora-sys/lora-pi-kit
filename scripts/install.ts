import { runDoctor } from "./doctor.js";

export function installKit(options: { rootDir?: string } = {}): { success: boolean; message: string } {
  console.log("Installing and verifying Lora PI Kit...");
  const doc = runDoctor(options.rootDir);

  if (!doc.allPassed) {
    const failures = doc.checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.message}`);
    return {
      success: false,
      message: `Installation validation failed:\n- ${failures.join("\n- ")}`,
    };
  }

  return {
    success: true,
    message: "Lora PI Kit installed and validated successfully.",
  };
}

if (process.argv[1] && process.argv[1].endsWith("install.ts")) {
  const res = installKit();
  console.log(res.message);
  process.exit(res.success ? 0 : 1);
}
