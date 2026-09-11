import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(readFileSync(new URL("../wrangler.external.json", import.meta.url), "utf8"));
const db = config.d1_databases.find((item) => item.binding === "DB");
const action = process.argv[2];
if (!["deploy", "migrate"].includes(action)) throw new Error("Use deploy or migrate.");
if (!db || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(db.database_id) || db.database_id === "00000000-0000-4000-8000-000000000000") {
  throw new Error("Create your own D1 database and set its database_id in wrangler.external.json first. See HOSTING.md.");
}
const args = action === "deploy"
  ? ["deploy", "--config", "wrangler.external.json"]
  : ["d1", "migrations", "apply", "DB", "--remote", "--config", "wrangler.external.json"];
const result = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)), ...args], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
