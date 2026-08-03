import "dotenv/config";
import { spawnSync } from "node:child_process";

if (process.env.PORTAL_AUTO_BOOTSTRAP !== "true") {
  console.log("TutorHiveHub portal bootstrap skipped. Set PORTAL_AUTO_BOOTSTRAP=true to run it during build.");
  process.exit(0);
}

console.log("TutorHiveHub portal auto-bootstrap enabled.");

const result = spawnSync(process.execPath, ["scripts/bootstrapPortal.mjs"], {
  cwd: process.cwd(),
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
