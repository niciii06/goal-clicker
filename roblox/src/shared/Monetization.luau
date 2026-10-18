--!strict
-- Robux shop: game passes and developer products. All Roblox IDs live in this file.
-- An ID of 0 means "not created yet": the buy button stays hidden and nothing breaks.
-- Packs, cards and icons are never sold for Robux; packs stay a goal purchase only.

local Monetization = {}

export type Pass = { key: string, id: number, name: string, description: string, price: number, icon: string }
export type Product = {
	key: string,
	id: number,
	name: string,
	description: string,
	price: number,
	icon: string,
	minutes: number?,
	minimum: number?,
	amount: number?,
}

-- Game passes (bought once, kept forever). Enter the IDs from create.roblox.com here.
Monetization.PASSES = {
	{ key = "doubleGoals", id = 0, price = 249, icon = "⚡", name = "Doppelte Tore", description = "Alle Tore aus Klicks und Produktion x2. Gilt in Koop Welten für alle Mitspieler." },
	{ key = "autoClicker", id = 0, price = 149, icon = "🤖", name = "Auto Klicker", description = "Ein automatischer Klick pro Sekunde, solange du im Spiel bist." },
	{ key = "fastTravel", id = 0, price = 99, icon = "✈️", name = "Schnellreise", description = "Auswärtsreisen dauern nur noch halb so lang." },
	{ key = "vip", id = 0, price = 249, icon = "👑", name = "VIP", description = "Goldener Name in Koop und Rangliste, zusätzliche Trikotfarben und bei der täglichen Prämie jeden Tag ein Kleines Prämienpack dazu." },
	{ key = "bigCoop", id = 0, price = 199, icon = "👥", name = "Grosser Koop Club", description = "Deine selbst erstellten Koop Welten haben 6 statt 4 Plätze." },
} :: { Pass }

-- Developer products (can be bought again and again).
Monetization.PRODUCTS = {
	{ key = "goalsSmall", id = 0, price = 25, icon = "⚽", name = "Kleines Tore Paket", description = "10 Minuten deiner aktuellen Produktion sofort, mindestens 1.000 Tore.", minutes = 10, minimum = 1000 },
	{ key = "goalsLarge", id = 0, price = 99, icon = "🥅", name = "Grosses Tore Paket", description = "1 Stunde deiner aktuellen Produktion sofort, mindestens 10.000 Tore.", minutes = 60, minimum = 10000 },
	{ key = "goalsHuge", id = 0, price = 399, icon = "🏟️", name = "Riesiges Tore Paket", description = "8 Stunden deiner aktuellen Produktion sofort, mindestens 100.000 Tore.", minutes = 480, minimum = 100000 },
	{ key = "goalBoost", id = 0, price = 49, icon = "⚡", name = "Goalboost", description = "2x Tore für 15 Minuten Spielzeit." },
	{ key = "fragments", id = 0, price = 79, icon = "💎", name = "Fragmente", description = "500 Fragmente für den Spezialkarten Zug.", amount = 500 },
	{ key = "finishTravel", id = 0, price = 15, icon = "🚌", name = "Reise sofort beenden", description = "Die laufende Auswärtsreise ist sofort am Ziel." },
	{ key = "miniGameReady", id = 0, price = 15, icon = "🎮", name = "Minigames sofort bereit", description = "Setzt die Abklingzeit aller Minigames zurück." },
} :: { Product }

-- Shop goal boost: same mechanic as the tournament boost.
Monetization.BOOST_MULTIPLIER = 2
Monetization.BOOST_DURATION_MS = 15 * 60 * 1000
Monetization.PASS_GOAL_MULTIPLIER = 2
Monetization.BIG_COOP_PLAYERS = 6
Monetization.COOP_PLAYERS = 4
Monetization.VIP_DAILY_PACK = "reward-1"
Monetization.VIP_COLOR = "#d4af37"
Monetization.VIP_CLUB_COLORS = { "#d4af37", "#c0c0c0", "#00a3a3", "#ff4fa3", "#0b2a5b", "#7cc242" }
Monetization.RECEIPT_LIMIT = 100

-- Products that need something to act on keep a credit when there is nothing to act on yet.
Monetization.CREDIT_PRODUCTS = { finishTravel = true, miniGameReady = true }

-- Plain searches over a dozen items; an ID of 0 never matches.
local function find<T>(list: { T }, field: string, value: any): T?
	if value == 0 or value == nil then
		return nil
	end
	for _, item in list do
		if (item :: any)[field] == value then
			return item
		end
	end
	return nil
end

function Monetization.pass(key: string): Pass?
	return find(Monetization.PASSES, "key", key)
end

function Monetization.passById(id: number): Pass?
	return find(Monetization.PASSES, "id", id)
end

function Monetization.product(key: string): Product?
	return find(Monetization.PRODUCTS, "key", key)
end

function Monetization.productById(id: number): Product?
	return find(Monetization.PRODUCTS, "id", id)
end

-- Items with an ID of 0 are not created on Roblox yet and are not offered.
function Monetization.enabled(item: { id: number }?): boolean
	return item ~= nil and item.id ~= 0
end

function Monetization.anyEnabled(): boolean
	for _, pass in Monetization.PASSES do
		if pass.id ~= 0 then
			return true
		end
	end
	for _, product in Monetization.PRODUCTS do
		if product.id ~= 0 then
			return true
		end
	end
	return false
end

-- Multiplier on goals from clicks and production for the active passes of a club.
function Monetization.goalMultiplier(passes: { [string]: boolean }?): number
	return passes and passes.doubleGoals and Monetization.PASS_GOAL_MULTIPLIER or 1
end

-- Goals of a goal pack: minutes of the current production per second, at least the minimum.
function Monetization.packGoals(product: Product, passivePerSecond: number): number
	local production = math.max(0, passivePerSecond) * (product.minutes or 0) * 60
	return math.max(product.minimum or 0, math.floor(production))
end

function Monetization.coopCapacity(bigCoop: boolean?): number
	return bigCoop and Monetization.BIG_COOP_PLAYERS or Monetization.COOP_PLAYERS
end

-- Club colours a club may use; VIP clubs get extra colours.
function Monetization.allowedColor(color: any, baseColors: { string }, vip: boolean?): boolean
	if type(color) ~= "string" then
		return false
	end
	if table.find(baseColors, color) then
		return true
	end
	return vip == true and table.find(Monetization.VIP_CLUB_COLORS, color) ~= nil
end

return Monetization
