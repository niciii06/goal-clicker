#!/usr/bin/env bash
# Runs the Luau tests and the type checker for the Roblox version.
# Needs: luaurun (tests/harness runner), rojo and luau-lsp with Roblox definitions.
set -euo pipefail
cd "$(dirname "$0")/.."
luaurun tests/harness.luau .
rojo sourcemap default.project.json -o "${TMPDIR:-/tmp}/goal-clicker-sourcemap.json" > /dev/null
luau-lsp analyze --sourcemap="${TMPDIR:-/tmp}/goal-clicker-sourcemap.json" --definitions="${LUAU_DEFINITIONS:?Pfad zu globalTypes.d.luau setzen}" --ignore="src/shared/Data/**" src
