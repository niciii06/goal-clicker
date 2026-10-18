-- Runs tests/harness.luau with Lune when luaurun is not installed.
-- Usage: lune run tests/run-unit.luau [roblox dir] [filter]
-- Lune's file access yields, which is not allowed inside the harness metamethods, so the
-- source tree is read into memory first.
local fs = require("@lune/fs")
local luau = require("@lune/luau")
local process = require("@lune/process")

local root = process.args[1] or "."
local filter = process.args[2]

local files: { [string]: string } = {}
local dirs: { [string]: { string } } = {}

local function scan(path: string)
	local entries = fs.readDir(path)
	dirs[path] = entries
	for _, name in entries do
		local child = path .. "/" .. name
		if fs.isDir(child) then
			scan(child)
		elseif string.match(name, "%.luau$") then
			files[child] = fs.readFile(child)
		end
	end
end
scan(root .. "/src")
scan(root .. "/tests")

local function loadChunk(source: string, name: string, env: any)
	return luau.load(source, { debugName = name, environment = env })
end

local globals = {
	ARGS = { "harness", root, filter },
	readFile = function(path: string): string?
		return files[path]
	end,
	isDir = function(path: string): boolean
		return dirs[path] ~= nil
	end,
	listDir = function(path: string): { string }
		return table.clone(dirs[path] or {})
	end,
	loadChunk = loadChunk,
}
local env = setmetatable(globals, { __index = _G })
loadChunk(files[root .. "/tests/harness.luau"], "harness.luau", env)()
