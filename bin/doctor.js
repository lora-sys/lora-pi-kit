#!/usr/bin/env node
import { runDoctor, parseDoctorProfileArgs } from "../dist/scripts/doctor.js";

let profiles = [];
try {
  profiles = parseDoctorProfileArgs(process.argv.slice(2));
} catch (err) {
  console.error(`Usage: lora-doctor [--profile <name>]...\n${err.message}`);
  process.exit(2);
}

const res = runDoctor(undefined, { profiles });
for (const c of res.checks) {
  const badge = c.passed ? "[PASS]" : "[FAIL]";
  console.log(`${badge} ${c.name}: ${c.message}`);
}

console.log(`\nResult: ${res.allPassed ? "All checks passed!" : "Doctor found issues."}`);
process.exit(res.allPassed ? 0 : 1);
