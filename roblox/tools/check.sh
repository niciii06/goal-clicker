#!/usr/bin/env bash
# Checks the Roblox version: logic tests, type check, place build and the integration test.
# Needs: luaurun (Luau runner used by tests/harness.luau), rojo, luau-lsp with Roblox
# definitions (LUAU_DEFINITIONS) and lune.
set -euo pipefail
cd "$(dirname "$0")/.."
luaurun tests/harness.luau .
rojo sourcemap default.project.json -o "${TMPDIR:-/tmp}/goal-clicker-sourcemap.json" > /dev/null
luau-lsp analyze --sourcemap="${TMPDIR:-/tmp}/goal-clicker-sourcemap.json" --definitions="${LUAU_DEFINITIONS:?Pfad zu globalTypes.d.luau setzen}" --ignore="src/shared/Data/**" src
rojo build -o build/GoalClicker.rbxl
lune run tests/integration/run.luau build/GoalClicker.rbxl
