#!/usr/bin/env node
import { runDoctor } from "../dist/scripts/doctor.js";

const res = runDoctor();
for (const c of res.checks) {
  const badge = c.passed ? "[PASS]" : "[FAIL]";
  console.log(`${badge} ${c.name}: ${c.message}`);
}

console.log(`\nResult: ${res.allPassed ? "All checks passed!" : "Doctor found issues."}`);
process.exit(res.allPassed ? 0 : 1);
