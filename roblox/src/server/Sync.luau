--!strict
-- Builds what the client sees and only sends the parts that changed.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Economy = require(Shared.Economy)
local Monetization = require(Shared.Monetization)

local Sync = {}

local FEATURE_SECTIONS = {
	"starXI", "club", "seasonMode", "career", "transferSaga", "gazetteIssues", "history", "earnedPacks", "dailyRewards",
	"press", "missions", "goalBoost", "travel", "squadLock", "randomEvent", "starPackReveal", "transferMarket", "cup",
}

local function round1(value: number): number
	return math.floor(value * 10 + 0.5) / 10
end

local function lightPlayers(checkpoint: any): { any }
	local list = {}
	for _, p in checkpoint.players do
		table.insert(list, { p.id, round1(p.x), round1(p.y), p.active and 1 or 0, p.side == "club" and 1 or 0, p.role, p.number, p.name })
	end
	return list
end

local function lightAction(action: any): any
	return {
		id = action.id, kind = action.kind, start = action.start, finish = action.finish, side = action.side, actor = action.actor,
		target = action.target, outcome = action.outcome, from = { x = round1(action.from.x), y = round1(action.from.y) },
		to = { x = round1(action.to.x), y = round1(action.to.y) }, before = lightPlayers(action.before), after = lightPlayers(action.after),
	}
end

-- Actions around the current game time so the client can animate the pitch smoothly.
function Sync.matchView(cup: any): any?
	local sim = cup.simulation
	if not cup.active or not sim then
		return nil
	end
	local actions = {}
	for index = math.max(1, #sim.recent - 1), #sim.recent do
		table.insert(actions, lightAction(sim.recent[index]))
	end
	for index = 1, math.min(5, #sim.buffer) do
		table.insert(actions, lightAction(sim.buffer[index]))
	end
	return {
		generation = sim.generation, time = sim.time, status = sim.status, pauseRequested = sim.pauseRequested,
		direction = sim.committed.direction, committed = { ball = sim.committed.ball, players = lightPlayers(sim.committed) },
		actions = actions,
	}
end

local function cupView(cup: any): any
	local view = table.clone(cup)
	view.simulation = nil
	return view
end

function Sync.sections(session: any, now: number): { [string]: any }
	local game = session.game
	local features = game.features
	local multiplier = Monetization.goalMultiplier(session.passes)
	local sections: { [string]: any } = {
		core = {
			goals = game.goals, totalGoals = game.totalGoals, seasonGoals = game.seasonGoals, clicks = game.clicks,
			upgrades = game.upgrades, achievements = game.achievements, stars = game.stars, seasons = game.seasons,
			sound = game.sound, miniGameCooldowns = game.miniGameCooldowns, minigameWins = game.minigameWins,
			redeemedCodes = game.redeemedCodes, testMode = session.testMode, shopCredits = game.shopCredits,
			clickPower = Economy.clickPower(game.upgrades, game.stars, features, now) * multiplier,
			passivePower = Economy.passivePower(game.upgrades, game.stars, features, now) * multiplier,
		},
		miniGame = session.miniGame or false,
		coop = session.coopView or false,
	}
	for _, key in FEATURE_SECTIONS do
		local value = features[key]
		if key == "cup" then
			value = cupView(value)
		end
		if value == nil then
			sections[key] = false
		else
			sections[key] = value
		end
	end
	sections.match = Sync.matchView(features.cup) or false
	return sections
end

-- Returns only sections whose encoded form changed since the last call for this viewer.
function Sync.diff(cache: { [string]: string }, sections: { [string]: any }, encode: (any) -> string, force: boolean?): { [string]: any }?
	local changed: { [string]: any } = {}
	local any = false
	for key, value in sections do
		local encoded = encode(value)
		if force or cache[key] ~= encoded then
			cache[key] = encoded
			changed[key] = value
			any = true
		end
	end
	return any and changed or nil
end

-- What goes into the DataStore: the full state without rebuildable engine buffers.
function Sync.forSave(game: any): any
	local copy = table.clone(game)
	copy.features = table.clone(game.features)
	local cup = game.features.cup
	if cup.simulation then
		local cupCopy = table.clone(cup)
		local sim = table.clone(cup.simulation)
		sim.buffer = {}
		sim.recent = {}
		cupCopy.simulation = sim
		copy.features.cup = cupCopy
	end
	return copy
end

return Sync
