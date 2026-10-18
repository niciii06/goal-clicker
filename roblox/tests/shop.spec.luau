local Shared = game:GetService("ReplicatedStorage").Shared
local Server = game:GetService("ServerScriptService").Server
local Actions = require(Server.Actions)
local Purchases = require(Server.Purchases)
local Economy = require(Shared.Economy)
local GameState = require(Shared.GameState)
local Monetization = require(Shared.Monetization)
local Travel = require(Shared.Travel)

local seed = 11
local function rng()
	seed = (seed * 1103515245 + 12345) % 2147483648
	return seed / 2147483648
end

local NOW = 1767225600000

local function newSession(passes)
	local session = Actions.newSession(GameState.initial(NOW, rng))
	session.passes = passes or {}
	return session
end

-- A fake server around one buyer for Purchases.processReceipt.
local function receiptContext(session, saveResults)
	local viewer = { profile = { receipts = {} }, player = { DisplayName = "Tester" } }
	local saves = 0
	local ctx = {
		viewerFor = function(userId)
			return userId == 1 and viewer or nil
		end,
		sessionFor = function()
			return session
		end,
		save = function()
			saves += 1
			local result = saveResults and saveResults[saves]
			if result == nil then
				return true
			end
			return result
		end,
		now = function()
			return NOW
		end,
		nameOf = function()
			return "Tester"
		end,
	}
	return ctx, viewer, function()
		return saves
	end
end

local function receipt(id)
	return { PlayerId = 1, ProductId = 0, PurchaseId = id }
end

return {
	{ name = "a receipt is only booked once", run = function()
		local session = newSession()
		local ctx, viewer = receiptContext(session)
		local product = Monetization.product("fragments")
		expectEqual(Purchases.processReceipt(ctx, receipt("A"), product), Purchases.GRANTED, "first")
		expectEqual(Purchases.processReceipt(ctx, receipt("A"), product), Purchases.GRANTED, "again")
		expectEqual(session.game.features.starXI.fragments, 500, "fragments once")
		expectEqual(#viewer.profile.receipts, 1, "stored receipts")
		expectEqual(Purchases.processReceipt(ctx, receipt("B"), product), Purchases.GRANTED, "second purchase")
		expectEqual(session.game.features.starXI.fragments, 1000, "fragments twice")
	end },
	{ name = "a failed save retries without acting twice", run = function()
		local session = newSession()
		local ctx, _, saves = receiptContext(session, { false, true })
		local product = Monetization.product("fragments")
		expectEqual(Purchases.processReceipt(ctx, receipt("C"), product), Purchases.RETRY, "not saved")
		expectEqual(session.game.features.starXI.fragments, 500, "effect applied once")
		expectEqual(Purchases.processReceipt(ctx, receipt("C"), product), Purchases.GRANTED, "saved on retry")
		expectEqual(session.game.features.starXI.fragments, 500, "no second effect")
		expectEqual(saves(), 2, "save attempts")
		expectEqual(Purchases.processReceipt(ctx, receipt("C"), product), Purchases.GRANTED, "known receipt")
		expectEqual(saves(), 2, "no extra save for a saved receipt")
	end },
	{ name = "unknown products and absent buyers are retried later", run = function()
		local session = newSession()
		local ctx = receiptContext(session)
		expectEqual(Purchases.processReceipt(ctx, receipt("D"), nil), Purchases.RETRY, "unknown product")
		expectEqual(Purchases.processReceipt(ctx, { PlayerId = 2, ProductId = 0, PurchaseId = "E" }, Monetization.product("fragments")), Purchases.RETRY, "buyer offline")
		expectEqual(session.game.features.starXI.fragments, 0, "nothing applied")
	end },
	{ name = "the receipt list stays bounded", run = function()
		local profile = { receipts = {} }
		for index = 1, Monetization.RECEIPT_LIMIT + 20 do
			Purchases.addReceipt(profile, "R" .. index)
		end
		expectEqual(#profile.receipts, Monetization.RECEIPT_LIMIT, "limit")
		expectTrue(Purchases.hasReceipt(profile, "R" .. (Monetization.RECEIPT_LIMIT + 20)), "newest kept")
		expectTrue(not Purchases.hasReceipt(profile, "R1"), "oldest dropped")
	end },
	{ name = "goal packs pay their minimum and the current production", run = function()
		local small, large, huge = Monetization.product("goalsSmall"), Monetization.product("goalsLarge"), Monetization.product("goalsHuge")
		expectEqual(Monetization.packGoals(small, 0), 1000, "small minimum")
		expectEqual(Monetization.packGoals(large, 0), 10000, "large minimum")
		expectEqual(Monetization.packGoals(huge, 0), 100000, "huge minimum")
		expectEqual(Monetization.packGoals(small, 100), 60000, "10 minutes")
		expectEqual(Monetization.packGoals(large, 100), 360000, "1 hour")
		expectEqual(Monetization.packGoals(huge, 100), 2880000, "8 hours")
	end },
	{ name = "goal packs only raise the balance, never rank or ranking", run = function()
		local session = newSession()
		session.game.upgrades.ballboy = 10
		local production = Economy.basePassivePower(session.game.upgrades, session.game.stars, session.game.features)
		Purchases.grantProduct(session, "goalsSmall", NOW, "Tester")
		expectEqual(session.game.goals, math.max(1000, math.floor(production * 600)), "balance")
		expectEqual(session.game.totalGoals, 0, "total goals untouched")
		expectEqual(session.game.seasonGoals, 0, "season goals untouched")
	end },
	{ name = "goal packs follow the Doppelte Tore pass", run = function()
		local session = newSession({ doubleGoals = true })
		session.game.upgrades.coach = 100
		local production = Economy.basePassivePower(session.game.upgrades, session.game.stars, session.game.features)
		Purchases.grantProduct(session, "goalsSmall", NOW, "Tester")
		expectEqual(session.game.goals, math.floor(production * 2 * 600), "double production")
	end },
	{ name = "Doppelte Tore doubles clicks and production", run = function()
		local plain, double = newSession(), newSession({ doubleGoals = true })
		for _, session in { plain, double } do
			session.game.upgrades.ballboy = 5
			Actions.tick(session, NOW + 1000, 1000, rng)
		end
		expectNear(double.game.goals, plain.game.goals * 2, 1e-6, "production")
		local function clickOnce(session)
			local before = session.game.goals
			Actions.click(session, NOW + 5000, function()
				return 0.5
			end)
			return session.game.goals - before
		end
		expectEqual(clickOnce(double), clickOnce(plain) * 2, "click")
	end },
	{ name = "Auto Klicker clicks once per tick without counting as a click", run = function()
		local without, with = newSession(), newSession({ autoClicker = true })
		expectEqual(Actions.autoClick(without, NOW), nil, "no pass")
		local amount = Actions.autoClick(with, NOW)
		expectEqual(amount, 1, "one click power")
		expectEqual(with.game.goals, 1, "goals")
		expectEqual(with.game.totalGoals, 1, "real goals count for the ranking")
		expectEqual(with.game.clicks, 0, "missions unaffected")
	end },
	{ name = "Schnellreise halves the journey", run = function()
		local venueId = next(Travel.VENUES)
		local fixture = { id = "test", venueId = venueId, opponent = "Test FC", mode = "season", tournamentId = "stadium" }
		local normal = Travel.createJourney(fixture, NOW, function()
			return 0.9
		end, {}, {}, nil)
		local fast = Travel.createJourney(fixture, NOW, function()
			return 0.9
		end, {}, {}, nil, 2)
		expectTrue(math.abs((fast.endsAt - NOW) * 2 - (normal.endsAt - NOW)) <= 1, "half duration")
		local view = Travel.view(fast, fast.endsAt - 1)
		expectTrue(view.progress > 0.99 and not view.arrived, "progress follows the shorter trip")
	end },
	{ name = "the shop Goalboost gives 2x for 15 minutes and stacks its time", run = function()
		local session = newSession()
		Purchases.grantProduct(session, "goalBoost", NOW, "Tester")
		local f = session.game.features
		expectEqual(Economy.goalBoostMultiplier(f, NOW + 1000), 2, "multiplier")
		expectEqual(f.goalBoost.endsAt, NOW + Monetization.BOOST_DURATION_MS, "duration")
		Purchases.grantProduct(session, "goalBoost", NOW + 1000, "Tester")
		expectEqual(f.goalBoost.endsAt, NOW + 2 * Monetization.BOOST_DURATION_MS, "extended")
		f.goalBoost = { tournamentId = "world", multiplier = 3, startedAt = NOW, endsAt = NOW + 60000 }
		Purchases.grantProduct(session, "goalBoost", NOW + 1000, "Tester")
		expectEqual(Economy.goalBoostMultiplier(f, NOW + 2000), 3, "stronger tournament boost kept")
		expectEqual(f.goalBoost.endsAt, NOW + 60000 + Monetization.BOOST_DURATION_MS, "tournament boost extended")
	end },
	{ name = "finishing travel ends the journey or keeps a credit", run = function()
		local session = newSession()
		local f = session.game.features
		Purchases.grantProduct(session, "finishTravel", NOW, "Tester")
		expectEqual(session.game.shopCredits.finishTravel, 1, "credit without journey")
		local ok = Purchases.useCredit(session, "finishTravel", NOW)
		expectTrue(not ok, "credit needs a journey")
		f.travel.journey = { id = "j", fixture = { id = "j", venueId = next(Travel.VENUES), opponent = "Test FC" }, startedAt = NOW, endsAt = NOW + 60000, km = 10, events = {}, consumed = false, counted = false }
		ok = Purchases.useCredit(session, "finishTravel", NOW + 1000)
		expectTrue(ok, "credit used")
		expectEqual(f.travel.journey.endsAt, NOW + 1000, "arrived")
		expectEqual(session.game.shopCredits.finishTravel, 0, "credit spent")
		expectEqual(f.travel.stats.trips, 1, "trip counted")
	end },
	{ name = "mini games become ready at once", run = function()
		local session = newSession()
		session.game.miniGameCooldowns.penalty = NOW + 60000
		Purchases.grantProduct(session, "miniGameReady", NOW, "Tester")
		expectEqual(session.game.miniGameCooldowns.penalty, 0, "cooldown reset")
		expectEqual(session.game.shopCredits.miniGameReady, 0, "no credit when used")
		Purchases.grantProduct(session, "miniGameReady", NOW, "Tester")
		expectEqual(session.game.shopCredits.miniGameReady, 1, "credit when all ready")
	end },
	{ name = "VIP adds a small reward pack to the daily claim", run = function()
		local plain, vip = newSession(), newSession({ vip = true })
		Actions.claimDaily(plain, "solo", NOW)
		Actions.claimDaily(vip, "solo", NOW)
		expectEqual(#vip.game.features.earnedPacks, #plain.game.features.earnedPacks + 1, "extra pack")
		local last = vip.game.features.earnedPacks[#vip.game.features.earnedPacks]
		expectEqual(last.packId, Monetization.VIP_DAILY_PACK, "small reward pack")
	end },
	{ name = "VIP clubs may use the extra colours", run = function()
		local plain, vip = newSession(), newSession({ vip = true })
		local gold = Monetization.VIP_CLUB_COLORS[1]
		Actions.saveClub(plain, { name = "FC Test", color = gold }, NOW)
		Actions.saveClub(vip, { name = "FC Test", color = gold }, NOW)
		expectTrue(plain.game.features.club.color ~= gold, "no VIP colour without the pass")
		expectEqual(vip.game.features.club.color, gold, "VIP colour")
	end },
	{ name = "old saves get the new shop fields", run = function()
		local old = GameState.initial(NOW, rng)
		old.shopCredits = nil
		local normalized = GameState.normalize(old, NOW, rng)
		expectEqual(normalized.shopCredits.finishTravel, 0, "travel credits")
		expectEqual(normalized.shopCredits.miniGameReady, 0, "mini game credits")
	end },
	{ name = "items without a Roblox ID are not offered", run = function()
		for _, pass in Monetization.PASSES do
			expectEqual(Monetization.enabled(pass), pass.id ~= 0, pass.key)
		end
		expectEqual(Monetization.productById(0), nil, "id 0 is never a product")
		expectEqual(Monetization.coopCapacity(false), 4, "normal coop")
		expectEqual(Monetization.coopCapacity(true), 6, "big coop")
	end },
}
