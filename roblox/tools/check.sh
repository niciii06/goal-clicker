#!/usr/bin/env bash
# Checks the Roblox version: logic tests, type check, place build and the integration test.
# Needs: rojo, luau-lsp with Roblox definitions (LUAU_DEFINITIONS) and lune (all in rokit.toml).
# The logic tests use luaurun when installed, otherwise Lune (tests/run-unit.luau).
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v luaurun > /dev/null; then
	luaurun tests/harness.luau .
else
	lune run tests/run-unit.luau .
fi
rojo sourcemap default.project.json -o "${TMPDIR:-/tmp}/goal-clicker-sourcemap.json" > /dev/null
luau-lsp analyze --sourcemap="${TMPDIR:-/tmp}/goal-clicker-sourcemap.json" --definitions="${LUAU_DEFINITIONS:?Pfad zu globalTypes.d.luau setzen}" --ignore="src/shared/Data/**" src
rojo build -o build/GoalClicker.rbxl
lune run tests/integration/run.luau build/GoalClicker.rbxl
