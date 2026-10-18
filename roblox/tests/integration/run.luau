-- Integration test with Lune (https://lune-org.github.io): loads the built place, runs the
-- server and the client scripts in one process with a small fake engine, then plays the game
-- through the UI (clicks, packs, lineup, a full league match, every screen).
-- Usage: lune run tests/integration/run.luau <place.rbxl>
local fs = require("@lune/fs")
local luau = require("@lune/luau")
local process = require("@lune/process")
local roblox = require("@lune/roblox")
local serde = require("@lune/serde")
local task = require("@lune/task")

local placePath = process.args[1] or "build/GoalClicker.rbxl"
local place = roblox.deserializePlace(fs.readFile(placePath))

local failures = {}
local warnings = {}
local function fail(message)
	table.insert(failures, message)
	print("FAIL: " .. message)
end

------------------------------------------------------------------------------------------
-- Fake clock

local clockMs = 1767225600000 -- 2026-01-01
local DateTime = {}
DateTime.__index = DateTime
function DateTime.now()
	return setmetatable({ UnixTimestampMillis = clockMs }, DateTime)
end
function DateTime.fromUnixTimestampMillis(ms)
	return setmetatable({ UnixTimestampMillis = ms }, DateTime)
end
function DateTime:FormatLocalTime(_format, _locale)
	local seconds = math.floor(self.UnixTimestampMillis / 1000)
	return string.format("%02d:%02d", (seconds // 3600) % 24, (seconds // 60) % 60)
end

------------------------------------------------------------------------------------------
-- Signals

local Signal = {}
Signal.__index = Signal
function Signal.new(name)
	return setmetatable({ name = name, handlers = {} }, Signal)
end
function Signal:Connect(handler)
	local entry = { handler = handler, connected = true }
	table.insert(self.handlers, entry)
	return {
		Connected = true,
		Disconnect = function()
			entry.connected = false
		end,
	}
end
function Signal:Once(handler)
	local connection
	connection = self:Connect(function(...)
		connection.Disconnect()
		handler(...)
	end)
	return connection
end
function Signal:Fire(...)
	for _, entry in table.clone(self.handlers) do
		if entry.connected then
			local ok, problem = pcall(entry.handler, ...)
			if not ok then
				fail(("%s handler: %s"):format(self.name, tostring(problem)))
			end
		end
	end
end
function Signal:Wait()
	return task.wait()
end

local EVENTS = {
	Activated = true, MouseButton1Click = true, FocusLost = true, Changed = true, MouseClick = true,
	OnServerEvent = true, OnClientEvent = true, InputBegan = true, MouseEnter = true, MouseLeave = true,
}
local CALLBACKS = { OnServerInvoke = true, OnClientInvoke = true }
-- Properties computed by the engine at runtime (not part of the serialized reflection data).
local COMPUTED = {
	AbsolutePosition = roblox.Vector2.new(0, 0), AbsoluteSize = roblox.Vector2.new(400, 300), AbsoluteWindowSize = roblox.Vector2.new(400, 300),
	TextBounds = roblox.Vector2.new(100, 20), AbsoluteCanvasSize = roblox.Vector2.new(400, 300),
}

------------------------------------------------------------------------------------------
-- Instance proxies around real Lune instances (properties are validated by Lune).

local proxies = setmetatable({}, { __mode = "k" })
local wrap
local Proxy = {}

local function unwrap(value)
	if type(value) == "table" and rawget(value, "__real") then
		return rawget(value, "__real")
	end
	return value
end

local methods = {}
function methods:FindFirstChild(name)
	return wrap(rawget(self, "__real"):FindFirstChild(name))
end
function methods:WaitForChild(name)
	local child = rawget(self, "__real"):FindFirstChild(name)
	if not child then
		error("WaitForChild would wait forever: " .. tostring(name))
	end
	return wrap(child)
end
function methods:FindFirstChildOfClass(className)
	return wrap(rawget(self, "__real"):FindFirstChildOfClass(className))
end
function methods:FindFirstChildWhichIsA(className)
	return wrap(rawget(self, "__real"):FindFirstChildWhichIsA(className))
end
function methods:GetChildren()
	local list = {}
	for _, child in rawget(self, "__real"):GetChildren() do
		table.insert(list, wrap(child))
	end
	return list
end
function methods:GetDescendants()
	local list = {}
	for _, child in rawget(self, "__real"):GetDescendants() do
		table.insert(list, wrap(child))
	end
	return list
end
function methods:IsA(className)
	return rawget(self, "__real"):IsA(className)
end
function methods:Destroy()
	rawget(self, "__destroyed").value = true
	for _, child in rawget(self, "__real"):GetDescendants() do
		local proxy = proxies[child]
		if proxy then
			rawget(proxy, "__destroyed").value = true
		end
	end
	rawget(self, "__real").Parent = nil
end
function methods:ClearAllChildren()
	for _, child in self:GetChildren() do
		child:Destroy()
	end
end
function methods:GetPropertyChangedSignal(name)
	local signals = rawget(self, "__propertySignals")
	signals[name] = signals[name] or Signal.new("PropertyChanged:" .. name)
	return signals[name]
end
function methods:GetFullName()
	return rawget(self, "__real"):GetFullName()
end
-- Remote objects talk to each other directly in this single process.
function methods:FireServer(...)
	Proxy.event(self, "OnServerEvent"):Fire(Proxy.localPlayer, ...)
end
function methods:FireClient(_player, ...)
	Proxy.event(self, "OnClientEvent"):Fire(...)
end
function methods:FireAllClients(...)
	Proxy.event(self, "OnClientEvent"):Fire(...)
end
function methods:InvokeServer(...)
	local callback = rawget(self, "__callbacks").OnServerInvoke
	if not callback then
		error("No OnServerInvoke for " .. self.Name)
	end
	return callback(Proxy.localPlayer, ...)
end
function methods:Kick(message)
	fail("Player kicked: " .. tostring(message))
end
function methods:CaptureFocus() end
function methods:ReleaseFocus() end

function Proxy.event(self, name)
	local events = rawget(self, "__events")
	events[name] = events[name] or Signal.new(name)
	return events[name]
end

local function isDestroyed(self)
	return rawget(self, "__destroyed").value
end

local overrides = {}

Proxy.__index = function(self, key)
	local override = rawget(self, "__overrides")[key]
	if override ~= nil then
		return override
	end
	if methods[key] then
		return methods[key]
	end
	if EVENTS[key] then
		return Proxy.event(self, key)
	end
	if CALLBACKS[key] then
		return rawget(self, "__callbacks")[key]
	end
	local real = rawget(self, "__real")
	if key == "Parent" then
		if isDestroyed(self) then
			return nil
		end
		return wrap(real.Parent)
	end
	local ok, value = pcall(function()
		return real[key]
	end)
	if not ok and COMPUTED[key] then
		return COMPUTED[key]
	end
	if not ok then
		local child = real:FindFirstChild(key)
		if child then
			return wrap(child)
		end
		error(("%s is not a valid member of %s"):format(tostring(key), real.ClassName), 2)
	end
	if typeof(value) == "Instance" then
		return wrap(value)
	end
	return value
end

Proxy.__newindex = function(self, key, value)
	if CALLBACKS[key] then
		rawget(self, "__callbacks")[key] = value
		return
	end
	if rawget(self, "__overrides")[key] ~= nil then
		rawget(self, "__overrides")[key] = value
		return
	end
	local real = rawget(self, "__real")
	if key == "Parent" and value ~= nil and type(value) == "table" and rawget(value, "__virtualParent") then
		real.Parent = rawget(value, "__real")
		return
	end
	local ok, problem = pcall(function()
		real[key] = unwrap(value)
	end)
	if not ok then
		error(("Cannot set %s.%s = %s: %s"):format(real.ClassName, tostring(key), tostring(value), tostring(problem)), 2)
	end
	if key == "Parent" and value ~= nil then
		rawget(self, "__destroyed").value = false
	end
	local signal = rawget(self, "__propertySignals")[key]
	if signal then
		signal:Fire()
	end
end

Proxy.__tostring = function(self)
	return rawget(self, "__real").Name
end

wrap = function(real, extra)
	if real == nil then
		return nil
	end
	local existing = proxies[real]
	if existing then
		return existing
	end
	local proxy = setmetatable({
		__real = real, __events = {}, __callbacks = {}, __propertySignals = {}, __overrides = extra or {}, __destroyed = { value = false },
	}, Proxy)
	proxies[real] = proxy
	return proxy
end

local function typeofValue(value)
	if type(value) == "table" and rawget(value, "__real") then
		return "Instance"
	end
	if type(value) == "table" and getmetatable(value) == Signal then
		return "RBXScriptSignal"
	end
	return typeof(value)
end

local InstanceLib = {
	new = function(className, parent)
		local real = roblox.Instance.new(className)
		local proxy = wrap(real)
		if parent then
			proxy.Parent = parent
		end
		return proxy
	end,
}

------------------------------------------------------------------------------------------
-- Fake services

local runService = { Heartbeat = Signal.new("Heartbeat"), RenderStepped = Signal.new("RenderStepped"), Stepped = Signal.new("Stepped") }
function runService:IsStudio()
	return true
end
function runService:IsServer()
	return true
end
function runService:IsClient()
	return true
end

local tweenService = {}
function tweenService:Create(instance, _info, goals)
	return {
		Play = function()
			for key, value in goals do
				instance[key] = value
			end
		end,
		Cancel = function() end,
		Completed = Signal.new("TweenCompleted"),
	}
end

local userInputService = { TouchEnabled = false, KeyboardEnabled = true, InputBegan = Signal.new("InputBegan") }
function userInputService:GetMouseLocation()
	return roblox.Vector2.new(640, 360)
end

local soundService = wrap(roblox.Instance.new("SoundService"))
rawget(soundService, "__overrides").PlayLocalSound = function() end

local httpService = {}
function httpService:JSONEncode(value)
	return serde.encode("json", value)
end
function httpService:JSONDecode(text)
	return serde.decode("json", text)
end
function httpService:GenerateGUID()
	return "guid"
end

local textService = {}
function textService:FilterStringAsync(text)
	return {
		GetNonChatStringForBroadcastAsync = function()
			return text
		end,
	}
end

local dataStoreService = {}
function dataStoreService:GetDataStore()
	error("DataStore not available in tests")
end
function dataStoreService:GetOrderedDataStore()
	error("DataStore not available in tests")
end

local workspaceReal = place:GetService("Workspace")
local camera = { ViewportSize = roblox.Vector2.new(1280, 720), CFrame = roblox.CFrame.new(), CameraType = roblox.Enum.CameraType.Custom }
function camera:GetPropertyChangedSignal()
	return Signal.new("Camera")
end
local workspaceProxy = wrap(workspaceReal, { CurrentCamera = camera })

local playersService = { PlayerAdded = Signal.new("PlayerAdded"), PlayerRemoving = Signal.new("PlayerRemoving"), list = {} }
function playersService:GetPlayers()
	return table.clone(self.list)
end
function playersService:GetNameFromUserIdAsync(id)
	return "Spieler" .. tostring(id)
end

local services = {
	RunService = runService,
	TweenService = tweenService,
	UserInputService = userInputService,
	SoundService = soundService,
	HttpService = httpService,
	TextService = textService,
	DataStoreService = dataStoreService,
	Players = playersService,
	Workspace = workspaceProxy,
}

local game = {
	JobId = "",
	PlaceId = 0,
	BindToClose = function() end,
}
function game:GetService(name)
	if services[name] then
		return services[name]
	end
	local real = place:GetService(name)
	services[name] = wrap(real)
	return services[name]
end
setmetatable(game, {
	__index = function(_, key)
		local service = game:GetService(key)
		return service
	end,
})

-- The local player with a PlayerGui container.
local playerReal = roblox.Instance.new("Player")
playerReal.Name = "Tester"
local player = wrap(playerReal, { UserId = 4242, DisplayName = "Tester" })
local playerGui = roblox.Instance.new("Folder")
playerGui.Name = "PlayerGui"
playerGui.Parent = playerReal
Proxy.localPlayer = player
playersService.LocalPlayer = player

------------------------------------------------------------------------------------------
-- Module loader

local moduleCache = {}
-- os.clock advances a little with every call so rate limits see a human pace.
local fakeClock = 0
local fakeOs = setmetatable({ clock = function()
	fakeClock += 0.2
	return fakeClock
end }, { __index = os })
local function makeEnv(scriptProxy)
	local env = {
		game = game, workspace = workspaceProxy, script = scriptProxy, Instance = InstanceLib, DateTime = DateTime, task = task,
		typeof = typeofValue, tick = fakeOs.clock, os = fakeOs, warn = function(...)
			local parts = {}
			for _, part in { ... } do
				table.insert(parts, tostring(part))
			end
			local text = table.concat(parts, " ")
			table.insert(warnings, text)
			print("WARN: " .. text)
		end,
		Random = { new = function(seed)
			local state = seed or 12345
			local function nextValue()
				state = (state * 1103515245 + 12345) % 2147483648
				return state / 2147483648
			end
			return { NextNumber = function()
				return nextValue()
			end, NextInteger = function(_, low, high)
				return low + math.floor(nextValue() * (high - low + 1))
			end }
		end },
	}
	for _, name in { "Vector2", "Vector3", "UDim", "UDim2", "Color3", "CFrame", "Enum", "BrickColor", "NumberSequence", "NumberSequenceKeypoint", "ColorSequence", "ColorSequenceKeypoint", "NumberRange", "Rect", "Font", "TweenInfo", "PhysicalProperties", "Ray", "Region3", "Faces", "Axes" } do
		env[name] = roblox[name]
	end
	if not env.TweenInfo then
		env.TweenInfo = { new = function(...)
			return { ... }
		end }
	end
	env.require = function(target)
		local real = unwrap(target)
		if moduleCache[real] ~= nil then
			return moduleCache[real]
		end
		if real.ClassName ~= "ModuleScript" then
			error("require on " .. real.ClassName)
		end
		local chunk = luau.load(real.Source, { debugName = real:GetFullName(), environment = makeEnv(target) })
		local result = chunk()
		moduleCache[real] = result
		return result
	end
	return setmetatable(env, { __index = _G })
end

local function runScript(real)
	local chunk = luau.load(real.Source, { debugName = real:GetFullName(), environment = makeEnv(wrap(real)) })
	local ok, problem = pcall(chunk)
	if not ok then
		fail("Script " .. real:GetFullName() .. ": " .. tostring(problem))
	end
end

------------------------------------------------------------------------------------------
-- Boot server and client

local serverMain = place:GetService("ServerScriptService").Server.Main
runScript(serverMain)
table.insert(playersService.list, player)
playersService.PlayerAdded:Fire(player)

local clientMain = place:GetService("StarterPlayer").StarterPlayerScripts.Client.Main
runScript(clientMain)

local function step(seconds)
	for _ = 1, seconds do
		clockMs += 1000
		runService.Heartbeat:Fire(1)
		runService.RenderStepped:Fire(0.2)
		task.wait()
	end
end

local function gui()
	return playerGui:FindFirstChild("GoalClicker")
end

local function buttons()
	local list = {}
	local root = gui()
	if not root then
		return list
	end
	for _, item in root:GetDescendants() do
		if item:IsA("TextButton") then
			table.insert(list, item)
		end
	end
	return list
end

local function press(text, optional)
	local list = buttons()
	local target = nil
	for _, button in list do
		if button.Text == text then
			target = button
			break
		end
	end
	if not target then
		for _, button in list do
			if string.find(button.Text, text, 1, true) then
				target = button
				break
			end
		end
	end
	if target then
		wrap(target).Activated:Fire()
		task.wait()
		task.wait()
		return true
	end
	if not optional then
		fail("Button not found: " .. text)
	end
	return false
end

-- Presses a button inside the card that also shows the marker text (for screens with
-- several buttons of the same label, for example season and tournament travel).
local function pressWithin(marker, text)
	for _, button in buttons() do
		if button.Text == text then
			local card = button.Parent
			-- Walk up to the smallest container that holds the marker; it must not hold
			-- another button with the same label, otherwise it is the shared screen.
			while card and card ~= gui() do
				local hasMarker, sameButtons = false, 0
				for _, item in card:GetDescendants() do
					if item:IsA("TextLabel") and string.find(item.Text, marker, 1, true) then
						hasMarker = true
					elseif item:IsA("TextButton") and item.Text == text then
						sameButtons += 1
					end
				end
				if sameButtons > 1 then
					break
				end
				if hasMarker then
					wrap(button).Activated:Fire()
					task.wait()
					task.wait()
					return true
				end
				card = card.Parent
			end
		end
	end
	fail("Button not found: " .. text .. " in " .. marker)
	return false
end

local function screenText()
	local parts = {}
	local root = gui()
	if root then
		for _, item in root:GetDescendants() do
			if item:IsA("TextLabel") or item:IsA("TextButton") then
				table.insert(parts, item.Text)
			end
		end
	end
	return table.concat(parts, "\n")
end

local function checkScreen(name)
	task.wait()
	task.wait()
	local text = screenText()
	if string.find(text, "konnte nicht geladen werden", 1, true) then
		fail(name .. " shows an error: " .. text:match("konnte nicht geladen werden[^\n]*"))
	end
	return text
end

step(2)
if process.env.DEBUG_UI then
	print(screenText())
	local root = gui()
	print(root and #root:GetDescendants())
end
if not gui() then
	fail("No ScreenGui created")
end
local home = checkScreen("Home")
if not string.find(home, "GOAL CLICKER ARENA", 1, true) then
	fail("Home screen not rendered")
end

-- Click the ball 30 times.
for _ = 1, 30 do
	press("⚽", false)
end
step(1)

-- Give the club money through the server session, then play through the screens.
local Clubs = makeEnv(nil).require(wrap(place:GetService("ServerScriptService").Server.Clubs))
local viewer = Clubs.viewer(player)
if not viewer then
	fail("Server has no viewer for the player")
else
	if viewer.own.game.clicks < 20 then
		fail("Clicks did not reach the server: " .. tostring(viewer.own.game.clicks))
	end
	viewer.own.game.goals = 2e9
end
step(1)

press("x10")
for _, tab in { "Spiele", "Kader", "Karriere", "Packs & Album", "Club & Mehr", "Home" } do
	press(tab)
	checkScreen(tab)
end

press("Packs & Album")
for _ = 1, 90 do
	press("Pack öffnen")
	press("Überspringen", true)
	press("Weiter", true)
end
step(1)
press("Sammelalbum")
checkScreen("Album")
press("Kader")
press("Beste Elf")
checkScreen("Kader nach Beste Elf")
press("Formation wählen")
press("4-4-2")
checkScreen("Formation")

press("Spiele")
local matches = checkScreen("Spiele")
if not string.find(matches, "Match starten", 1, true) then
	fail("No start button on the matches screen")
end
press("Match starten")
step(3)
local live = checkScreen("Live")
if process.env.DEBUG_UI then
	print(live)
end
if not string.find(live, "LIVETICKER", 1, true) then
	fail("Live match view missing")
end
-- Play the match to the end, resuming after halftime or injuries.
local finished = false
for _ = 1, 600 do
	step(1)
	local cup = viewer and viewer.own.game.features.cup
	if cup and not cup.active then
		finished = true
		break
	end
	if cup and cup.matchPaused then
		press("Weiterspielen", true)
	end
	if cup and cup.phase == "penalties" then
		press("Links", true)
	end
end
if not finished then
	fail("League match did not finish")
end
step(2)
local after = checkScreen("Nach dem Spiel")
if not string.find(after, "SPIELBERICHT", 1, true) then
	fail("Post match report missing")
end
if string.find(after, "PRESSEKONFERENZ", 1, true) then
	press("Pressekonferenz", true)
end
press("Weiter", true)
for _, tab in { "Karriere", "Club & Mehr" } do
	press(tab)
	checkScreen(tab)
end
for _, sub in { "Fabrizio", "Missionen", "Verlauf", "Mehr", "Club" } do
	press(sub)
	checkScreen("Club/" .. sub)
end
press("Home")
press("Starten")
press("← Links", true)
checkScreen("Minigame")

-- Second matchday is away: travel first, then play in 3D.
press("Spiele")
pressWithin("SAISONMODUS", "Reise antreten")
step(2)
local journey = viewer.own.game.features.travel.journey
if not journey then
	fail("Journey did not start")
else
	local seconds = math.ceil((journey.endsAt - clockMs) / 1000) + 2
	step(seconds)
	checkScreen("Reise angekommen")
	press("Match starten")
	step(2)
	press("3D im Stadion")
	step(5)
	if not workspaceReal:FindFirstChild("LiveMatch") then
		fail("3D match view did not create the pitch players")
	end
	press("2D Ansicht", true)
	for _ = 1, 600 do
		step(1)
		local cup = viewer.own.game.features.cup
		if not cup.active then
			break
		end
		if cup.matchPaused then
			press("Weiterspielen", true)
		end
	end
	if viewer.own.game.features.cup.active then
		fail("Away match did not finish")
	end
end

-- Codes and the legendary walkout.
press("Club & Mehr")
press("Mehr")
for _, item in gui():GetDescendants() do
	if item:IsA("TextBox") and item.PlaceholderText == "Code eingeben" then
		wrap(item).Text = "silvan"
	end
end
press("Einlösen")
step(1)
if not table.find(viewer.own.game.features.starXI.ownedIds, "star-silvuz") then
	fail("SILVAN code did not add Silvuz")
end
step(12)
press("Weiter", true)

-- Tournament run with the test money (season 1 unlocks the Stadionpokal).
press("Spiele")
press("Reise antreten", true)
local tournamentJourney = viewer.own.game.features.travel.journey
if tournamentJourney and not tournamentJourney.consumed then
	step(math.ceil((tournamentJourney.endsAt - clockMs) / 1000) + 2)
	press("Match starten", true)
end
for _ = 1, 700 do
	step(1)
	local cup = viewer.own.game.features.cup
	if not cup.active then
		break
	end
	if cup.matchPaused then
		press("Weiterspielen", true)
	end
	if cup.phase == "penalties" then
		press("Links", true)
	end
end
checkScreen("Nach Turnierspiel")
local reports = #viewer.own.game.features.career.reports
if reports < 3 then
	fail("Expected three played matches (league home, league away, tournament), got " .. reports)
end
if viewer.own.game.features.cup.mode ~= "tournament" then
	fail("The tournament match did not run")
end

-- Coop: a second player joins the world on the same server.
press("Koop Multiplayer")
checkScreen("Koop Lobby")
press("Welt erstellen")
step(1)
local code = viewer.coopCode
if not code then
	fail("Coop world was not created")
else
	local secondReal = roblox.Instance.new("Player")
	secondReal.Name = "Friend"
	-- The friend arrives through a Roblox invite that carries the world code.
	local second = wrap(secondReal, { UserId = 777, DisplayName = "Friend", GetJoinData = function()
		return { LaunchData = code }
	end })
	table.insert(playersService.list, second)
	playersService.PlayerAdded:Fire(second)
	step(2)
	local friend = Clubs.viewer(second)
	if not friend or friend.coopCode ~= code then
		fail("Invited friend did not land in the coop world")
	end
	for _ = 1, 10 do
		press("⚽")
	end
	step(1)
	local world = Clubs.session(viewer)
	if world.game.clicks < 5 then
		fail("Coop clicks did not count: " .. tostring(world.game.clicks))
	end
	press("Home")
	local coopHome = checkScreen("Koop Home")
	if not string.find(coopHome, code, 1, true) then
		fail("Coop bar missing on home")
	end
	if not string.find(coopHome, "Roblox Freunde einladen", 1, true) then
		fail("Invite button missing on home")
	end
	press("Singleplayer")
	step(1)
	if viewer.coopCode then
		fail("Leaving the coop world failed")
	end
end

for _, text in warnings do
	if string.find(text, "failed", 1, true) or string.find(text, "Fehl", 1, true) then
		fail("Warning: " .. text)
	end
end

if #failures > 0 then
	print(("%d problems"):format(#failures))
	process.exit(1)
end
print("Integration test passed")
