import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { assertSafeTestDatabase } from "../tests/helpers/database-safety.js";

assertSafeTestDatabase();

const prismaCli = resolve("node_modules/prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  env: process.env,
  stdio: "inherit"
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
