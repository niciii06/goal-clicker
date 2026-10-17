--!strict
-- Match broadcast data: generated opponent eleven, shirt numbers, fitness, statistics and events.
local Cards = require(script.Parent.Cards)
local Util = require(script.Parent.Util)

local Broadcast = {}

function Broadcast.emptyStats(): any
	return { shots = 0, onTarget = 0, saves = 0, corners = 0, freeKicks = 0, throwIns = 0, yellowCards = 0, possessionSeconds = 0, offsides = 0 }
end

function Broadcast.matchSeed(cup: any): string
	return cup.careerMatchId or ("%s:%s"):format(tostring(cup.careerRatingSeed or cup.matchStartedAt), cup.opponent)
end

function Broadcast.goalPattern(id: string, role: string): string
	local patterns
	if role == "IV" then
		patterns = { "header", "corner" }
	elseif role == "ZDM" or role == "ZM" or role == "ZOM" then
		patterns = { "long-range", "low-shot", "free-kick", "rebound" }
	else
		patterns = { "one-on-one", "cross", "low-shot", "rebound", "header", "penalty" }
	end
	return patterns[math.floor(Util.seed(id) * #patterns) + 1]
end

local rosterCache: { [string]: any } = {}
local rosterCacheOrder: { string } = {}

-- Goal Clicker clubs are fictional; their eleven is generated from the card pool.
function Broadcast.create(cup: any): any
	local seed = Broadcast.matchSeed(cup)
	local formation = Cards.FORMATIONS[math.floor(Util.seed(seed .. ":formation") * #Cards.FORMATIONS) + 1]
	local cacheKey = seed .. ":" .. tostring(cup.opponentRating)
	local cached = rosterCache[cacheKey]
	local opponentXI
	if cached then
		opponentXI = Util.deepCopy(cached)
	else
		local used = {}
		opponentXI = {}
		for index, slot in formation.slots do
			local candidates = Util.filter(Cards.ALL, function(player)
				return not player.isCustom and table.find(player.positions, slot.position) ~= nil and not used[player.id]
			end)
			table.sort(candidates, function(a, b)
				local da, db = math.abs(a.rating - cup.opponentRating), math.abs(b.rating - cup.opponentRating)
				if da ~= db then
					return da < db
				end
				return a.id < b.id
			end)
			candidates = Util.slice(candidates, 1, 12)
			local player = candidates[math.floor(Util.seed(seed .. ":player:" .. (index - 1)) * #candidates) + 1]
			if not player then
				player = Util.find(Cards.ALL, function(candidate)
					return table.find(candidate.positions, slot.position) ~= nil and not used[candidate.id]
				end) :: any
			end
			used[player.id] = true
			table.insert(opponentXI, { id = "opponent-" .. (index - 1), sourceId = player.id, name = player.name, position = slot.position, number = index, rating = player.rating, slot = index })
		end
		rosterCache[cacheKey] = Util.deepCopy(opponentXI)
		table.insert(rosterCacheOrder, cacheKey)
		if #rosterCacheOrder > 32 then
			rosterCache[table.remove(rosterCacheOrder, 1) :: string] = nil
		end
	end
	local original = #cup.originalLineupIds > 0 and cup.originalLineupIds or Util.keys(cup.playerEnteredAt)
	local roles = Util.map(original, function(id)
		return cup.playerMatchPositions[id]
	end)
	local clubFormation = "433"
	if #roles == 11 then
		for _, candidate in Cards.FORMATIONS do
			local matches = true
			for index, slot in candidate.slots do
				if slot.position ~= roles[index] then
					matches = false
					break
				end
			end
			if matches then
				clubFormation = candidate.id
				break
			end
		end
	end
	local slots, shirtNumbers, fitness = {}, {}, {}
	for index, id in original do
		if id ~= "" then
			slots[id] = index
			fitness[id] = 100
		end
	end
	local number = 0
	for _, id in Util.concat(original, cup.originalBenchIds or {}) do
		if id ~= "" then
			number += 1
			shirtNumbers[id] = number
		end
	end
	for _, player in opponentXI do
		fitness[player.id] = 100
	end
	return {
		version = 1,
		clubFormation = clubFormation,
		opponentFormation = formation.id,
		opponentXI = opponentXI,
		slots = slots,
		shirtNumbers = shirtNumbers,
		fitness = fitness,
		fitnessMinute = 1,
		events = {},
		clubStats = Broadcast.emptyStats(),
		opponentStats = Broadcast.emptyStats(),
	}
end

function Broadcast.addSubstitution(cup: any, outgoing: string, incoming: string, minute: number, regularDurationMs: number): any
	local broadcast = Util.deepCopy(cup.broadcast or Broadcast.create(cup))
	broadcast.slots[incoming] = broadcast.slots[outgoing] or math.max(1, table.find(cup.originalLineupIds, outgoing) or 1)
	if not broadcast.shirtNumbers[incoming] then
		local highest = 11
		for _, value in broadcast.shirtNumbers do
			highest = math.max(highest, value)
		end
		broadcast.shirtNumbers[incoming] = highest + 1
	end
	broadcast.fitness[incoming] = 100
	local id = ("sub:%s:%s:%s:%d"):format(tostring(cup.careerMatchId or cup.matchStartedAt), outgoing, incoming, minute)
	if not Util.some(broadcast.events, function(event)
		return event.id == id
	end) then
		local player = Cards.get(incoming)
		table.insert(broadcast.events, {
			id = id,
			kind = "substitution",
			side = "club",
			minute = minute,
			at = cup.matchStartedAt + (minute - 1) * regularDurationMs / 90,
			playerId = incoming,
			player = player and player.name or incoming,
			secondaryId = outgoing,
			lane = 34,
		})
	end
	return broadcast
end

-- Small rating corrections from recorded actions (passes, shots, saves and cards).
function Broadcast.actionRating(cup: any, id: string, minute: number): number
	local entered = cup.playerEnteredAt[id] or 1
	local finish = math.min(minute, cup.playerExitedAt[id] or minute)
	local value = 0
	for _, event in (cup.broadcast and cup.broadcast.events or {}) do
		if event.minute >= entered and event.minute <= finish then
			if event.keeperId == id and event.outcome == "save" then
				value += 0.07
			end
			if event.playerId == id then
				if event.kind == "yellow" then
					value -= 0.08
				elseif event.outcome == "wide" or event.outcome == "blocked" then
					value -= 0.05
				elseif event.kind == "counter" or event.kind == "combination" or event.kind == "build-up" or event.kind == "wide" then
					value += 0.025
				end
			end
		end
	end
	return Util.clamp(value, -0.4, 0.4)
end

return Broadcast
