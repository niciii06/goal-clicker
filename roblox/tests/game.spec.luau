local Shared = game:GetService("ReplicatedStorage").Shared
local Server = game:GetService("ServerScriptService").Server
local Actions = require(Server.Actions)
local GameState = require(Shared.GameState)
local StarXI = require(Shared.StarXI)
local Cards = require(Shared.Cards)

local seed = 7
local function rng()
	seed = (seed * 1103515245 + 12345) % 2147483648
	return seed / 2147483648
end

local function newSession(now)
	local session = Actions.newSession(GameState.initial(now, rng))
	return session
end

local function fillSquad(session, now)
	session.game.goals = 1e9
	for _ = 1, 60 do
		local ok, message = Actions.run(session, "buyPack", { id = "scout" }, now, rng)
		assert(ok, message)
	end
	local ok, message = Actions.run(session, "bestLineup", {}, now, rng)
	assert(ok, message)
end

local function playUntilDone(session, start)
	local now = start
	for _ = 1, 4000 do
		now += 1000
		Actions.tick(session, now, 1000, rng)
		local cup = session.game.features.cup
		if not cup.active then
			return now
		end
		if cup.phase == "penalties" then
			Actions.run(session, "penalty", { direction = "left" }, now, rng)
		elseif cup.matchPaused then
			Actions.run(session, "resumeMatch", {}, now, rng)
		end
	end
	error("match did not finish")
end

return {
	{ name = "clicks earn goals and respect the rate limit", run = function()
		local session = newSession(1e12)
		local total = 0
		for i = 1, 30 do
			local amount = Actions.click(session, 1e12 + i * 10, rng)
			if amount then
				total += amount
			end
		end
		expectTrue(total >= 20 and total <= 60, "goals from clicks " .. total)
		expectEqual(session.game.clicks, 20, "accepted clicks")
	end },
	{ name = "upgrades cost goals", run = function()
		local session = newSession(1e12)
		session.game.goals = 100
		local ok = Actions.run(session, "buyUpgrade", { id = "boots", mode = 1 }, 1e12, rng)
		expectTrue(ok, "bought")
		expectEqual(session.game.goals, 75)
		expectEqual(session.game.upgrades.boots, 1)
	end },
	{ name = "a full league match is played and recorded", run = function()
		local now = 1.7e12
		local session = newSession(now)
		fillSquad(session, now)
		local f = session.game.features
		expectEqual(StarXI.filledCount(f.starXI.lineupIds), 11, "lineup")
		local ok, message = Actions.run(session, "startMatch", { mode = "season" }, now, rng)
		expectTrue(ok, message)
		expectTrue(f.cup.active and f.cup.simulation ~= nil, "match running")
		now = playUntilDone(session, now)
		expectEqual(#f.seasonMode.history, 1, "league history")
		expectEqual(#f.career.reports, 1, "career report")
		expectTrue(f.seasonMode.matchday == 1, "matchday advanced")
		-- second matchday is away: first the journey, then the match
		ok, message = Actions.run(session, "startMatch", { mode = "season" }, now, rng)
		expectTrue(ok, message)
		expectTrue(f.travel.journey ~= nil and not f.cup.active, "journey started " .. message)
		now = f.travel.journey.endsAt + 1
		ok, message = Actions.run(session, "startMatch", { mode = "season" }, now, rng)
		expectTrue(ok and f.cup.active, "away match " .. tostring(message))
		now = playUntilDone(session, now)
		expectEqual(#f.seasonMode.history, 2)
	end },
	{ name = "a tournament runs to its end", run = function()
		local now = 1.7e12
		local session = newSession(now)
		fillSquad(session, now)
		session.testMode = true
		local f = session.game.features
		for _ = 1, 8 do
			local ok, message = Actions.run(session, "startMatch", { mode = "tournament", tournamentId = "stadium" }, now, rng)
			if ok and not f.cup.active and f.travel.journey then
				now = f.travel.journey.endsAt + 1
				ok, message = Actions.run(session, "startMatch", { mode = "tournament", tournamentId = "stadium" }, now, rng)
			end
			if not ok then
				break
			end
			now = playUntilDone(session, now)
			if not f.cup.pendingNextRound then
				break
			end
		end
		expectTrue(#f.gazetteIssues == 1, "gazette published")
		expectTrue(f.cup.nextTournamentAt > now - 1000, "cooldown")
	end },
	{ name = "mini game pays out once", run = function()
		local session = newSession(1e12)
		Actions.run(session, "startMiniGame", { id = "penalty" }, 1e12, rng)
		for _ = 1, 5 do
			Actions.run(session, "playMiniGame", { choice = "links" }, 1e12, rng)
		end
		expectTrue(session.game.goals >= 250, "reward")
		local ok = Actions.run(session, "startMiniGame", { id = "penalty" }, 1e12 + 1000, rng)
		expectEqual(ok, false, "cooldown")
	end },
	{ name = "daily reward and codes", run = function()
		local session = newSession(1.76e12)
		local ok = Actions.claimDaily(session, "solo", 1.76e12)
		expectTrue(ok, "daily")
		expectEqual(select(1, Actions.claimDaily(session, "solo", 1.76e12 + 1000)), false, "second claim")
		ok = Actions.run(session, "redeemCode", { code = "silvan" }, 1.76e12, rng)
		expectTrue(ok and table.find(session.game.features.starXI.ownedIds, "star-silvuz") ~= nil, "silvuz")
	end },
}
