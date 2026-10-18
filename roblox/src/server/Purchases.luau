--!nonstrict
-- Robux purchases: what each developer product does and the safe receipt handling.
-- The client never triggers an effect; everything here runs from ProcessReceipt.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared

local Economy = require(Shared.Economy)
local History = require(Shared.History)
local Monetization = require(Shared.Monetization)
local Travel = require(Shared.Travel)
local Util = require(Shared.Util)

local Purchases = {}

Purchases.GRANTED = "granted"
Purchases.RETRY = "retry"

local function notify(session: any, kind: string, data: any?)
	local notice = data and table.clone(data) or {}
	notice.kind = kind
	table.insert(session.notices, notice)
end

local function credits(game: any): any
	game.shopCredits = game.shopCredits or { finishTravel = 0, miniGameReady = 0 }
	return game.shopCredits
end

-- Production per second for goal packs: passes count, temporary boosts do not.
function Purchases.production(session: any): number
	local game = session.game
	return Economy.basePassivePower(game.upgrades, game.stars, game.features) * Monetization.goalMultiplier(session.passes)
end

-- 2x for 15 minutes. A running boost of at least 2x is extended; a weaker one is replaced.
function Purchases.applyGoalBoost(features: any, now: number)
	local boost = features.goalBoost
	local active = boost ~= nil and boost.tournamentId ~= nil and boost.startedAt <= now and boost.endsAt > now
	local multiplier = active and (Economy.GOAL_BOOST_MULTIPLIERS[boost.tournamentId] or 1) or 1
	if active and multiplier >= Monetization.BOOST_MULTIPLIER then
		boost.endsAt += Monetization.BOOST_DURATION_MS
		return
	end
	features.goalBoost = {
		tournamentId = "shop",
		multiplier = Monetization.BOOST_MULTIPLIER,
		startedAt = now,
		endsAt = (active and boost.endsAt or now) + Monetization.BOOST_DURATION_MS,
	}
end

local function finishJourney(features: any, now: number): boolean
	local journey = features.travel.journey
	if not journey or journey.consumed or now >= journey.endsAt then
		return false
	end
	journey.endsAt = now
	Travel.settle(features.travel, now)
	return true
end

local function readyMiniGames(game: any, now: number): boolean
	local any = false
	for id, untilAt in game.miniGameCooldowns do
		if untilAt > now then
			game.miniGameCooldowns[id] = 0
			any = true
		end
	end
	return any
end

-- Applies a product to a club. Returns the message for the buyer.
function Purchases.grantProduct(session: any, key: string, now: number, buyer: string?): string
	local game = session.game
	local f = game.features
	local product = Monetization.product(key)
	if not product then
		error("Unbekanntes Produkt " .. tostring(key))
	end
	local who = buyer or "Jemand"
	if product.minutes then
		-- Only the balance grows: bought goals never count for rank, ranking or achievements.
		local amount = Monetization.packGoals(product, Purchases.production(session))
		game.goals += amount
		History.add(f, product.name, ("%s holt +%s Tore aus dem Shop."):format(who, Util.formatNumber(amount)), "positive", now)
		notify(session, "feed", { icon = "ball", text = ("%s: +%s Tore"):format(product.name, Util.formatNumber(amount)) })
		notify(session, "sound", { name = "reward" })
		return ("%s: +%s Tore gutgeschrieben."):format(product.name, Util.formatNumber(amount))
	elseif key == "goalBoost" then
		Purchases.applyGoalBoost(f, now)
		History.add(f, "Goalboost gestartet", ("%s zündet 2x Tore für 15 Minuten."):format(who), "positive", now)
		notify(session, "sound", { name = "reward" })
		return "Goalboost aktiv: 2x Tore für 15 Minuten."
	elseif key == "fragments" then
		f.starXI.fragments += product.amount or 0
		History.add(f, "Fragmente gekauft", ("%s bringt +%s Fragmente für Spezialkarten."):format(who, Util.formatNumber(product.amount or 0)), "positive", now)
		notify(session, "sound", { name = "reward" })
		return ("+%s Fragmente gutgeschrieben."):format(Util.formatNumber(product.amount or 0))
	elseif key == "finishTravel" then
		if finishJourney(f, now) then
			History.add(f, "Reise sofort beendet", "Die Mannschaft ist am Ziel. Das Spiel kann starten.", "positive", now)
			return "Die Mannschaft ist angekommen."
		end
		credits(game).finishTravel += 1
		return "Gerade läuft keine Reise. Die Gutschrift wartet im Shop."
	elseif key == "miniGameReady" then
		if readyMiniGames(game, now) then
			return "Alle Minigames sind sofort bereit."
		end
		credits(game).miniGameReady += 1
		return "Alle Minigames sind schon bereit. Die Gutschrift wartet im Shop."
	end
	error("Produkt ohne Wirkung " .. key)
end

-- Uses a stored credit (an earlier purchase that could not act yet).
function Purchases.useCredit(session: any, key: string, now: number): (boolean, string)
	local game = session.game
	local store = credits(game)
	if not Monetization.CREDIT_PRODUCTS[key] or (store[key] or 0) <= 0 then
		return false, "Keine Gutschrift vorhanden."
	end
	if key == "finishTravel" then
		if not finishJourney(game.features, now) then
			return false, "Gerade läuft keine Auswärtsreise."
		end
		History.add(game.features, "Reise sofort beendet", "Gutschrift aus dem Shop eingelöst.", "positive", now)
	elseif not readyMiniGames(game, now) then
		return false, "Alle Minigames sind schon bereit."
	end
	store[key] -= 1
	return true, key == "finishTravel" and "Die Mannschaft ist angekommen." or "Alle Minigames sind sofort bereit."
end

------------------------------------------------------------------------------------------
-- Receipts

function Purchases.hasReceipt(profile: any, purchaseId: string): boolean
	return table.find(profile.receipts or {}, purchaseId) ~= nil
end

function Purchases.addReceipt(profile: any, purchaseId: string)
	local receipts = profile.receipts or {}
	table.insert(receipts, purchaseId)
	profile.receipts = Util.tail(receipts, Monetization.RECEIPT_LIMIT)
end

local inFlight: { [string]: boolean } = {}

-- Safe receipt handling. ctx provides:
--   viewerFor(userId) -> viewer?   (the loaded buyer; viewer.profile is saved with the buyer's club)
--   sessionFor(viewer) -> session  (the club the buyer plays in right now)
--   save(viewer) -> boolean        (true only when everything with the effect is stored)
--   now() -> number, nameOf(viewer) -> string, announce(viewer, text)?
-- Returns GRANTED only after a successful save; a receipt never acts twice.
function Purchases.processReceipt(ctx: any, receipt: any, product: any?): string
	if not product then
		warn("[Shop] Unbekanntes Produkt im Beleg:", receipt.ProductId)
		return Purchases.RETRY
	end
	local viewer = ctx.viewerFor(receipt.PlayerId)
	if not viewer then
		return Purchases.RETRY
	end
	local id = tostring(receipt.PurchaseId)
	if inFlight[id] then
		return Purchases.RETRY
	end
	inFlight[id] = true
	local profile = viewer.profile
	viewer.unsavedReceipts = viewer.unsavedReceipts or {}
	local ok, result = pcall(function()
		if Purchases.hasReceipt(profile, id) then
			-- Already applied. Only an unconfirmed save needs another attempt.
			if not viewer.unsavedReceipts[id] then
				return Purchases.GRANTED
			end
		else
			local message = Purchases.grantProduct(ctx.sessionFor(viewer), product.key, ctx.now(), ctx.nameOf(viewer))
			Purchases.addReceipt(profile, id)
			viewer.unsavedReceipts[id] = true
			if ctx.announce then
				ctx.announce(viewer, message)
			end
		end
		if ctx.save(viewer) then
			viewer.unsavedReceipts[id] = nil
			return Purchases.GRANTED
		end
		return Purchases.RETRY
	end)
	inFlight[id] = nil
	if not ok then
		warn("[Shop] Beleg konnte nicht verarbeitet werden:", result)
		return Purchases.RETRY
	end
	return result
end

return Purchases
