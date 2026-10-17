--!strict
-- Player match ratings (4.5 to 10), match clock and the live team strength.
local Broadcast = require(script.Parent.Broadcast)
local Cards = require(script.Parent.Cards)
local StarXI = require(script.Parent.StarXI)
local Util = require(script.Parent.Util)

local MatchRatings = {}

MatchRatings.MATCH_DURATION_MS = 240000
MatchRatings.RED_CARD_RATING_DROP = 6
MatchRatings.RED_CARD_MOMENTUM_DROP = 8
MatchRatings.MAX_MOMENTUM = 12
MatchRatings.MOMENTUM_WEIGHT = 0.45

local clamp = Util.clamp

function MatchRatings.regularDurationMs(cup: any): number
	local explicit = cup.regularDurationMs
	if explicit and explicit >= 180000 and explicit <= 300000 then
		return explicit
	end
	local total = math.max(0, cup.matchEndsAt - cup.matchStartedAt)
	if cup.phase == "regular" then
		return total >= 60000 and total or MatchRatings.MATCH_DURATION_MS
	end
	return total > 300000 and 360000 or 180000
end

-- Match minute 1 to 120; the interactive engine reports its own game clock.
function MatchRatings.minute(cup: any, now: number): number
	if cup.timedPause and cup.timedPause.kind == "halftime" then
		return 45
	end
	if not cup.matchStartedAt or cup.matchStartedAt == 0 then
		return 1
	end
	if cup.phase == "penalties" then
		return 120
	end
	if cup.simulation then
		return math.max(1, math.min(120, math.ceil(math.max(1, cup.simulation.time) / 60)))
	end
	local regular = MatchRatings.regularDurationMs(cup)
	local at = (cup.timedPause and cup.timedPause.frozenAt) or (((cup.matchPaused or cup.active == false) and cup.lastTickAt and cup.lastTickAt > 0) and cup.lastTickAt or now)
	local elapsed = math.max(0, math.min(at, cup.matchEndsAt) - cup.matchStartedAt)
	if cup.phase == "regular" or elapsed <= regular then
		return math.max(1, math.min(90, math.floor(elapsed / (regular / 90)) + 1))
	end
	return math.max(91, math.min(120, 90 + math.floor((elapsed - regular) / ((regular / 3) / 30)) + 1))
end

local function matchSeed(playerId: string, startedAt: number, salt: number): number
	local text = ("%s:%d:%d"):format(playerId, math.floor(startedAt / 1000), salt)
	return Util.fnv(text) / 4294967296
end

function MatchRatings.playerRating(playerId: string, startedAt: number, minute: number, goals: number, enteredAt: number, impact: number, position: string?): number
	local dayForm = (matchSeed(playerId, startedAt, 1) + matchSeed(playerId, startedAt, 2) + matchSeed(playerId, startedAt, 3)) / 3
	local targetRating = 5.7 + dayForm * 2.2
	local opening = 6.35 + (matchSeed(playerId, startedAt, 4) - 0.5) * 0.45
	local played = math.max(0, minute - enteredAt + 1)
	local progress = clamp(played / 75, 0, 1)
	local reveal = 0.12 + 0.88 * (1 - (1 - progress) ^ 1.15)
	local drift = (matchSeed(playerId, startedAt, 5) - 0.5) * 0.2 * math.sin(progress * math.pi)
	local goalBoost = math.min(1.8, math.max(0, goals) * 0.6)
	local stability = (position == "TW" or position == "IV") and 0.04 or 0
	return Util.round1(clamp(opening + (targetRating - opening) * reveal + drift + goalBoost + impact + stability, 4.5, 10))
end

local DEFENDERS = { IV = true, LV = true, LAV = true, RV = true, RAV = true }

function MatchRatings.cleanSheetValue(position: string?, share: number): number
	if position == "TW" then
		return share * 0.42
	end
	if position and DEFENDERS[position] then
		return share * 0.3
	end
	if position == "ZDM" then
		return share * 0.14
	end
	return 0
end

-- Live rating of one of the own players, nil when the player has not played.
function MatchRatings.cupPlayerRating(cup: any, playerId: string, minute: number): number?
	local entered = cup.playerEnteredAt[playerId]
	local card = Cards.get(playerId)
	if (card and card.benchOnly) or not entered or minute < entered then
		return nil
	end
	local effective = math.max(entered, math.min(minute, cup.playerExitedAt[playerId] or minute))
	local position = cup.playerMatchPositions[playerId] or (card and card.position)
	local impact, conceded = 0, 0
	for _, event in cup.matchEvents do
		if event.minute >= entered and event.minute <= effective then
			impact += event.ratingImpacts[playerId] or 0
			if event.side == "away" then
				conceded += 1
			end
		end
	end
	local share = clamp((effective - entered + 1) / 90, 0, 1)
	local clean = conceded == 0 and MatchRatings.cleanSheetValue(position, share) or 0
	return MatchRatings.playerRating(playerId, cup.careerRatingSeed or cup.matchStartedAt, effective, 0, entered, impact + clean + Broadcast.actionRating(cup, playerId, effective), position)
end

local function injuredSet(cup: any): { [string]: boolean }
	local set = {}
	for id, matches in cup.injuredPlayerIds or {} do
		if (tonumber(matches) or 0) > 0 then
			set[id] = true
		end
	end
	return set
end

-- Team strength during a match: card ratings, live form, cards, injuries and momentum.
function MatchRatings.effectiveTeamRating(ownedIds: { string }, lineupIds: { string }, cup: any, minute: number): number
	local sentOff = {}
	for _, id in cup.sentOffPlayerIds do
		sentOff[id] = true
	end
	local injured = injuredSet(cup)
	local starters = Util.filter(StarXI.selection(ownedIds, lineupIds), function(player)
		return not sentOff[player.id] and not injured[player.id]
	end)
	if #starters == 0 then
		return 55
	end
	local total = (Cards.SQUAD_SIZE - #starters) * 55
	for _, player in starters do
		local live = MatchRatings.cupPlayerRating(cup, player.id, minute) or 6.4
		total += math.min(100, player.rating + (cup.careerBonuses and cup.careerBonuses[player.id] or 0)) + (live - 6.5) * 2.8
	end
	local squad = Util.round1(total / Cards.SQUAD_SIZE)
	local momentum = (tonumber(cup.matchMomentum) or 0) * MatchRatings.MOMENTUM_WEIGHT
	return clamp(squad - Util.count(sentOff) * MatchRatings.RED_CARD_RATING_DROP - Util.count(injured) * 3 + momentum, 40, 100)
end

return MatchRatings
