-- Loads the Rojo tree outside of Roblox so the shared and server logic can be tested.
-- Usage: luaurun roblox/tests/harness.luau <roblox dir> [filter]
local ROOT = ARGS[2] or "roblox"
local FILTER = ARGS[3]

local MOUNTS = {
	ReplicatedStorage = { Shared = ROOT .. "/src/shared" },
	ServerScriptService = { Server = ROOT .. "/src/server" },
}

local cache = {}
local Instance = {}
Instance.__index = function(self, key)
	local method = rawget(Instance, key)
	if method then
		return method
	end
	local child = self:FindFirstChild(key)
	if child then
		return child
	end
	error(("%s is not a valid member of %s"):format(tostring(key), rawget(self, "Name")), 2)
end

local function node(name, path, parent, isFile)
	return setmetatable({ Name = name, Parent = parent, _path = path, _file = isFile }, Instance)
end

function Instance:FindFirstChild(name)
	local children = rawget(self, "_children")
	if children and children[name] then
		return children[name]
	end
	local path = rawget(self, "_path")
	if not path or rawget(self, "_file") then
		return nil
	end
	local found
	if isDir(path .. "/" .. name) then
		found = node(name, path .. "/" .. name, self, false)
	elseif readFile(path .. "/" .. name .. ".luau") then
		found = node(name, path .. "/" .. name .. ".luau", self, true)
	end
	if found then
		rawset(self, "_children", children or {})
		rawget(self, "_children")[name] = found
	end
	return found
end
Instance.WaitForChild = Instance.FindFirstChild

local function mount(name, children)
	local service = node(name, nil, nil, false)
	local list = {}
	for childName, path in children do
		list[childName] = node(childName, path, service, false)
	end
	rawset(service, "_children", list)
	return service
end

local services = {}
for name, children in MOUNTS do
	services[name] = mount(name, children)
end
local game = { GetService = function(_, name)
	return services[name] or error("Service " .. name .. " is not available in tests")
end }

local function requireModule(target)
	if cache[target] ~= nil then
		return cache[target]
	end
	local path = rawget(target, "_path")
	local file = rawget(target, "_file") and path or path .. "/init.luau"
	local source = readFile(file) or error("Cannot read module " .. file)
	local env = setmetatable({ script = target, require = requireModule, game = game }, { __index = _G })
	local result = loadChunk(source, file, env)()
	cache[target] = result
	return result
end

-- Minimal test framework.
local passed, failed = 0, 0
local function expectEqual(actual, expected, label)
	if actual ~= expected then
		error(("%s: expected %s, got %s"):format(label or "value", tostring(expected), tostring(actual)), 2)
	end
end
local function expectTrue(value, label)
	if not value then
		error((label or "condition") .. " failed", 2)
	end
end
local function expectNear(actual, expected, tolerance, label)
	if math.abs(actual - expected) > (tolerance or 1e-9) then
		error(("%s: expected %s, got %s"):format(label or "value", tostring(expected), tostring(actual)), 2)
	end
end

local env = { game = game, require = requireModule, expectEqual = expectEqual, expectTrue = expectTrue, expectNear = expectNear }
local files = listDir(ROOT .. "/tests")
table.sort(files)
for _, file in files do
	if file:match("%.spec%.luau$") and (not FILTER or file:find(FILTER, 1, true)) then
		local suite = loadChunk(readFile(ROOT .. "/tests/" .. file), file, setmetatable(table.clone(env), { __index = _G }))()
		for _, case in suite do
			local ok, problem = xpcall(case.run, debug.traceback)
			if ok then
				passed += 1
			else
				failed += 1
				print(("FAIL %s :: %s\n%s"):format(file, case.name, tostring(problem)))
			end
		end
	end
end
print(("%d passed, %d failed"):format(passed, failed))
if failed > 0 then
	error("tests failed")
end
