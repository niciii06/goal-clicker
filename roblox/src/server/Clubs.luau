--!nonstrict
-- Club sessions on this server: each player's own club and shared coop worlds (up to 4 players).
-- A player always has an own club; while they play in a coop world their actions go there.
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared

local Actions = require(script.Parent.Actions)
local GameState = require(Shared.GameState)
local Store = require(script.Parent.Store)
local Sync = require(script.Parent.Sync)
local Util = require(Shared.Util)

local Clubs = {}

local PLAYER_STORE = "GoalClickerPlayersV1"
local COOP_STORE = "GoalClickerCoopV1"
local ROLES = { "host", "guest", "player3", "player4" }
local ROLE_LABELS = { host = "HOST", guest = "SPIELER 2", player3 = "SPIELER 3", player4 = "SPIELER 4" }

export type Viewer = {
	player: Player,
	own: any,
	profile: any,
	coopCode: string?,
	cache: { [string]: string },
	loadedAt: number,
}

local viewers: { [Player]: Viewer } = {}
local coopWorlds: { [string]: any } = {}
local random = Random.new()

local function rng(): number
	return random:NextNumber()
end

function Clubs.now(): number
	return DateTime.now().UnixTimestampMillis
end

local function encode(value: any): string
	return HttpService:JSONEncode(value)
end

------------------------------------------------------------------------------------------
-- Own clubs

function Clubs.load(player: Player): (Viewer?, string?)
	local key = tostring(player.UserId)
	local saved, problem = Store.acquire(PLAYER_STORE, key)
	if problem == "locked" then
		return nil, "Dein Spielstand ist noch auf einem anderen Server offen. Bitte in einer Minute erneut beitreten."
	elseif problem then
		return nil, "Der Spielstand konnte nicht geladen werden. Bitte später erneut versuchen."
	end
	local now = Clubs.now()
	local profile = (saved and saved.profile) or { coopCodes = {} }
	local game = GameState.normalize(saved and saved.game, now, rng)
	if saved and saved.game and saved.game.lastSaved then
		-- The club pauses while nobody plays, like the web version does when the tab is hidden.
		GameState.pauseTimers(game, now - saved.game.lastSaved, now)
	end
	game.lastSaved = now
	local session = Actions.newSession(game)
	session.memberName = function()
		return player.DisplayName
	end
	session.lastTick = now
	local viewer: Viewer = { player = player, own = session, profile = profile, coopCode = nil, cache = {}, loadedAt = now }
	viewers[player] = viewer
	return viewer, nil
end

function Clubs.saveOwn(viewer: Viewer, release: boolean?)
	local game = viewer.own.game
	game.lastSaved = Clubs.now()
	local ok = Store.save(PLAYER_STORE, tostring(viewer.player.UserId), { game = Sync.forSave(game), profile = viewer.profile }, release)
	if ok then
		Store.setRanking("GoalClickerTotalGoalsV1", tostring(viewer.player.UserId), game.totalGoals)
	end
end

function Clubs.viewer(player: Player): Viewer?
	return viewers[player]
end

-- The session the player currently acts on.
function Clubs.session(viewer: Viewer): any
	if viewer.coopCode and coopWorlds[viewer.coopCode] then
		return coopWorlds[viewer.coopCode].session
	end
	return viewer.own
end

------------------------------------------------------------------------------------------
-- Coop worlds

local function memberOf(world: any, userId: number): any?
	for _, member in world.members do
		if member.userId == userId then
			return member
		end
	end
	return nil
end

local function onlineMembers(world: any): { Player }
	local list = {}
	for player, viewer in viewers do
		if viewer.coopCode == world.code then
			table.insert(list, player)
		end
	end
	return list
end

local function refreshCoopView(world: any)
	local online = {}
	for _, player in onlineMembers(world) do
		online[player.UserId] = true
	end
	local members = {}
	for _, role in ROLES do
		local member = Util.find(world.members, function(item)
			return item.role == role
		end)
		table.insert(members, {
			role = role, label = ROLE_LABELS[role], name = member and member.name or nil, userId = member and member.userId or nil, occupied = member ~= nil,
			online = member ~= nil and online[member.userId] == true, goals = member and member.goals or 0, clicks = member and member.clicks or 0,
		})
	end
	world.session.coopView = {
		code = world.code, roomName = world.roomName, status = #world.members >= 2 and "live" or "waiting",
		playerCount = #world.members, maxPlayers = #ROLES, players = members,
	}
end

local function newCode(): string
	local alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	local parts = {}
	for _ = 1, 6 do
		local index = random:NextInteger(1, #alphabet)
		table.insert(parts, string.sub(alphabet, index, index))
	end
	return table.concat(parts)
end

local function coopSession(world: any): any
	local session = Actions.newSession(world.game)
	session.lastTick = Clubs.now()
	session.memberName = function(name)
		return name or "Ein Spieler"
	end
	world.session = session
	refreshCoopView(world)
	return session
end

local function rememberCode(viewer: Viewer, code: string)
	local codes = Util.filter(viewer.profile.coopCodes or {}, function(item)
		return item ~= code
	end)
	table.insert(codes, 1, code)
	viewer.profile.coopCodes = Util.slice(codes, 1, 12)
end

function Clubs.createCoop(viewer: Viewer, roomName: string): (boolean, string)
	if viewer.coopCode then
		return false, "Verlasse zuerst die aktuelle Koop-Welt."
	end
	local code = newCode()
	for _ = 1, 5 do
		if not coopWorlds[code] and not Store.peek(COOP_STORE, code) then
			break
		end
		code = newCode()
	end
	local _, problem = Store.acquire(COOP_STORE, code)
	if problem then
		return false, "Die Koop-Welt konnte nicht erstellt werden."
	end
	local now = Clubs.now()
	local world = {
		code = code,
		roomName = (roomName ~= "" and string.sub(roomName, 1, 28)) or "Meine Welt",
		members = { { userId = viewer.player.UserId, name = viewer.player.DisplayName, role = "host", goals = 0, clicks = 0 } },
		game = GameState.initial(now, rng),
	}
	coopWorlds[code] = world
	coopSession(world)
	viewer.coopCode = code
	rememberCode(viewer, code)
	refreshCoopView(world)
	Clubs.saveCoop(world, false)
	return true, ("Koop-Welt %s erstellt. Teile den Code mit deinen Freunden auf diesem Server."):format(code)
end

local function loadWorld(code: string): (any?, string?)
	if coopWorlds[code] then
		return coopWorlds[code], nil
	end
	local saved, problem = Store.acquire(COOP_STORE, code)
	if problem == "locked" then
		return nil, "Diese Koop-Welt ist gerade auf einem anderen Server offen. Tritt dem Server deiner Freunde bei."
	elseif problem then
		return nil, "Die Koop-Welt konnte nicht geladen werden."
	end
	if not saved then
		return nil, "Diese Koop-Welt gibt es nicht."
	end
	local now = Clubs.now()
	local world = { code = code, roomName = saved.roomName or "Meine Welt", members = saved.members or {}, game = GameState.normalize(saved.game, now, rng) }
	if saved.game and saved.game.lastSaved then
		GameState.pauseTimers(world.game, now - saved.game.lastSaved, now)
	end
	coopWorlds[code] = world
	coopSession(world)
	return world, nil
end

function Clubs.joinCoop(viewer: Viewer, rawCode: string): (boolean, string)
	local code = string.upper((string.gsub(rawCode, "[^%w]", "")))
	if #code ~= 6 then
		return false, "Der Code hat sechs Zeichen."
	end
	if viewer.coopCode == code then
		return true, ""
	end
	if viewer.coopCode then
		return false, "Verlasse zuerst die aktuelle Koop-Welt."
	end
	local world, problem = loadWorld(code)
	if not world then
		return false, problem or "Diese Koop-Welt gibt es nicht."
	end
	local member = memberOf(world, viewer.player.UserId)
	if not member then
		if #world.members >= #ROLES then
			Clubs.releaseIfEmpty(world)
			return false, "Diese Koop-Welt ist voll."
		end
		local taken = {}
		for _, item in world.members do
			taken[item.role] = true
		end
		local role = Util.find(ROLES, function(candidate)
			return not taken[candidate]
		end)
		member = { userId = viewer.player.UserId, name = viewer.player.DisplayName, role = role, goals = 0, clicks = 0 }
		table.insert(world.members, member)
	end
	member.name = viewer.player.DisplayName
	viewer.coopCode = code
	rememberCode(viewer, code)
	viewer.cache = {}
	refreshCoopView(world)
	return true, ("Willkommen in %s."):format(world.roomName)
end

function Clubs.leaveCoop(viewer: Viewer): (boolean, string)
	local code = viewer.coopCode
	if not code then
		return false, ""
	end
	viewer.coopCode = nil
	viewer.cache = {}
	local world = coopWorlds[code]
	if world then
		refreshCoopView(world)
		Clubs.releaseIfEmpty(world)
	end
	return true, "Zurück in deinem eigenen Club."
end

function Clubs.deleteCoop(viewer: Viewer): (boolean, string)
	local world = viewer.coopCode and coopWorlds[viewer.coopCode]
	if not world then
		return false, ""
	end
	local member = memberOf(world, viewer.player.UserId)
	if not member or member.role ~= "host" then
		return false, "Nur der Host kann die Welt zurücksetzen."
	end
	world.game = GameState.initial(Clubs.now(), rng)
	for _, item in world.members do
		item.goals, item.clicks = 0, 0
	end
	coopSession(world)
	for _, player in onlineMembers(world) do
		local other = viewers[player]
		if other then
			other.cache = {}
		end
	end
	return true, "Gemeinsamer Spielstand zurückgesetzt."
end

function Clubs.resetOwn(viewer: Viewer): (boolean, string)
	local now = Clubs.now()
	local game = GameState.initial(now, rng)
	game.sound = viewer.own.game.sound
	viewer.own.game = game
	viewer.own.miniGame = nil
	viewer.own.notices = {}
	viewer.cache = {}
	Clubs.saveOwn(viewer, false)
	return true, "Spielstand zurückgesetzt."
end

function Clubs.saveCoop(world: any, release: boolean)
	world.game.lastSaved = Clubs.now()
	Store.save(COOP_STORE, world.code, { roomName = world.roomName, members = world.members, game = Sync.forSave(world.game) }, release)
end

function Clubs.releaseIfEmpty(world: any)
	if #onlineMembers(world) == 0 then
		Clubs.saveCoop(world, true)
		coopWorlds[world.code] = nil
	end
end

function Clubs.memberStats(viewer: Viewer): any?
	local world = viewer.coopCode and coopWorlds[viewer.coopCode]
	return world and memberOf(world, viewer.player.UserId)
end

function Clubs.isCoopLive(viewer: Viewer): boolean
	local world = viewer.coopCode and coopWorlds[viewer.coopCode]
	return world ~= nil and #world.members >= 2
end

function Clubs.coopRole(viewer: Viewer): string?
	local member = Clubs.memberStats(viewer)
	return member and member.role
end

-- Saved worlds of a player for the coop lobby.
function Clubs.savedWorlds(viewer: Viewer): { any }
	local list = {}
	for _, code in viewer.profile.coopCodes or {} do
		local world = coopWorlds[code]
		local data = world or Store.peek(COOP_STORE, code)
		if data then
			table.insert(list, { code = code, roomName = data.roomName or "Meine Welt", players = #(data.members or {}), open = world ~= nil })
		end
	end
	return list
end

------------------------------------------------------------------------------------------
-- Ticks, notices and sync

function Clubs.allSessions(): { any }
	local list = {}
	for _, viewer in viewers do
		table.insert(list, viewer.own)
	end
	for _, world in coopWorlds do
		table.insert(list, world.session)
	end
	return list
end

function Clubs.tickAll(now: number)
	for _, session in Clubs.allSessions() do
		local elapsed = math.max(0, math.min(5000, now - (session.lastTick or now)))
		session.lastTick = now
		local ok, problem = pcall(Actions.tick, session, now, elapsed, rng)
		if not ok then
			warn("[Clubs] Tick fehlgeschlagen:", problem)
		end
	end
	for _, world in coopWorlds do
		refreshCoopView(world)
	end
end

-- Delivers notices of every session to the players looking at it.
function Clubs.flush(sendState: (Player, any) -> (), sendNotices: (Player, { any }) -> (), force: Player?)
	local now = Clubs.now()
	local noticesBySession: { [any]: { any } } = {}
	for _, session in Clubs.allSessions() do
		if #session.notices > 0 then
			noticesBySession[session] = session.notices
			session.notices = {}
		end
	end
	for player, viewer in viewers do
		local session = Clubs.session(viewer)
		local sections = Sync.sections(session, now)
		sections.serverNow = now
		local changed = Sync.diff(viewer.cache, sections, encode, force == player)
		if changed then
			changed.serverNow = now
			sendState(player, changed)
		end
		local notices = noticesBySession[session]
		if notices then
			sendNotices(player, notices)
		end
	end
end

function Clubs.remove(player: Player)
	local viewer = viewers[player]
	if not viewer then
		return
	end
	local code = viewer.coopCode
	viewer.coopCode = nil
	Clubs.saveOwn(viewer, true)
	viewers[player] = nil
	local world = code and coopWorlds[code]
	if world then
		refreshCoopView(world)
		Clubs.releaseIfEmpty(world)
	end
end

function Clubs.saveAll(release: boolean)
	for _, viewer in viewers do
		Clubs.saveOwn(viewer, release)
	end
	for _, world in coopWorlds do
		Clubs.saveCoop(world, release)
	end
end

function Clubs.random(): number
	return rng()
end

return Clubs
