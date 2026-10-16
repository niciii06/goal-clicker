#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

worker="${SITES_PROJECT_ROOT}/dist/server/index.js"
hosting="${SITES_PROJECT_ROOT}/dist/.openai/hosting.json"

[[ -f "${worker}" ]] || {
  echo "Missing Sites Worker entry: dist/server/index.js" >&2
  exit 66
}
[[ -f "${hosting}" ]] || {
  echo "Missing packaged Sites manifest: dist/.openai/hosting.json" >&2
  exit 66
}

node --input-type=module - "${worker}" "${hosting}" "${script_dir}/cloudflare-node-loader.mjs" <<'NODE'
import { register } from "node:module";
import { readdir, stat, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const [workerPath, hostingPath, loaderPath] = process.argv.slice(2);
register(pathToFileURL(loaderPath).href, import.meta.url);
JSON.parse(await readFile(hostingPath, "utf8"));
const assetsPath = new URL("../client/assets/", pathToFileURL(workerPath));
const chunks = await Promise.all((await readdir(assetsPath)).filter(name => name.endsWith('.js')).map(async name => ({name, bytes:(await stat(new URL(name,assetsPath))).size})));
if (!chunks.length) throw new Error('No production client chunks found');
const largest = chunks.reduce((a,b) => a.bytes>b.bytes?a:b);
if(largest.bytes>500_000) throw new Error(`Client chunk exceeds 500 kB: ${largest.name} (${largest.bytes} bytes)`);
console.log(`Client chunk budget passed: ${chunks.length} chunks; largest ${largest.name} = ${largest.bytes} bytes (limit 500000).`);


const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("sites-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);
if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
}
NODE

echo "Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present."
