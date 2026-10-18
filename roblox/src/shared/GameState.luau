--!strict
-- The complete save of a club (singleplayer or a shared coop world).
local Economy = require(script.Parent.Economy)
local Features = require(script.Parent.Features)
local MiniGames = require(script.Parent.MiniGames)
local Season = require(script.Parent.Season)
local Util = require(script.Parent.Util)

local GameState = {}

GameState.VERSION = 1

function GameState.initial(now: number, random: () -> number): any
	return {
		version = GameState.VERSION,
		goals = 0,
		totalGoals = 0,
		seasonGoals = 0,
		clicks = 0,
		upgrades = {},
		achievements = {},
		stars = 0,
		seasons = 0,
		sound = true,
		lastSaved = now,
		miniGameCooldowns = MiniGames.initialCooldowns(),
		minigameWins = 0,
		redeemedCodes = {},
		-- Paid products that could not act yet (no journey running, no mini game cooling down).
		shopCredits = { finishTravel = 0, miniGameReady = 0 },
		features = Features.initial(now, random),
	}
end

-- Fills fields that are missing in older saves with their defaults (recursively for records).
local function fillDefaults(target: any, defaults: any)
	for key, value in defaults do
		if target[key] == nil then
			target[key] = Util.deepCopy(value)
		elseif type(value) == "table" and type(target[key]) == "table" and next(value) ~= nil and value[1] == nil then
			fillDefaults(target[key], value)
		end
	end
end

function GameState.normalize(saved: any, now: number, random: () -> number): any
	local fresh = GameState.initial(now, random)
	if type(saved) ~= "table" then
		return fresh
	end
	fillDefaults(saved, fresh)
	saved.goals = math.max(0, tonumber(saved.goals) or 0)
	saved.totalGoals = math.max(0, tonumber(saved.totalGoals) or 0)
	local club = saved.features.club
	if club and club.name == Features.OLD_DEFAULT_CLUB_NAME then
		club.name = Features.DEFAULT_CLUB_NAME
		Season.renameClub(saved.features.seasonMode, club.name)
	end
	saved.stars = math.min(Economy.MAX_SEASON_STARS, math.max(0, math.floor(tonumber(saved.stars) or 0)))
	for id, level in saved.upgrades do
		local upgrade = Economy.upgrade(id)
		if not upgrade then
			saved.upgrades[id] = nil
		elseif upgrade.kind == "multiplier" then
			saved.upgrades[id] = math.min(Economy.MAX_MULTIPLIER_LEVEL, math.max(0, math.floor(level)))
		end
	end
	return saved
end

-- Time the club was closed: timers and an unfinished match continue where they stopped.
function GameState.pauseTimers(game: any, pausedMs: number, now: number)
	local duration = math.max(0, math.floor(pausedMs))
	if duration <= 0 then
		return
	end
	local pausedAt = now - duration
	local features = game.features
	features.nextEventAt += duration
	features.nextVarAt += duration
	features.transferSaga.nextAt += duration
	if features.squadLock then
		-- Remaining times are stored relative; nothing to shift.
	end
	for id, untilAt in game.miniGameCooldowns do
		if untilAt > pausedAt then
			game.miniGameCooldowns[id] = untilAt + duration
		end
	end
	if features.goalBoost.endsAt > pausedAt then
		features.goalBoost.startedAt += duration
		features.goalBoost.endsAt += duration
	end
	if features.cup.active then
		local Cup = require(script.Parent.Cup)
		Cup.shiftTimeline(features.cup, duration)
	end
end

-- Newly reached achievements (ids) for the total goal count.
function GameState.newAchievements(game: any): { any }
	local unlocked = {}
	for _, achievement in Economy.ACHIEVEMENTS do
		if game.totalGoals >= achievement.threshold and not table.find(game.achievements, achievement.id) then
			table.insert(game.achievements, achievement.id)
			table.insert(unlocked, achievement)
		end
	end
	return unlocked
end

function GameState.addGoals(game: any, amount: number)
	game.goals = math.max(0, game.goals + amount)
	game.seasonGoals = math.max(0, game.seasonGoals + amount)
	game.totalGoals = math.max(0, game.totalGoals + math.max(0, amount))
end

return GameState
