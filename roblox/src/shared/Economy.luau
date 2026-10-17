--!strict
-- Upgrades, click and passive power, ranks, achievements and the click combo.
local Catalog = require(script.Parent.Data.Catalog) :: any
local Progression = require(script.Parent.Data.Progression) :: any

local Economy = {}

Economy.MAX_MULTIPLIER_LEVEL = 8
Economy.MAX_SEASON_STARS = 20
Economy.COMBO_WINDOW_MS = 450
Economy.COMBO_LEVELS = { { clicks = 0, multiplier = 1 }, { clicks = 15, multiplier = 2 }, { clicks = 40, multiplier = 3 } }

export type Upgrade = { id: string, icon: string, name: string, description: string, baseCost: number, scale: number, kind: string }

Economy.UPGRADES = {
	{ id = "boots", icon = "boot", name = "Schnellere Stiefel", description = "+1 Tor pro Klick", baseCost = 25, scale = 1.22, kind = "click" },
	{ id = "ballboy", icon = "worker", name = "Balljunge", description = "+1 Tor pro Sekunde", baseCost = 120, scale = 1.2, kind = "auto" },
	{ id = "technique", icon = "ball", name = "Schusstechnik", description = "+3 Tore pro Klick", baseCost = 260, scale = 1.24, kind = "click" },
	{ id = "instinct", icon = "scorer", name = "Torinstinkt", description = "+5 Tore pro Klick", baseCost = 1400, scale = 1.26, kind = "click" },
	{ id = "coach", icon = "board", name = "Taktiktafel", description = "+15 Tore pro Sekunde", baseCost = 3500, scale = 1.23, kind = "auto" },
	{ id = "striker", icon = "striker", name = "Killerstürmer", description = "+10 Tore pro Klick", baseCost = 7500, scale = 1.28, kind = "click" },
	{ id = "academy", icon = "board", name = "Nachwuchsakademie", description = "+60 Tore pro Sekunde", baseCost = 12500, scale = 1.25, kind = "auto" },
	{ id = "floodlight", icon = "light", name = "Flutlichtanlage", description = "+300 Tore pro Sekunde", baseCost = 55000, scale = 1.27, kind = "auto" },
	{ id = "longshot", icon = "flame", name = "Distanzschütze", description = "+25 Tore pro Klick", baseCost = 75000, scale = 1.3, kind = "click" },
	{ id = "scout", icon = "star", name = "Talent-Scouting", description = "+1.200 Tore pro Sekunde", baseCost = 200000, scale = 1.29, kind = "auto" },
	{ id = "var", icon = "screen", name = "VAR 2.0", description = "+10.000 Tore pro Sekunde", baseCost = 400000, scale = 1.3, kind = "auto" },
	{ id = "freekick", icon = "ball", name = "Freistoss-Spezialist", description = "+50 Tore pro Klick", baseCost = 750000, scale = 1.32, kind = "click" },
	{ id = "stadium", icon = "stadium", name = "Arena-Ausbau", description = "+50.000 Tore pro Sekunde", baseCost = 2000000, scale = 1.32, kind = "auto" },
	{ id = "worldclass", icon = "striker", name = "Weltklasse-Abschluss", description = "+100 Tore pro Klick", baseCost = 7500000, scale = 1.34, kind = "click" },
	{ id = "broadcast", icon = "broadcast", name = "Weltweite Übertragung", description = "+250.000 Tore pro Sekunde", baseCost = 8000000, scale = 1.34, kind = "auto" },
	{ id = "sponsor", icon = "diamond", name = "Globaler Sponsor", description = "+1,2 Millionen Tore pro Sekunde", baseCost = 35000000, scale = 1.36, kind = "auto" },
	{ id = "ballondor", icon = "crown", name = "Ballon-d'Or-Angreifer", description = "+250 Tore pro Klick", baseCost = 75000000, scale = 1.38, kind = "click" },
	{ id = "superclub", icon = "crown", name = "Superclub-Netzwerk", description = "+6 Millionen Tore pro Sekunde", baseCost = 180000000, scale = 1.38, kind = "auto" },
	{ id = "captain", icon = "star", name = "Kapitänsbinde", description = "+500 Tore pro Klick", baseCost = 350000000, scale = 1.42, kind = "click" },
	{ id = "golden", icon = "crown", name = "Goldener Schuh", description = "+10% Klickpower", baseCost = 900000000, scale = 1.58, kind = "multiplier" },
	{ id = "legacy", icon = "diamond", name = "Vereins-Dynastie", description = "+5% auf alle Einnahmen", baseCost = 6000000000, scale = 1.68, kind = "multiplier" },
} :: { Upgrade }

local upgradeById: { [string]: Upgrade } = {}
for _, upgrade in Economy.UPGRADES do
	upgradeById[upgrade.id] = upgrade
end

Economy.UNLOCK_SEASONS = Progression.upgradeUnlockSeasons :: { [string]: number }
Economy.ACHIEVEMENTS = Progression.achievements :: { any }
Economy.RANKS = Progression.ranks :: { any }

function Economy.upgrade(id: string): Upgrade?
	return upgradeById[id]
end

function Economy.level(upgrades: { [string]: number }, id: string): number
	return upgrades[id] or 0
end

function Economy.costAtLevel(upgrade: Upgrade, level: number): number
	if upgrade.kind == "multiplier" and level >= Economy.MAX_MULTIPLIER_LEVEL then
		return math.huge
	end
	return math.floor(upgrade.baseCost * upgrade.scale ^ level)
end

function Economy.cost(upgrade: Upgrade, upgrades: { [string]: number }): number
	return Economy.costAtLevel(upgrade, Economy.level(upgrades, upgrade.id))
end

-- mode is 1, 10, 100 or "max".
function Economy.bulkPurchase(upgrade: Upgrade, upgrades: { [string]: number }, goals: number, mode: any, unlimited: boolean?): (number, number)
	local current = Economy.level(upgrades, upgrade.id)
	local maxBulk = 1000
	local limit = mode == "max" and maxBulk or math.max(1, math.min(maxBulk, math.floor(tonumber(mode) or 1)))
	if unlimited then
		if upgrade.kind == "multiplier" then
			return math.max(0, math.min(limit, Economy.MAX_MULTIPLIER_LEVEL - current)), 0
		end
		return limit, 0
	end
	local count, total = 0, 0
	while count < limit do
		local cost = Economy.costAtLevel(upgrade, current + count)
		if cost == math.huge or total + cost > goals then
			break
		end
		total += cost
		count += 1
	end
	return count, total
end

function Economy.transferBonuses(ownedIds: { string }): (number, number, number)
	local click, passive, income = 0, 0, 0
	for _, id in ownedIds do
		for _, player in Catalog.transferPlayers do
			if player.id == id then
				click += player.clickBonus
				passive += player.passiveBonus
				income += player.incomeBonus
			end
		end
	end
	return click, passive, income
end

function Economy.incomeMultiplier(upgrades: { [string]: number }, stars: number): number
	local legacy = math.min(Economy.MAX_MULTIPLIER_LEVEL, Economy.level(upgrades, "legacy"))
	return (1 + math.min(Economy.MAX_SEASON_STARS, math.max(0, stars)) * 0.02) * 1.05 ^ legacy
end

local CLICK_WEIGHTS = { boots = 1, technique = 3, instinct = 5, striker = 10, longshot = 25, freekick = 50, worldclass = 100, ballondor = 250, captain = 500 }
local PASSIVE_WEIGHTS = { ballboy = 1, coach = 15, academy = 60, floodlight = 300, scout = 1200, var = 10000, stadium = 50000, broadcast = 250000, sponsor = 1200000, superclub = 6000000 }

local function transferOwned(features: any): { string }
	return features and features.transferMarket and features.transferMarket.ownedIds or {}
end

function Economy.baseClickPower(upgrades: { [string]: number }, stars: number, features: any): number
	local flat = 1
	for id: string, weight: number in CLICK_WEIGHTS :: any do
		flat += Economy.level(upgrades, id) * weight
	end
	local clickBonus, _, incomeBonus = Economy.transferBonuses(transferOwned(features))
	local golden = math.min(Economy.MAX_MULTIPLIER_LEVEL, Economy.level(upgrades, "golden"))
	return (flat + clickBonus) * 1.1 ^ golden * Economy.incomeMultiplier(upgrades, stars) * (1 + incomeBonus)
end

function Economy.basePassivePower(upgrades: { [string]: number }, stars: number, features: any): number
	local base = 0
	for id: string, weight: number in PASSIVE_WEIGHTS :: any do
		base += Economy.level(upgrades, id) * weight
	end
	local _, passiveBonus, incomeBonus = Economy.transferBonuses(transferOwned(features))
	return (base + passiveBonus) * Economy.incomeMultiplier(upgrades, stars) * (1 + incomeBonus)
end

-- Goal boost after a won tournament.
Economy.GOAL_BOOST_MULTIPLIERS = { stadium = 1.5, champions = 2, world = 3 }
Economy.GOAL_BOOST_DURATION_MS = 180000

function Economy.goalBoostMultiplier(features: any, now: number): number
	local boost = features and features.goalBoost
	if not boost or not boost.tournamentId or boost.startedAt > now or boost.endsAt <= now then
		return 1
	end
	return Economy.GOAL_BOOST_MULTIPLIERS[boost.tournamentId] or 1
end

function Economy.boostedPassiveReward(basePower: number, features: any, from: number, to: number): number
	local power = math.max(0, basePower)
	local startAt, endAt = math.min(from, to), math.max(from, to)
	local duration = math.max(0, endAt - startAt)
	local boost = features and features.goalBoost
	if not boost or not boost.tournamentId or duration <= 0 then
		return power * duration / 1000
	end
	local boosted = math.max(0, math.min(endAt, boost.endsAt) - math.max(startAt, boost.startedAt))
	local multiplier = Economy.GOAL_BOOST_MULTIPLIERS[boost.tournamentId] or 1
	return power * (duration + boosted * (multiplier - 1)) / 1000
end

function Economy.clickPower(upgrades: { [string]: number }, stars: number, features: any, now: number): number
	return Economy.baseClickPower(upgrades, stars, features) * Economy.goalBoostMultiplier(features, now)
end

function Economy.passivePower(upgrades: { [string]: number }, stars: number, features: any, now: number): number
	return Economy.basePassivePower(upgrades, stars, features) * Economy.goalBoostMultiplier(features, now)
end

function Economy.upgradeEffect(upgrade: Upgrade, level: number): string
	local effective = math.min(level, Economy.MAX_MULTIPLIER_LEVEL)
	if upgrade.id == "golden" then
		return string.format("Stufe %d: x%.2f Klickpower", effective, 1.1 ^ effective)
	end
	if upgrade.id == "legacy" then
		return string.format("Stufe %d: x%.2f alle Einnahmen", effective, 1.05 ^ effective)
	end
	return upgrade.description .. " · Stufe " .. level
end

function Economy.rank(totalGoals: number): (any, any?)
	local current = Economy.RANKS[1]
	local nextRank = nil
	for _, rank in Economy.RANKS do
		if totalGoals >= rank.minimum then
			current = rank
		elseif not nextRank then
			nextRank = rank
		end
	end
	return current, nextRank
end

function Economy.comboLevel(count: number): any
	local level = Economy.COMBO_LEVELS[1]
	for _, item in Economy.COMBO_LEVELS do
		if count >= item.clicks then
			level = item
		end
	end
	return level
end

-- Click outcome: streak bonus up to +10 %, 2 % critical hits (double).
function Economy.clickResult(clickPower: number, now: number, lastClick: number, streak: number, random: () -> number): (number, number, boolean)
	local nextStreak = (now - lastClick < 1200) and streak + 1 or 1
	local streakBonus = nextStreak >= 5 and 1 + math.min(0.1, nextStreak * 0.01) or 1
	local critical = random() < 0.02
	local amount = math.max(1, math.floor(clickPower * streakBonus * (critical and 2 or 1)))
	return amount, nextStreak, critical
end

return Economy
