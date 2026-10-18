--!strict
-- Card packs: shop packs, scrap pack, tournament reward packs and the special card draw.
local Catalog = require(script.Parent.Data.Catalog) :: any
local Cards = require(script.Parent.Cards)
local Util = require(script.Parent.Util)

local Packs = {}

Packs.STAR_PACKS = Catalog.starPacks :: { any }
Packs.REWARD_PACKS = Catalog.rewardPacks :: { any }
Packs.TROLL_CHANCE = 0.05

local POSITION_GROUPS = {
	{ chance = 1 / 11, positions = { "TW" } },
	{ chance = 4 / 11, positions = { "LV", "LAV", "IV", "RV", "RAV" } },
	{ chance = 3 / 11, positions = { "ZDM", "ZM", "ZOM", "LM", "RM" } },
	{ chance = 3 / 11, positions = { "LF", "RF", "MS", "ST" } },
}

function Packs.get(id: string): any
	for _, pack in Packs.STAR_PACKS do
		if pack.id == id then
			return pack
		end
	end
	for _, pack in Packs.REWARD_PACKS do
		if pack.id == id then
			return pack
		end
	end
	return nil
end

function Packs.isReward(id: string): boolean
	return string.sub(id, 1, 7) == "reward-"
end

function Packs.tournamentRewardPack(tournamentId: string): any
	local index = tournamentId == "stadium" and 2 or tournamentId == "champions" and 4 or 6
	return Packs.REWARD_PACKS[index]
end

-- Pools for the shop packs come from the original card pool (scrap-only cards are not included).
local ratingPools: { [string]: { Cards.Player } } = {}
local function ratingPool(minimum: number, maximum: number): { Cards.Player }
	local key = minimum .. "-" .. maximum
	if not ratingPools[key] then
		ratingPools[key] = Util.filter(Cards.ALL, function(player)
			return string.sub(player.id, 1, 6) ~= "scrap-" and not player.retired and player.rating >= minimum and player.rating <= maximum
		end)
	end
	return ratingPools[key]
end

local rewardGroups: { [string]: { any } } = {}
function Packs.rewardOdds(id: string): { any }
	if rewardGroups[id] then
		return rewardGroups[id]
	end
	local pack = Packs.get(id)
	local base = Util.filter(Cards.ALL, function(player)
		return not player.retired and not player.isCustom and player.cardType ~= "icon" and player.cardType ~= "legendary"
	end)
	local groups = {}
	local total = 0
	for _, odds in pack.odds do
		local players = Util.filter(base, function(player)
			return player.rating >= odds.minRating and player.rating <= odds.maxRating
		end)
		if #players > 0 and odds.chance > 0 then
			table.insert(groups, { label = odds.label, minRating = odds.minRating, maxRating = odds.maxRating, chance = odds.chance, players = players })
			total += odds.chance
		end
	end
	for _, group in groups do
		group.chance /= total
	end
	rewardGroups[id] = groups
	return groups
end

local function drawScrap(random: () -> number): Cards.Player
	local groups = {}
	local total = 0
	for _, group in Catalog.scrapRatingGroups do
		local players = Util.filter(Cards.SCRAP, function(player)
			return player.rating >= group.minRating and player.rating <= group.maxRating
		end)
		if #players > 0 then
			table.insert(groups, { chance = group.chance, players = players })
			total += group.chance
		end
	end
	local roll = Util.bounded(random) * total
	local chosen = groups[#groups]
	for _, group in groups do
		roll -= group.chance
		if roll < 0 then
			chosen = group
			break
		end
	end
	return chosen.players[math.floor(Util.bounded(random) * #chosen.players) + 1]
end

export type Opening = { packId: string, packName: string, player: Cards.Player, duplicate: boolean, fragmentCompensation: number, source: string? }

local function opening(pack: any, player: Cards.Player, ownedIds: { string }): Opening
	local duplicate = table.find(ownedIds, player.id) ~= nil
	return { packId = pack.id, packName = pack.label, player = player, duplicate = duplicate, fragmentCompensation = duplicate and Cards.fragmentCompensation(player) or 0 }
end

function Packs.open(packId: string, ownedIds: { string }, random: () -> number): Opening
	local pack = Packs.get(packId) or Packs.get("scout")
	if Packs.isReward(pack.id) then
		local groups = Packs.rewardOdds(pack.id)
		local roll, cursor = Util.bounded(random), 0
		local group = groups[#groups]
		for _, candidate in groups do
			cursor += candidate.chance
			if cursor > roll then
				group = candidate
				break
			end
		end
		local player = group.players[math.min(#group.players, math.floor(Util.bounded(random) * #group.players) + 1)]
		return opening(pack, player, ownedIds)
	end
	if pack.id == "scrap" then
		return opening(pack, drawScrap(random), ownedIds)
	end
	local roll, cursor = Util.bounded(random), 0
	local odds = pack.odds[#pack.odds]
	for _, entry in pack.odds do
		cursor += entry.chance
		if roll <= cursor then
			odds = entry
			break
		end
	end
	local candidates = ratingPool(odds.minRating, odds.maxRating)
	if #candidates == 0 then
		candidates = Cards.ACTIVE
	end
	local owned = {}
	for _, id in ownedIds do
		owned[id] = true
	end
	local ownedCandidates = Util.filter(candidates, function(player)
		return owned[player.id] == true
	end)
	local unownedCandidates = Util.filter(candidates, function(player)
		return not owned[player.id]
	end)
	local duplicateRoll = Util.bounded(random)
	local pool = (duplicateRoll < 0.05 and #ownedCandidates > 0) and ownedCandidates or (#unownedCandidates > 0 and unownedCandidates or candidates)
	local positionRoll, positionCursor = Util.bounded(random), 0
	local group = POSITION_GROUPS[#POSITION_GROUPS]
	for _, candidate in POSITION_GROUPS do
		positionCursor += candidate.chance
		if positionRoll < positionCursor then
			group = candidate
			break
		end
	end
	local positioned = Util.filter(pool, function(player)
		return player.position ~= nil and table.find(group.positions, player.position) ~= nil
	end)
	local selection = #positioned > 0 and positioned or pool
	local totalWeight = Util.sum(selection, function(player)
		return math.max(0.0001, player.packWeight or 1)
	end)
	local weighted = Util.bounded(random) * totalWeight
	local chosen = selection[#selection] or Cards.ACTIVE[1]
	for _, player in selection do
		weighted -= math.max(0.0001, player.packWeight or 1)
		if weighted <= 0 then
			chosen = player
			break
		end
	end
	return opening(pack, chosen, ownedIds)
end

function Packs.shouldTroll(player: Cards.Player, random: () -> number): boolean
	local eligible = player.rating >= 86 or player.cardType == "icon" or player.cardType == "legendary"
	return eligible and Util.bounded(random) < Packs.TROLL_CHANCE
end

-- Special card draw for 25'000 fragments; returns the opening or nil when not affordable.
function Packs.drawCustom(fragments: number, ownedIds: { string }, random: () -> number): Opening?
	if fragments < Cards.RANDOM_CUSTOM_CARD_COST or #Cards.CUSTOM == 0 then
		return nil
	end
	local roll = Util.clamp(random(), 0, 0.999999999)
	local player = Cards.CUSTOM[math.floor(roll * #Cards.CUSTOM) + 1]
	local result = opening({ id = "legend", label = "Spezialkarten-Zug" }, player, ownedIds)
	result.source = "custom-draw"
	return result
end

return Packs
