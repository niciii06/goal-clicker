--!strict
-- Server entry: remotes, player lifecycle, the one second club tick and autosave.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TextService = game:GetService("TextService")

local Actions = require(script.Parent.Actions)
local Clubs = require(script.Parent.Clubs)
local Shop = require(script.Parent.Shop)
local Store = require(script.Parent.Store)
local Stadium = require(script.Parent.Stadium)

local remotes = Instance.new("Folder")
remotes.Name = "Remotes"
local function remote(className: string, name: string): any
	local item = Instance.new(className)
	item.Name = name
	item.Parent = remotes
	return item
end
local actionRemote = remote("RemoteFunction", "Action") :: RemoteFunction
local clickRemote = remote("RemoteEvent", "Click") :: RemoteEvent
local clickResult = remote("RemoteEvent", "ClickResult") :: RemoteEvent
local stateRemote = remote("RemoteEvent", "State") :: RemoteEvent
local noticeRemote = remote("RemoteEvent", "Notice") :: RemoteEvent
local queryRemote = remote("RemoteFunction", "Query") :: RemoteFunction
remotes.Parent = ReplicatedStorage

Stadium.build()

local function filterText(text: string, player: Player): string
	local ok, result = pcall(function()
		local filtered = TextService:FilterStringAsync(text, player.UserId)
		return filtered:GetNonChatStringForBroadcastAsync()
	end)
	if ok and type(result) == "string" then
		return result
	end
	return RunService:IsStudio() and text or "FC Goal"
end

local function flush(force: Player?)
	Clubs.flush(function(player, changed)
		stateRemote:FireClient(player, changed)
	end, function(player, notices)
		noticeRemote:FireClient(player, notices)
	end, force)
end

local function updateLeaderstats(player: Player)
	local viewer = Clubs.viewer(player)
	local stats = player:FindFirstChild("leaderstats")
	if not viewer or not stats then
		return
	end
	local goals = stats:FindFirstChild("Tore") :: NumberValue?
	local trophies = stats:FindFirstChild("Pokale") :: IntValue?
	local game = viewer.own.game
	if goals then
		goals.Value = math.floor(game.totalGoals)
	end
	if trophies then
		local total = 0
		for _, count in game.features.cup.trophies do
			total += count
		end
		trophies.Value = total
	end
end

local function onPlayerAdded(player: Player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local goals = Instance.new("NumberValue")
	goals.Name = "Tore"
	goals.Parent = stats
	local trophies = Instance.new("IntValue")
	trophies.Name = "Pokale"
	trophies.Parent = stats
	stats.Parent = player
	local viewer, problem = Clubs.load(player)
	if not viewer then
		player:Kick(problem or "Spielstand nicht verfügbar.")
		return
	end
	-- Game passes and the paid random item policy (web calls, each protected by pcall).
	local okShop, shopProblem = pcall(Shop.loadPlayer, player)
	if not okShop then
		warn("[Shop] Pässe konnten nicht geladen werden:", shopProblem)
	end
	if not Store.isPersistent() then
		noticeRemote:FireClient(player, { { kind = "toast", text = "Studio Testmodus: Spielstände werden nicht gespeichert." } })
	end
	-- Joined through a friend's invite: the launch data holds the coop world code.
	local okJoinData, joinData = pcall(function()
		return player:GetJoinData()
	end)
	local launchData = okJoinData and type(joinData) == "table" and joinData.LaunchData
	if type(launchData) == "string" and string.match(launchData, "^%w%w%w%w%w%w$") then
		local ok, message = Clubs.joinCoop(viewer, launchData)
		if message ~= "" then
			noticeRemote:FireClient(player, { { kind = "toast", text = ok and message or ("Einladung: " .. message) } })
		end
	end
	updateLeaderstats(player)
	flush(player)
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end

Players.PlayerRemoving:Connect(function(player)
	Clubs.remove(player)
	Shop.removePlayer(player)
end)

Shop.start({
	flush = function(player: Player?)
		flush(player)
	end,
	toast = function(player: Player, text: string)
		noticeRemote:FireClient(player, { { kind = "toast", text = text } })
	end,
})

-- Coop rules: shared actions need at least two members, like the web version.
local SOLO_ONLY = { createCoop = true, joinCoop = true, leaveCoop = true, savedWorlds = true }
local COOP_FREE = { redeemCode = true, toggleSound = true, saveClub = true, resetCoop = true }

-- At most 12 actions per second and player; clicks have their own limit in Actions.click.
local actionTimes: { [Player]: { number } } = {}
Players.PlayerRemoving:Connect(function(player)
	actionTimes[player] = nil
end)
local function allowAction(player: Player): boolean
	local now = os.clock()
	local times = actionTimes[player] or {}
	actionTimes[player] = times
	while #times > 0 and times[1] < now - 1 do
		table.remove(times, 1)
	end
	if #times >= 12 then
		return false
	end
	table.insert(times, now)
	return true
end

actionRemote.OnServerInvoke = function(player: Player, name: any, payload: any): (boolean, string)
	if type(name) ~= "string" then
		return false, ""
	end
	if not allowAction(player) then
		return false, "Etwas langsamer, bitte."
	end
	local viewer = Clubs.viewer(player)
	if not viewer then
		return false, "Dein Club wird noch geladen."
	end
	payload = type(payload) == "table" and payload or {}
	local now = Clubs.now()
	local ok, message
	if name == "createCoop" then
		ok, message = Clubs.createCoop(viewer, filterText(tostring(payload.roomName or ""), player))
	elseif name == "joinCoop" then
		ok, message = Clubs.joinCoop(viewer, tostring(payload.code or ""))
	elseif name == "leaveCoop" then
		ok, message = Clubs.leaveCoop(viewer)
	elseif name == "resetCoop" or name == "resetGame" then
		if viewer.coopCode then
			ok, message = Clubs.deleteCoop(viewer)
		else
			ok, message = Clubs.resetOwn(viewer)
		end
	elseif name == "saveClub" then
		local session = Clubs.session(viewer)
		ok, message = Actions.saveClub(session, payload, now, function(text)
			return filterText(text, player)
		end)
	elseif name == "claimDaily" then
		local session = Clubs.session(viewer)
		if viewer.coopCode and not Clubs.isCoopLive(viewer) then
			return false, "Warte, bis der zweite Spieler beigetreten ist."
		end
		ok, message = Actions.claimDaily(session, Clubs.coopRole(viewer) or "solo", now)
	elseif name == "claimMission" and not viewer.coopCode then
		return false, "Missionen gibt es in Koop-Welten."
	else
		if SOLO_ONLY[name] then
			return false, ""
		end
		if viewer.coopCode and not COOP_FREE[name] and not Clubs.isCoopLive(viewer) then
			return false, "Warte, bis der zweite Spieler beigetreten ist."
		end
		local session = Clubs.session(viewer)
		session.memberName = function(given)
			return given or player.DisplayName
		end
		local success, result, text = pcall(Actions.run, session, name, payload, now, Clubs.random)
		if not success then
			warn("[Action]", name, result)
			return false, "Das hat nicht geklappt. Bitte erneut versuchen."
		end
		ok, message = result, text
	end
	flush()
	return ok, message or ""
end

local function handleClick(player: Player)
	local viewer = Clubs.viewer(player)
	if not viewer then
		return
	end
	if viewer.coopCode and not Clubs.isCoopLive(viewer) then
		return
	end
	local session = Clubs.session(viewer)
	local amount, critical, combo = Actions.click(session, Clubs.now(), Clubs.random)
	if amount then
		local member = Clubs.memberStats(viewer)
		if member then
			member.goals += amount
			member.clicks += 1
		end
		clickResult:FireClient(player, amount, critical, combo)
	end
end
clickRemote.OnServerEvent:Connect(handleClick)

local stadiumBall = workspace:FindFirstChild("Stadium") and workspace.Stadium:FindFirstChild("GoalBall")
local detector = stadiumBall and stadiumBall:FindFirstChildOfClass("ClickDetector")
if detector then
	detector.MouseClick:Connect(handleClick)
end

queryRemote.OnServerInvoke = function(player: Player, name: any): any
	local viewer = Clubs.viewer(player)
	if not viewer then
		return nil
	end
	if name == "fullSync" then
		viewer.cache = {}
		task.defer(flush, player)
		return true
	elseif name == "savedWorlds" then
		return Clubs.savedWorlds(viewer)
	elseif name == "ranking" then
		local entries = {}
		for index, entry in Store.topRanking("GoalClickerTotalGoalsV1", 20) do
			local userId = tonumber(entry.key)
			local ok, username = pcall(function()
				return Players:GetNameFromUserIdAsync(userId :: number)
			end)
			table.insert(entries, { rank = index, name = ok and username or ("Spieler " .. entry.key), goals = entry.value, vip = userId ~= nil and Shop.isVip(userId) })
		end
		return entries
	end
	return nil
end

-- One second tick for every club followed by the state sync (actions sync right away).
local tickAccumulator, saveAccumulator = 0, 0
RunService.Heartbeat:Connect(function(dt)
	tickAccumulator += dt
	saveAccumulator += dt
	if tickAccumulator >= 1 then
		tickAccumulator = 0
		Clubs.tickAll(Clubs.now())
		for _, player in Players:GetPlayers() do
			updateLeaderstats(player)
		end
		flush()
	end
	if saveAccumulator >= 60 then
		saveAccumulator = 0
		task.spawn(Clubs.saveAll, false)
	end
end)

game:BindToClose(function()
	Clubs.saveAll(true)
end)
