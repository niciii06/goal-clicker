--!strict
-- Squad management: owned cards, starting eleven, bench and formations.
-- Slots are 1 based; an empty slot holds "".
local Cards = require(script.Parent.Cards)
local Util = require(script.Parent.Util)

local SQUAD_SIZE, BENCH_SIZE = Cards.SQUAD_SIZE, Cards.BENCH_SIZE

export type State = {
	ownedIds: { string },
	lockedPlayerIds: { string }?,
	fragments: number,
	lineupIds: { string },
	benchIds: { string },
	formationId: string,
	formationPositions: { string },
}

local StarXI = {}

local function emptySlots(count: number): { string }
	local slots = table.create(count, "")
	return slots
end

function StarXI.initial(): State
	return {
		ownedIds = {},
		fragments = 0,
		lineupIds = emptySlots(SQUAD_SIZE),
		benchIds = emptySlots(BENCH_SIZE),
		formationId = "433",
		formationPositions = table.clone(Cards.DEFAULT_POSITIONS),
	}
end

local function knownUnique(ids: any): { string }
	local result, seen = {}, {}
	if type(ids) ~= "table" then
		return result
	end
	for _, id in ids do
		if type(id) == "string" and Cards.get(id) and not seen[id] then
			seen[id] = true
			table.insert(result, id)
		end
	end
	return result
end

local function toSet(list: { string }): { [string]: boolean }
	local set = {}
	for _, id in list do
		set[id] = true
	end
	return set
end

local function normalizeLineup(ownedIds: { string }, raw: any, positions: { string }, blocked: { [string]: boolean }): { string }
	local lineup = emptySlots(SQUAD_SIZE)
	local requested = type(raw) == "table" and raw or {}
	local owned = toSet(ownedIds)
	local used, displaced, preserved = {}, {}, {}
	for index = 1, SQUAD_SIZE do
		local rawId = requested[index]
		if rawId == "" or (type(rawId) == "string" and blocked[rawId]) then
			preserved[index] = true
		end
		local id = (type(rawId) == "string" and owned[rawId] and not blocked[rawId]) and rawId or ""
		if id ~= "" and not used[id] then
			if Cards.canFillSlot(id, index, positions) then
				lineup[index] = id
				used[id] = true
			else
				table.insert(displaced, id)
			end
		end
	end
	local candidates = table.clone(displaced)
	local displacedSet = toSet(displaced)
	for _, id in ownedIds do
		if not used[id] and not displacedSet[id] and not blocked[id] then
			table.insert(candidates, id)
		end
	end
	for _, id in candidates do
		for index = 1, SQUAD_SIZE do
			if lineup[index] == "" and not preserved[index] and Cards.canFillSlot(id, index, positions) then
				lineup[index] = id
				used[id] = true
				break
			end
		end
	end
	return lineup
end

local function normalizeBench(ownedIds: { string }, lineup: { string }, raw: any, blocked: { [string]: boolean }): { string }
	local bench = emptySlots(BENCH_SIZE)
	local requested = type(raw) == "table" and raw or {}
	local owned = toSet(ownedIds)
	local used = {}
	for _, id in lineup do
		if id ~= "" then
			used[id] = true
		end
	end
	local preserved = {}
	for index = 1, BENCH_SIZE do
		local rawId = requested[index]
		if rawId == "" or (type(rawId) == "string" and blocked[rawId]) then
			preserved[index] = true
		end
		local id = (type(rawId) == "string" and owned[rawId] and not blocked[rawId]) and rawId or ""
		if id ~= "" and not used[id] then
			bench[index] = id
			used[id] = true
		end
	end
	for _, id in ownedIds do
		if not used[id] and not blocked[id] then
			local open = 0
			for index = 1, BENCH_SIZE do
				if bench[index] == "" and not preserved[index] then
					open = index
					break
				end
			end
			if open == 0 then
				break
			end
			bench[open] = id
			used[id] = true
		end
	end
	return bench
end

function StarXI.normalize(value: any, blockedPlayerIds: { string }?): State
	local source = type(value) == "table" and value or {}
	local ownedIds = knownUnique(source.ownedIds)
	local locked = type(source.lockedPlayerIds) == "table" and knownUnique(source.lockedPlayerIds) or nil
	local blockedList = table.clone(blockedPlayerIds or {})
	if locked then
		local lockedSet = toSet(locked)
		for _, id in ownedIds do
			if not lockedSet[id] then
				table.insert(blockedList, id)
			end
		end
	end
	local blocked = toSet(blockedList)
	local formation = Cards.formation(type(source.formationId) == "string" and source.formationId or "433")
	local positions = formation.positions
	local lineupIds = normalizeLineup(ownedIds, source.lineupIds, positions, blocked)
	return {
		ownedIds = ownedIds,
		lockedPlayerIds = locked,
		fragments = math.max(0, math.floor(tonumber(source.fragments) or 0)),
		lineupIds = lineupIds,
		benchIds = normalizeBench(ownedIds, lineupIds, source.benchIds, blocked),
		formationId = formation.id,
		formationPositions = table.clone(positions),
	}
end

function StarXI.removeFromSquad(state: State, playerIds: { string }, removeFromLineup: boolean?): State
	local nextState = StarXI.normalize(state)
	local blocked = toSet(playerIds)
	if #playerIds == 0 then
		return nextState
	end
	local lineup = table.clone(nextState.lineupIds)
	if removeFromLineup ~= false then
		for index, id in lineup do
			if blocked[id] then
				lineup[index] = ""
			end
		end
	end
	local used = toSet(Util.filter(lineup, function(id)
		return id ~= ""
	end))
	for index, id in nextState.benchIds do
		if blocked[id] or used[id] then
			nextState.benchIds[index] = ""
		end
	end
	nextState.lineupIds = lineup
	return nextState
end

local function lockedOut(state: State): { string }
	if not state.lockedPlayerIds then
		return {}
	end
	local locked = toSet(state.lockedPlayerIds)
	return Util.filter(state.ownedIds, function(id)
		return not locked[id]
	end)
end

function StarXI.add(state: State, playerId: string): State
	local nextState = StarXI.normalize(state)
	if not Cards.get(playerId) or table.find(nextState.ownedIds, playerId) then
		return nextState
	end
	table.insert(nextState.ownedIds, playerId)
	if nextState.lockedPlayerIds and not table.find(nextState.lockedPlayerIds, playerId) then
		return nextState
	end
	local placed = false
	for index = 1, SQUAD_SIZE do
		if nextState.lineupIds[index] == "" and Cards.canFillSlot(playerId, index, nextState.formationPositions) then
			nextState.lineupIds[index] = playerId
			placed = true
			break
		end
	end
	if not placed then
		local open = table.find(nextState.benchIds, "")
		if open then
			nextState.benchIds[open] = playerId
		end
	end
	-- Completing a weak starter team may require moving an existing multi-position card.
	if string.sub(playerId, 1, 6) == "scrap-" and table.find(nextState.lineupIds, "") then
		return StarXI.setBest(nextState)
	end
	return nextState
end

function StarXI.setStarter(state: State, slot: number, playerId: string, blockedPlayerIds: { string }?): State
	local nextState = StarXI.normalize(state)
	local blockedList = Util.concat(blockedPlayerIds or {}, lockedOut(nextState))
	local blocked = toSet(blockedList)
	if slot ~= math.floor(slot) or slot < 1 or slot > SQUAD_SIZE or blocked[playerId] or not table.find(nextState.ownedIds, playerId) or not Cards.canFillSlot(playerId, slot, nextState.formationPositions) then
		return nextState
	end
	local lineup = table.clone(nextState.lineupIds)
	local current = lineup[slot]
	local other = table.find(lineup, playerId)
	if other then
		if current ~= "" and not Cards.canFillSlot(current, other, nextState.formationPositions) then
			return nextState
		end
		lineup[other] = current
		lineup[slot] = playerId
	else
		lineup[slot] = playerId
		local benchIndex = table.find(nextState.benchIds, playerId)
		if benchIndex then
			nextState.benchIds[benchIndex] = (current ~= "" and not blocked[current]) and current or ""
		end
	end
	nextState.lineupIds = lineup
	if #blockedList > 0 then
		return StarXI.removeFromSquad(nextState, blockedPlayerIds or {}, false)
	end
	return StarXI.normalize(nextState)
end

function StarXI.setFormation(state: State, formationId: string, blockedPlayerIds: { string }?): State
	local nextState = StarXI.normalize(state)
	local formation = Cards.formation(formationId)
	if formation.id ~= formationId or formation.id == nextState.formationId then
		return nextState
	end
	local blocked = toSet(blockedPlayerIds or {})
	local lineup = normalizeLineup(nextState.ownedIds, nextState.lineupIds, formation.positions, blocked)
	nextState.formationId = formation.id
	nextState.formationPositions = table.clone(formation.positions)
	nextState.lineupIds = lineup
	nextState.benchIds = normalizeBench(nextState.ownedIds, lineup, nextState.benchIds, blocked)
	return nextState
end

function StarXI.setBench(state: State, benchIndex: number, playerId: string, blockedPlayerIds: { string }?): State
	local nextState = StarXI.normalize(state)
	if nextState.lockedPlayerIds and not table.find(nextState.lockedPlayerIds, playerId) then
		return nextState
	end
	local blocked = blockedPlayerIds or {}
	if benchIndex ~= math.floor(benchIndex) or benchIndex < 1 or benchIndex > BENCH_SIZE or table.find(blocked, playerId) or not table.find(nextState.ownedIds, playerId) or table.find(nextState.lineupIds, playerId) then
		return nextState
	end
	local current = nextState.benchIds[benchIndex]
	local other = table.find(nextState.benchIds, playerId)
	if other then
		nextState.benchIds[other] = current
	end
	nextState.benchIds[benchIndex] = playerId
	if #blocked > 0 then
		return StarXI.removeFromSquad(nextState, blocked, false)
	end
	return StarXI.normalize(nextState)
end

local function isDedicatedGoalkeeper(player: Cards.Player): boolean
	local positions = Cards.positionsOf(player)
	return #positions > 0 and Util.every(positions, function(position)
		return position == "TW"
	end)
end

local function bitCount(value: number): number
	local count = 0
	while value ~= 0 do
		value = bit32.band(value, value - 1)
		count += 1
	end
	return count
end

export type RatingOf = (Cards.Player) -> number

local function defaultRating(player: Cards.Player): number
	return player.rating
end

-- Highest rated valid assignment for the formation (bitmask dynamic program over the 11 slots).
function StarXI.bestSelection(ownedIds: { string }, positions: { string }?, blockedPlayerIds: { string }?, ratingOf: RatingOf?): { string }
	local slots = {}
	for index = 1, SQUAD_SIZE do
		slots[index] = (positions and positions[index]) or Cards.DEFAULT_POSITIONS[index]
	end
	local blocked = toSet(blockedPlayerIds or {})
	local players = {}
	for _, id in Util.unique(ownedIds) do
		local player = Cards.get(id)
		if player and not blocked[id] then
			table.insert(players, player)
		end
	end
	local rateFn = ratingOf or defaultRating
	local ratings = {}
	for _, player in players do
		ratings[player.id] = rateFn(player)
	end
	local function better(a: Cards.Player, b: Cards.Player): boolean
		if ratings[a.id] ~= ratings[b.id] then
			return ratings[a.id] > ratings[b.id]
		end
		return a.id < b.id
	end
	local candidateIds = {}
	for _, position in slots do
		local fitting = Util.filter(players, function(player)
			return Cards.canPlay(player, position)
		end)
		table.sort(fitting, better)
		for index = 1, math.min(SQUAD_SIZE, #fitting) do
			candidateIds[fitting[index].id] = true
		end
	end
	local candidates = Util.filter(players, function(player)
		return candidateIds[player.id] == true
	end)
	table.sort(candidates, better)

	local stateCount = bit32.lshift(1, SQUAD_SIZE)
	local NEG = -math.huge
	local scores = table.create(stateCount, NEG)
	scores[1] = 0 -- index = mask + 1
	local layers = { scores }
	for _, player in candidates do
		local nextScores = table.clone(scores)
		local compatible = 0
		for index, position in slots do
			if Cards.canPlay(player, position) then
				compatible = bit32.bor(compatible, bit32.lshift(1, index - 1))
			end
		end
		local rating = ratings[player.id]
		for mask = 0, stateCount - 1 do
			local score = scores[mask + 1]
			if score ~= NEG then
				local open = bit32.band(compatible, bit32.bnot(mask))
				while open ~= 0 do
					local slotBit = bit32.band(open, -open % 4294967296)
					local nextMask = bit32.bor(mask, slotBit)
					local nextScore = score + rating
					if nextScore > nextScores[nextMask + 1] then
						nextScores[nextMask + 1] = nextScore
					end
					open = bit32.bxor(open, slotBit)
				end
			end
		end
		scores = nextScores
		table.insert(layers, scores)
	end

	local bestMask, bestCount, bestRating = 0, 0, 0
	for mask = 0, stateCount - 1 do
		local rating = scores[mask + 1]
		if rating ~= NEG then
			local count = bitCount(mask)
			if count > bestCount or (count == bestCount and rating > bestRating) then
				bestMask, bestCount, bestRating = mask, count, rating
			end
		end
	end

	local lineup = emptySlots(SQUAD_SIZE)
	local mask = bestMask
	local playerIndex = #candidates
	while playerIndex > 0 and mask ~= 0 do
		local player = candidates[playerIndex]
		local current = layers[playerIndex + 1][mask + 1]
		if current ~= layers[playerIndex][mask + 1] then
			for slotIndex = 1, SQUAD_SIZE do
				local slotBit = bit32.lshift(1, slotIndex - 1)
				if bit32.band(mask, slotBit) ~= 0 and Cards.canPlay(player, slots[slotIndex]) then
					local previousMask = bit32.bxor(mask, slotBit)
					local previous = layers[playerIndex][previousMask + 1]
					if previous ~= NEG and previous + ratings[player.id] == current then
						lineup[slotIndex] = player.id
						mask = previousMask
						break
					end
				end
			end
		end
		playerIndex -= 1
	end
	return lineup
end

-- Substitute bench that mirrors the role demand of the formation.
function StarXI.bestBench(ownedIds: { string }, lineupIds: { string }, positions: { string }?, blockedPlayerIds: { string }?, ratingOf: RatingOf?): { string }
	local blocked = toSet(blockedPlayerIds or {})
	local used = toSet(Util.filter(lineupIds, function(id)
		return id ~= ""
	end))
	local required = Util.slice(positions or Cards.DEFAULT_POSITIONS, 1, SQUAD_SIZE)
	local rateFn = ratingOf or defaultRating
	local demand: { [string]: number } = {}
	local activePositions = {}
	for _, position in required do
		if not demand[position] then
			table.insert(activePositions, position)
		end
		demand[position] = (demand[position] or 0) + 1
	end
	local ratings = {}
	local candidates = {}
	for _, id in Util.unique(ownedIds) do
		local player = Cards.get(id)
		if player and not used[id] and not blocked[id] and Util.some(required, function(position)
			return Cards.canPlay(player, position)
		end) then
			ratings[id] = rateFn(player)
			table.insert(candidates, player)
		end
	end
	table.sort(candidates, function(a, b)
		if ratings[a.id] ~= ratings[b.id] then
			return ratings[a.id] > ratings[b.id]
		end
		return a.id < b.id
	end)
	if #required == 0 or #candidates == 0 then
		return emptySlots(BENCH_SIZE)
	end
	local selected, selectedIds = {}, {}
	local coverage: { [string]: number } = {}
	for _, position in activePositions do
		coverage[position] = 0
	end
	local fitCount: { [string]: number } = {}
	for _, position in activePositions do
		fitCount[position] = #Util.filter(candidates, function(player)
			return Cards.canPlay(player, position)
		end)
	end
	local order = {}
	for index, position in required do
		table.insert(order, { position = position, index = index })
	end
	table.sort(order, function(a, b)
		if demand[a.position] ~= demand[b.position] then
			return demand[a.position] < demand[b.position]
		end
		if fitCount[a.position] ~= fitCount[b.position] then
			return fitCount[a.position] < fitCount[b.position]
		end
		return a.index < b.index
	end)
	local function score(player: Cards.Player, assignment: string?): number
		local value = ratings[player.id] * 10
		for _, position in activePositions do
			if Cards.canPlay(player, position) then
				local need = math.max(1, demand[position] or 1)
				if position ~= assignment and coverage[position] < need then
					value += 35 / need
				end
				local excess = coverage[position] + 1 - need
				if excess > 0 then
					value -= excess * 140
				end
			end
		end
		return value
	end
	local function pick(pool: { Cards.Player }, assignment: string?): Cards.Player?
		local best: Cards.Player? = nil
		local bestScore = -math.huge
		for _, player in pool do
			local value = score(player, assignment)
			if best == nil or value > bestScore or (value == bestScore and Cards.compareByRating(player, best :: Cards.Player)) then
				best, bestScore = player, value
			end
		end
		return best
	end
	local function select(player: Cards.Player)
		selectedIds[player.id] = true
		table.insert(selected, player)
		for _, position in activePositions do
			if Cards.canPlay(player, position) then
				coverage[position] += 1
			end
		end
	end
	local function goalkeeperTaken(): boolean
		return Util.some(selected, isDedicatedGoalkeeper)
	end
	for _, entry in order do
		local pool = Util.filter(candidates, function(player)
			return not selectedIds[player.id] and not (isDedicatedGoalkeeper(player) and goalkeeperTaken()) and Cards.canPlay(player, entry.position)
		end)
		local player = pick(pool, entry.position)
		if player then
			select(player)
		end
	end
	while #selected < BENCH_SIZE do
		local keeper = goalkeeperTaken()
		local pool = Util.filter(candidates, function(player)
			return not selectedIds[player.id] and not (keeper and isDedicatedGoalkeeper(player))
		end)
		local player = pick(pool, nil)
		if not player then
			break
		end
		select(player)
	end
	local bench = emptySlots(BENCH_SIZE)
	for index = 1, BENCH_SIZE do
		bench[index] = selected[index] and selected[index].id or ""
	end
	return bench
end

function StarXI.setBest(state: State, blockedPlayerIds: { string }?, ratingOf: RatingOf?, matchActive: boolean?): State
	if matchActive then
		return state
	end
	local blocked = Util.concat(blockedPlayerIds or {}, lockedOut(state))
	local nextState = StarXI.removeFromSquad(StarXI.normalize(state), blocked)
	local rateFn = ratingOf or defaultRating
	local lineup = StarXI.bestSelection(nextState.ownedIds, nextState.formationPositions, blocked, rateFn)
	local function total(ids: { string }): number
		local sum = 0
		for _, id in ids do
			local player = Cards.get(id)
			if player then
				sum += rateFn(player)
			end
		end
		return sum
	end
	local function filled(ids: { string }): number
		return #Util.filter(ids, function(id)
			return id ~= ""
		end)
	end
	if filled(nextState.lineupIds) == filled(lineup) and math.abs(total(nextState.lineupIds) - total(lineup)) < 1e-9 then
		lineup = table.clone(nextState.lineupIds)
	end
	nextState.lineupIds = lineup
	nextState.benchIds = StarXI.bestBench(nextState.ownedIds, lineup, nextState.formationPositions, blocked, rateFn)
	return nextState
end

-- Starters in slot order (or the best owned cards when no lineup exists), without bench-only cards.
function StarXI.selection(ownedIds: { string }, lineupIds: { string }?): { Cards.Player }
	local lineup = lineupIds or {}
	local hasLineup = Util.some(lineup, function(id)
		return id ~= ""
	end)
	local source = hasLineup and lineup or ownedIds
	local selected = {}
	for _, id in source do
		local player = Cards.get(id)
		if player and not player.benchOnly then
			table.insert(selected, player)
		end
	end
	if not hasLineup then
		table.sort(selected, Cards.compareByRating)
	end
	return Util.slice(selected, 1, SQUAD_SIZE)
end

function StarXI.rating(ownedIds: { string }, lineupIds: { string }?): number
	local starters = StarXI.selection(ownedIds, lineupIds)
	local missing = SQUAD_SIZE - #starters
	local total = Util.sum(starters, function(player)
		return player.rating
	end)
	return Util.round((total + missing * 55) / SQUAD_SIZE)
end

function StarXI.restoreAfterMatch(state: State, cup: any): State
	local nextState = StarXI.normalize(state)
	if #cup.originalLineupIds ~= SQUAD_SIZE then
		return nextState
	end
	nextState.lineupIds = table.clone(cup.originalLineupIds)
	if #cup.originalBenchIds == BENCH_SIZE then
		nextState.benchIds = table.clone(cup.originalBenchIds)
	end
	local removed = table.clone(cup.suspendedPlayerIds)
	for id, matches in cup.injuredPlayerIds do
		if (tonumber(matches) or 0) > 0 then
			table.insert(removed, id)
		end
	end
	return StarXI.removeFromSquad(nextState, Util.unique(removed))
end

function StarXI.filledCount(ids: { string }): number
	local count = 0
	for _, id in ids do
		if id ~= "" then
			count += 1
		end
	end
	return count
end

return StarXI
