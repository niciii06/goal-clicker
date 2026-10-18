--!strict
-- Access to the card pool, formations and positions.
local Data = script.Parent.Data
local Players = require(Data.Players) :: { any }
local Catalog = require(Data.Catalog) :: any
local Util = require(script.Parent.Util)

export type Player = {
	id: string,
	name: string,
	position: string?,
	positions: { string },
	rating: number,
	price: number,
	accent: string,
	countryCode: string?,
	isCustom: boolean?,
	benchOnly: boolean?,
	symbol: string?,
	cardType: string?,
	packWeight: number?,
	scrap: boolean?,
	retired: boolean?,
	isWomen: boolean?,
	tier: string,
	attributes: { [string]: number }?,
	look: any,
}

local Cards = {}

Cards.SQUAD_SIZE = 11
Cards.BENCH_SIZE = 12
Cards.MAX_SUBSTITUTIONS = 5
Cards.RANDOM_CUSTOM_CARD_COST = 25000
Cards.POSITIONS = Catalog.positions :: { string }
Cards.POSITION_NAMES = Catalog.positionNames :: { [string]: string }
Cards.FORMATIONS = Catalog.formations :: { any }
Cards.ALL = Players :: { Player }

local byId: { [string]: Player } = {}
for _, player in Cards.ALL do
	byId[player.id] = player
end

-- Cards that can still be drawn: retired cards (not part of FC 27) stay valid in saves only.
Cards.ACTIVE = Util.filter(Cards.ALL, function(player)
	return player.retired ~= true
end)

Cards.CUSTOM = Util.filter(Cards.ALL, function(player)
	return player.isCustom == true
end)
Cards.SCRAP = Util.filter(Cards.ALL, function(player)
	return player.scrap == true
end)

function Cards.get(id: string?): Player?
	if not id or id == "" then
		return nil
	end
	return byId[id]
end

function Cards.positionsOf(player: Player): { string }
	if player.benchOnly then
		return {}
	end
	if #player.positions > 0 then
		return player.positions
	end
	if player.position then
		return { player.position :: string }
	end
	return {}
end

-- FC 27 has no wing-back or centre-forward positions, so full-backs cover the
-- wing-back slots of back-five formations and strikers cover centre-forward.
local SLOT_EQUIVALENTS: { [string]: string } = { LAV = "LV", RAV = "RV", MS = "ST" }

function Cards.canPlay(player: Player?, position: string): boolean
	if not player or player.benchOnly then
		return false
	end
	local positions = Cards.positionsOf(player)
	local equivalent = SLOT_EQUIVALENTS[position]
	return table.find(positions, position) ~= nil or (equivalent ~= nil and table.find(positions, equivalent) ~= nil)
end

local formationById: { [string]: any } = {}
for _, formation in Cards.FORMATIONS do
	formation.positions = Util.map(formation.slots, function(slot: any)
		return slot.position
	end)
	formationById[formation.id] = formation
end

function Cards.formation(id: string?): any
	return (id and formationById[id]) or formationById["433"]
end

Cards.DEFAULT_POSITIONS = Cards.formation("433").positions :: { string }

function Cards.canFillSlot(playerId: string, slot: number, formationPositions: { string }?): boolean
	local positions = formationPositions or Cards.DEFAULT_POSITIONS
	local required = positions[slot] or Cards.DEFAULT_POSITIONS[slot]
	return required ~= nil and Cards.canPlay(Cards.get(playerId), required)
end

function Cards.positionLabel(player: Player, compact: boolean?): string
	if player.benchOnly then
		return (player.symbol or "") .. " Nur Bank"
	end
	if player.id == "star-goat-nicu" then
		return "Alle Positionen"
	end
	return table.concat(Cards.positionsOf(player), compact and "/" or " / ")
end

function Cards.fragmentCompensation(player: Player): number
	local step = math.max(1, math.min(34, math.floor(player.rating) - 66))
	if player.isCustom then
		return step * 600
	end
	if player.cardType == "icon" then
		return step * 75
	end
	if player.cardType == "legendary" then
		return step * 150
	end
	return step * 15
end

function Cards.attribute(player: Player?, key: string, fallback: number): number
	local attributes = player and player.attributes
	local value = attributes and attributes[key]
	if type(value) == "number" then
		return value
	end
	return fallback
end

function Cards.compareByRating(a: Player, b: Player): boolean
	if a.rating ~= b.rating then
		return a.rating > b.rating
	end
	return a.id < b.id
end

return Cards
