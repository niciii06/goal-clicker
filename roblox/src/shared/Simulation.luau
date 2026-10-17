--!strict
-- Interactive match engine: 22 players on a 105 x 68 pitch, one action at a time (pass, carry,
-- cross, tackle, shot, cards, injuries). Game time runs 0 to 5400 seconds (7200 with extra time).
local Broadcast = require(script.Parent.Broadcast)
local Cards = require(script.Parent.Cards)
local Util = require(script.Parent.Util)

local Simulation = {}

Simulation.GOAL_CELEBRATION_SECONDS = 90
Simulation.RED_CARD_CHANCE_PER_SECOND = 0.0012
Simulation.INJURY_CHANCE_PER_SECOND = 0.00065
Simulation.CELEBRATION_SHARE = 0.62

local clamp = Util.clamp

local function dist(a: any, b: any): number
	return math.sqrt((a.x - b.x) ^ 2 + (a.y - b.y) ^ 2)
end

local function point(p: any): any
	return { x = p.x, y = p.y }
end

local function seedHash(text: string): number
	local hash = Util.fnv(text)
	return hash ~= 0 and hash or 1
end

local function random(c: any): number
	local n = c.rng
	n = bit32.bxor(n, bit32.lshift(n, 13))
	n = bit32.bxor(n, bit32.rshift(n, 17))
	n = bit32.bxor(n, bit32.lshift(n, 5))
	c.rng = n ~= 0 and n or 1
	return c.rng / 4294967296
end

local function attribute(source: Cards.Player?, key: string, fallback: number): number
	return clamp(Cards.attribute(source, key, fallback), 1, 99)
end

local function makePlayer(id: string, name: string, role: string, slot: number, side: string, number: number, rating: number, source: Cards.Player?, formationId: string, direction: number, bonus: number?): any
	local formationSlot = Cards.formation(formationId).slots[slot]
	local x = role == "TW" and 3 or 12 + (100 - formationSlot.y) * 0.68
	local y = role == "TW" and 34 or 5 + formationSlot.x * 0.58
	local right = (side == "club" and direction or -direction) > 0
	local anchor = { x = right and x or 105 - x, y = right and y or 68 - y }
	local base = clamp(rating + (bonus or 0) * 3, 1, 99)
	return {
		id = id, name = name, role = role, slot = slot, side = side, number = number, rating = base,
		passing = attribute(source, "shortPassing", base), shooting = attribute(source, "finishing", base),
		pace = attribute(source, "sprintSpeed", base), defending = attribute(source, "standingTackle", base),
		keeping = attribute(source, "gkReflexes", base), control = attribute(source, "dribbling", base),
		stamina = attribute(source, "stamina", base), fitness = 100, active = true,
		anchor = anchor, x = anchor.x, y = anchor.y,
	}
end

local function kickoff(c: any, side: string)
	c.possession = side
	c.lastPass = nil
	c.chain = 0
	c.ball = { x = 52.5, y = 34 }
	c.restart = true
	for _, p in c.players do
		local right = (p.side == "club" and c.direction or -c.direction) > 0
		if p.role == "TW" then
			p.x = p.anchor.x
		elseif right then
			p.x = math.min(48, p.anchor.x * 0.65)
		else
			p.x = math.max(57, 105 - (105 - p.anchor.x) * 0.65)
		end
		p.y = p.anchor.y
	end
	local taker, best = nil, math.huge
	for _, p in c.players do
		if p.active and p.side == side and p.role ~= "TW" then
			local distance = math.abs(p.x - 52.5)
			if distance < best then
				taker, best = p, distance
			end
		end
	end
	if taker then
		taker.x, taker.y = 52.5, 34
		c.owner = taker.id
	end
end

local function boundaryFor(time: number): number
	return time < 2700 and 2700 or time < 5400 and 5400 or 7200
end

function Simulation.create(cup: any, lineupIds: { string }, formationId: string): any
	local broadcast = cup.broadcast or Broadcast.create(cup)
	local id = cup.careerMatchId or ("%s:%s"):format(tostring(cup.matchStartedAt), cup.opponent)
	local seed = seedHash(id)
	local direction = (cup.fixture and cup.fixture.away) and -1 or 1
	local formation = Cards.formation(formationId)
	local players = {}
	for index, playerId in lineupIds do
		local card = Cards.get(playerId)
		if card then
			local bonus = cup.careerBonuses and cup.careerBonuses[playerId] or 0
			table.insert(players, makePlayer(playerId, card.name, formation.slots[index].position, index, "club", index, card.rating, card, formation.id, direction, bonus))
		end
	end
	for _, opponent in broadcast.opponentXI do
		table.insert(players, makePlayer(opponent.id, opponent.name, opponent.position, opponent.slot, "opponent", opponent.number, cup.opponentRating, Cards.get(opponent.sourceId), broadcast.opponentFormation, direction))
	end
	local checkpoint = { time = 0, rng = seed, sequence = 0, players = players, ball = { x = 52.5, y = 34 }, owner = "", possession = "club", chain = 0, restart = true, direction = direction }
	kickoff(checkpoint, "club")
	local sim = {
		version = 2, id = id, seed = seed, time = 0, committed = checkpoint, buffer = {}, recent = {}, generation = 0,
		status = "running", halftimeDone = false, pauseRequested = false,
		clubFormation = formation.id, opponentFormation = broadcast.opponentFormation,
		strategy = cup.strategyId, opponentStrategy = cup.opponentStrategyId,
	}
	Simulation.refill(sim)
	return sim
end

local function choose(c: any, items: { any }, weight: (any) -> number): any
	if #items == 0 then
		return nil
	end
	local weights, total = {}, 0
	for index, item in items do
		weights[index] = math.max(0.01, weight(item))
		total += weights[index]
	end
	local n = random(c) * total
	for index, w in weights do
		n -= w
		if n <= 0 then
			return items[index]
		end
	end
	return items[#items]
end

local function movePlayers(c: any, duration: number, strategy: string, opponentStrategy: string, actor: any, target: any?)
	local old = Util.map(c.players, function(p)
		return { id = p.id, x = p.x, y = p.y, active = p.active }
	end)
	for _, p in c.players do
		if p.active then
			local right = p.side == "club" and c.direction or -c.direction
			local own = p.side == c.possession
			local tactic = p.side == "club" and strategy or opponentStrategy
			local x = p.anchor.x + (own and right * (tactic == "angriff" and 12 or 7) or right * -7) + (c.ball.x - 52.5) * 0.27
			local y = p.anchor.y + (c.ball.y - 34) * 0.24
			if p.role == "TW" then
				x = right > 0 and 3 + clamp(c.ball.x / 25, 0, 3) or 102 - clamp((105 - c.ball.x) / 25, 0, 3)
				y = 34 + (c.ball.y - 34) * 0.12
			elseif p.id == actor.id or (target and p.id == target.id) then
				x, y = p.x, p.y
			elseif not own and dist(p, c.ball) < 16 then
				x, y = (x + c.ball.x) / 2, (y + c.ball.y) / 2
			end
			for _, q in old do
				if q.active and q.id ~= p.id then
					local d = dist(p, q)
					if d > 0 and d < 4 then
						x += (p.x - q.x) / d * (4 - d)
						y += (p.y - q.y) / d * (4 - d)
					end
				end
			end
			local d = math.sqrt((x - p.x) ^ 2 + (y - p.y) ^ 2)
			local step = math.min(d, duration * (0.17 + p.pace * 0.002) * (p.role == "TW" and 0.5 or 1))
			if d > 0 then
				p.x = clamp(p.x + (x - p.x) / d * step, 1.5, 103.5)
				p.y = clamp(p.y + (y - p.y) / d * step, 1.5, 66.5)
			end
			local load = p.role == "TW" and 0.13 or tactic == "angriff" and 0.52 or 0.39
			p.fitness = clamp(p.fitness - duration / 60 * load * clamp(1 + (70 - p.stamina) / 200, 0.85, 1.35), 15, 100)
		end
	end
end

local function findPlayer(c: any, id: string?): any
	if not id then
		return nil
	end
	for _, p in c.players do
		if p.id == id then
			return p
		end
	end
	return nil
end

local function prepare(sim: any, start: any): any
	local before = Util.deepCopy(start)
	local c = Util.deepCopy(start)
	local active = Util.filter(c.players, function(p)
		return p.active
	end)
	local actor = Util.find(active, function(p)
		return p.id == c.owner
	end) or Util.find(active, function(p)
		return p.side == c.possession
	end)
	if not actor then
		error("Kein aktiver Ballbesitzer")
	end
	c.owner = actor.id
	c.possession = actor.side
	local right = actor.side == "club" and c.direction or -c.direction
	local progress = right > 0 and actor.x or 105 - actor.x
	local goal = { x = right > 0 and 105 or 0, y = 34 }
	local tactic = actor.side == "club" and sim.strategy or sim.opponentStrategy
	local rivals = Util.filter(active, function(p)
		return p.side ~= actor.side
	end)
	local mates = Util.filter(active, function(p)
		return p.side == actor.side and p.id ~= actor.id
	end)
	local pressure = Util.sum(rivals, function(p)
		return math.max(0, 1 - dist(p, actor) / 14)
	end)
	local kind, outcome = "pass", "success"
	local target: any = nil
	local to = point(actor)
	local assist: string? = nil
	local celebration = false
	local duration = 18 + math.floor(random(c) * 18)
	local roll = random(c)
	if c.restart then
		kind = "restart"
		duration = 18
		-- After a goal the ball lies in the net: allow a celebration before the kickoff.
		if dist(c.ball, { x = 52.5, y = 34 }) > 35 then
			duration = Simulation.GOAL_CELEBRATION_SECONDS
			celebration = true
			kickoff(c, c.possession)
			actor = findPlayer(c, c.owner)
			to = { x = 52.5, y = 34 }
		else
			local candidates = Util.filter(mates, function(p)
				return p.role ~= "TW"
			end)
			table.sort(candidates, function(a, b)
				return dist(a, actor) < dist(b, actor)
			end)
			target = candidates[1]
			to = target and point(target) or point(actor)
		end
		c.restart = false
	elseif actor.role ~= "TW" and progress > 68 and roll < clamp((progress - 65) / 60 + (tactic == "angriff" and 0.08 or 0) + c.chain * 0.009, 0.06, 0.6) then
		kind = "shot"
		duration = 12
		local keeper = Util.find(rivals, function(p)
			return p.role == "TW"
		end)
		local distance = dist(actor, goal)
		local angle = clamp(1 - math.abs(actor.y - 34) / 35, 0.15, 1)
		local quality = clamp((0.52 - distance * 0.009) * angle * (0.5 + actor.shooting / 100) * (1 - pressure * 0.12) * (0.75 + actor.fitness / 400) * (1 + (actor.rating - (keeper and keeper.keeping or 70)) * 0.009), 0.018, 0.55)
		local shot = random(c)
		outcome = shot < quality and "goal" or shot < quality + 0.38 and "save" or shot < quality + 0.62 and "blocked" or "wide"
		to = { x = right > 0 and 104 or 1, y = outcome == "wide" and clamp(21 + random(c) * 26, 20, 48) or 30.5 + random(c) * 7 }
		if outcome == "goal" and c.lastPass and c.lastPass.to == actor.id and c.time - c.lastPass.time <= 70 and c.lastPass.id ~= actor.id then
			assist = c.lastPass.id
		end
		if outcome == "save" then
			target = keeper
		else
			target = choose(c, rivals, function(p)
				return p.role == "TW" and 3 or 1 / (1 + dist(p, goal))
			end)
		end
	elseif actor.role ~= "TW" and pressure > 0.5 and roll < 0.13 then
		kind, outcome = "tackle", "lost"
		target = choose(c, rivals, function(p)
			return p.defending / (3 + dist(p, actor))
		end)
		to = point(actor)
	elseif actor.role ~= "TW" and roll < 0.35 then
		kind = "carry"
		to = { x = clamp(actor.x + right * (5 + random(c) * 10), 3, 102), y = clamp(actor.y + (random(c) - 0.5) * 12, 3, 65) }
		outcome = random(c) < clamp(0.04 + pressure * 0.09 + (70 - actor.control) * 0.002, 0.015, 0.3) and "lost" or "success"
		if outcome == "lost" then
			local spot = to
			target = choose(c, rivals, function(p)
				return p.defending / (4 + dist(p, spot))
			end)
		end
	else
		target = choose(c, mates, function(p)
			local forward = (p.x - actor.x) * right
			local d = dist(p, actor)
			local near = Util.sum(rivals, function(q)
				return math.max(0, 1 - dist(p, q) / 12)
			end)
			local push = tactic == "konter" and 0.055 or tactic == "angriff" and 0.045 or 0.018
			return (p.role == "TW" and 0.12 or 1) * math.exp(clamp(forward * push, -2, 2)) * (1 + math.abs(p.y - actor.y) * 0.015) / (1 + d * 0.018 + near)
		end)
		if not target then
			kind = "carry"
			to = { x = clamp(actor.x + right * 8, 3, 102), y = actor.y }
		else
			to = point(target)
			if progress > 72 and math.abs(actor.y - 34) > 15 and (target.x - actor.x) * right > -8 then
				kind = "cross"
			end
			local defensiveSkill = Util.sum(rivals, function(p)
				return p.defending
			end) / math.max(1, #rivals)
			local d = dist(actor, to)
			local lane = #Util.filter(rivals, function(p)
				return dist(p, actor) + dist(p, to) < d + 3
			end)
			if random(c) > clamp(0.91 + (actor.passing - 70) * 0.003 - d * 0.002 - lane * 0.06 - pressure * 0.04 - (defensiveSkill - 70) * 0.001, 0.48, 0.96) then
				kind, outcome = "interception", "lost"
				local spot = to
				target = choose(c, rivals, function(p)
					return p.defending / (3 + dist(p, spot))
				end)
				to = point(target)
			end
		end
	end
	-- Rare red cards and injuries belong to the same action stream.
	local hazard = random(c)
	if kind ~= "restart" and actor.role ~= "TW" and hazard < duration * Simulation.RED_CARD_CHANCE_PER_SECOND / 30 then
		kind, outcome = "red", "lost"
		target = choose(c, rivals, function(p)
			return 1 / (3 + dist(p, actor))
		end)
		to = point(actor)
	elseif kind ~= "restart" and actor.side == "club" and actor.role ~= "TW" and hazard < duration * (Simulation.RED_CARD_CHANCE_PER_SECOND + 2 * Simulation.INJURY_CHANCE_PER_SECOND) / 30 then
		kind, outcome = "injury", "lost"
		target = choose(c, rivals, function(p)
			return 1 / (3 + dist(p, actor))
		end)
		to = point(actor)
	elseif kind == "tackle" and hazard < 0.18 then
		kind = "yellow"
	end

	duration = math.max(1, math.min(duration, boundaryFor(c.time) - c.time))
	local id = ("%s:a%d"):format(sim.id, c.sequence)
	c.sequence += 1
	local finish = c.time + duration
	movePlayers(c, celebration and math.min(duration, 18) or duration, sim.strategy, sim.opponentStrategy, actor, target)
	local liveActor = findPlayer(c, actor.id)
	if kind == "carry" then
		liveActor.x, liveActor.y = to.x, to.y
	end
	c.ball = to
	c.time = finish
	c.chain += 1
	local liveTarget = target and findPlayer(c, target.id)
	if kind == "shot" then
		c.lastPass = nil
		c.chain = 0
		local fallback = rivals[1]
		local receiver = liveTarget or (fallback and findPlayer(c, fallback.id))
		if outcome == "goal" then
			c.possession = actor.side == "club" and "opponent" or "club"
			c.owner = receiver and receiver.id or c.owner
			c.restart = true
		elseif receiver then
			c.owner = receiver.id
			c.possession = receiver.side
			c.ball = point(receiver)
		end
	elseif outcome == "lost" and liveTarget then
		if kind == "tackle" or kind == "red" or kind == "yellow" or kind == "injury" then
			liveTarget.x, liveTarget.y = to.x, to.y
		end
		c.ball = point(liveTarget)
		c.owner = liveTarget.id
		c.possession = liveTarget.side
		c.lastPass = nil
		c.chain = 0
		if kind == "red" or kind == "injury" then
			liveActor.active = false
		end
	elseif liveTarget then
		c.owner = liveTarget.id
		c.lastPass = { id = actor.id, to = liveTarget.id, time = finish }
	else
		c.owner = actor.id
		c.lastPass = nil
	end
	return {
		id = id, kind = kind, start = before.time, finish = finish, side = actor.side, actor = actor.id,
		target = target and target.id, from = point(before.ball), to = to, outcome = outcome, assist = assist,
		before = before, after = c,
	}
end

function Simulation.refill(sim: any)
	local last = sim.buffer[#sim.buffer]
	local tail = last and last.after or sim.committed
	while tail.time < math.min(sim.time + 75, boundaryFor(sim.time)) do
		local action = prepare(sim, tail)
		table.insert(sim.buffer, action)
		tail = action.after
	end
end

-- Commits all actions up to the current real time; fills the cup events, score and statistics.
-- Mutates and returns the cup (the server owns the state, copying it every second is wasteful).
function Simulation.advance(cup: any, now: number, regularDurationMs: number): any
	local sim = cup.simulation
	if sim.status ~= "running" or cup.matchPaused then
		return cup
	end
	local limit = cup.phase == "extra-time" and 7200 or 5400
	local secondsPerMs = 5400 / regularDurationMs
	local target = math.max(sim.time, math.min(limit, (math.min(now, cup.matchEndsAt) - cup.matchStartedAt) * secondsPerMs))
	cup.broadcast = cup.broadcast or Broadcast.create(cup)
	for _ = 1, 1000 do
		Simulation.refill(sim)
		local action = sim.buffer[1]
		if not action or action.finish > target then
			break
		end
		table.remove(sim.buffer, 1)
		sim.committed = action.after
		sim.time = action.finish
		table.insert(sim.recent, action)
		sim.recent = Util.tail(sim.recent, 12)
		local at = cup.matchStartedAt + action.finish / secondsPerMs
		local minute = math.max(1, math.min(120, math.ceil(action.finish / 60)))
		local actor = findPlayer(action.before, action.actor)
		local stats = action.side == "club" and cup.broadcast.clubStats or cup.broadcast.opponentStats
		local other = action.side == "club" and cup.broadcast.opponentStats or cup.broadcast.clubStats
		stats.possessionSeconds += (action.kind == "restart" and math.min(action.finish - action.start, 18) or action.finish - action.start) / 15
		if action.kind == "shot" then
			stats.shots += 1
			if action.outcome == "goal" or action.outcome == "save" then
				stats.onTarget += 1
			end
			if action.outcome == "save" then
				other.saves += 1
			end
			if action.outcome == "goal" then
				if action.side == "club" then
					cup.homeScore += 1
				else
					cup.awayScore += 1
				end
				local assist = action.assist and Util.find(action.before.players, function(p)
					return p.id == action.assist and p.active and p.side == action.side
				end)
				local impacts = {}
				if action.side == "club" then
					impacts[actor.id] = 0.7
					if assist then
						impacts[assist.id] = 0.25
					end
				end
				local goal = {
					id = action.id, side = action.side == "club" and "home" or "away", scorerId = actor.id, scorer = actor.name,
					minute = minute, createdAt = at, homeScore = cup.homeScore, awayScore = cup.awayScore, ratingImpacts = impacts,
					assistId = assist and assist.id or nil, assistName = assist and assist.name or nil, pattern = "low-shot",
				}
				table.insert(cup.matchEvents, goal)
				cup.lastGoal = goal
				if action.side == "club" then
					cup.allTimeScorers[actor.id] = (cup.allTimeScorers[actor.id] or 0) + 1
				end
			else
				table.insert(cup.broadcast.events, {
					id = action.id, kind = "shot", side = action.side, minute = minute, at = at, playerId = actor.id, player = actor.name,
					outcome = action.outcome, keeperId = action.outcome == "save" and action.target or nil, lane = action.to.y,
				})
			end
		end
		if action.kind == "red" then
			table.insert(cup.cardEvents, {
				id = action.id, side = action.side == "club" and "home" or "away", playerId = actor.id, player = actor.name,
				reason = "Grobe Unsportlichkeit", card = "red", minute = minute, createdAt = at, homeScore = cup.homeScore, awayScore = cup.awayScore,
			})
			if action.side == "club" then
				table.insert(cup.sentOffPlayerIds, actor.id)
				table.insert(cup.suspendedPlayerIds, actor.id)
				cup.playerExitedAt[actor.id] = minute
			end
		end
		if action.kind == "yellow" then
			stats.yellowCards += 1
			table.insert(cup.broadcast.events, { id = action.id, kind = "yellow", side = action.side, minute = minute, at = at, playerId = actor.id, player = actor.name, lane = actor.y })
		end
		if action.kind == "injury" then
			local injury = {
				id = action.id, playerId = actor.id, player = actor.name, reason = "Muskelverletzung", matches = 1 + (sim.committed.rng % 3),
				minute = minute, createdAt = at, homeScore = cup.homeScore, awayScore = cup.awayScore,
			}
			table.insert(cup.injuryEvents, injury)
			cup.lastInjury = injury
			cup.injuredPlayerIds[actor.id] = injury.matches
			cup.playerExitedAt[actor.id] = minute
			sim.status = "editing"
			cup.matchPaused = true
			cup.lastResult = actor.name .. " ist verletzt. Wechsel prüfen oder ohne Ersatz weiterspielen."
			sim.buffer = {}
		end
		local fitness = {}
		for _, p in sim.committed.players do
			fitness[p.id] = p.fitness
		end
		cup.broadcast.fitness = fitness
		cup.broadcast.fitnessMinute = minute
		if action.finish == 2700 and not sim.halftimeDone then
			sim.halftimeDone = true
			sim.status = "halftime"
			for _, p in sim.committed.players do
				p.anchor = { x = 105 - p.anchor.x, y = 68 - p.anchor.y }
			end
			sim.committed.direction *= -1
			kickoff(sim.committed, "opponent")
			sim.buffer = {}
			cup.matchPaused = true
			cup.lastResult = "Halbzeit. Taktik und Wechsel prüfen, danach weiterspielen."
			break
		end
		if cup.matchPaused then
			break
		end
		if sim.pauseRequested then
			sim.pauseRequested = false
			sim.status = "editing"
			cup.matchPaused = true
			sim.buffer = {}
			break
		end
	end
	cup.broadcast.events = Util.tail(cup.broadcast.events, 180)
	if not cup.matchPaused then
		sim.time = target
	end
	cup.lastTickAt = cup.matchStartedAt + sim.time / secondsPerMs
	Simulation.refill(sim)
	return cup
end

function Simulation.invalidate(cup: any): any
	local sim = cup.simulation
	if sim then
		sim.buffer = {}
		sim.generation += 1
		sim.strategy = cup.strategyId
		Simulation.refill(sim)
	end
	return cup
end

function Simulation.resume(cup: any): any
	local sim = cup.simulation
	if sim then
		sim.status = "running"
		sim.pauseRequested = false
		Simulation.invalidate(cup)
	end
	return cup
end

-- Saves never carry prepared outcomes; the buffer is rebuilt from the committed checkpoint.
function Simulation.forSave(sim: any): any
	local copy = table.clone(sim)
	copy.buffer = {}
	return copy
end

local function ease(n: number): number
	local v = clamp(n, 0, 1)
	return v * v * (3 - 2 * v)
end

-- Interpolated positions for rendering at a game time (seconds). Works on a light frame list
-- (actions with before and after positions) so the client can render without the full engine.
function Simulation.frame(actions: { any }, committed: any, time: number): any
	local action = nil
	for _, candidate in actions do
		if candidate.start <= time and candidate.finish >= time then
			action = candidate
			break
		end
	end
	if not action then
		for index = #actions, 1, -1 do
			if actions[index].finish <= time then
				action = actions[index]
				break
			end
		end
	end
	if not action then
		return { players = committed.players, ball = committed.ball, action = nil, progress = 0 }
	end
	local t = action.finish > action.start and clamp((time - action.start) / (action.finish - action.start), 0, 1) or 1
	local goal = nil
	if action.kind == "restart" then
		for _, candidate in actions do
			if candidate.finish == action.start and candidate.kind == "shot" and candidate.outcome == "goal" then
				goal = candidate
			end
		end
	end
	local afterById = {}
	for _, p in action.after.players do
		afterById[p.id] = p
	end
	local players = {}
	if goal then
		local scorer = Util.find(action.before.players, function(p)
			return p.id == goal.actor
		end)
		local goalRight = goal.to.x > 52.5
		local corner = { x = goalRight and 101.2 or 3.8, y = ((scorer and scorer.y or 34) < 34) and 3.8 or 64.2 }
		local mates = Util.filter(action.before.players, function(p)
			return p.active and p.side == goal.side and p.role ~= "TW" and p.id ~= goal.actor
		end)
		local function party(p: any, u: number): any
			if p.id == goal.actor then
				local run = ease(u / 0.38)
				local hop = (u > 0.38 and u < Simulation.CELEBRATION_SHARE) and math.abs(math.sin(u * 48)) * 0.9 or 0
				return { x = p.x + (corner.x - p.x) * run, y = p.y + (corner.y - p.y) * run - hop }
			end
			local index = math.max(0, Util.findIndex(mates, function(m)
				return m.id == p.id
			end) - 1)
			local angle, radius = index * 2.4 + 0.6, 2.4 + (index % 3) * 1.3
			local spot = {
				x = clamp(corner.x + math.cos(angle) * radius * (goalRight and -1 or 1), 1.5, 103.5),
				y = clamp(corner.y + math.abs(math.sin(angle)) * radius * (corner.y < 34 and 1 or -1), 1.5, 66.5),
			}
			local delay = math.min(0.16, math.sqrt((p.x - corner.x) ^ 2 + (p.y - corner.y) ^ 2) / 420)
			local run = ease((u - delay) / (0.5 - delay))
			return { x = p.x + (spot.x - p.x) * run, y = p.y + (spot.y - p.y) * run }
		end
		local back = ease((t - Simulation.CELEBRATION_SHARE) / (1 - Simulation.CELEBRATION_SHARE))
		for _, p in action.before.players do
			if p.active then
				local finish = afterById[p.id] or p
				local position
				if p.side ~= goal.side or p.role == "TW" then
					position = { x = p.x + (finish.x - p.x) * ease(t), y = p.y + (finish.y - p.y) * ease(t) }
				elseif t < Simulation.CELEBRATION_SHARE then
					position = party(p, t)
				else
					local peak = party(p, Simulation.CELEBRATION_SHARE)
					position = { x = peak.x + (finish.x - peak.x) * back, y = peak.y + (finish.y - peak.y) * back }
				end
				table.insert(players, { id = p.id, name = p.name, side = p.side, role = p.role, number = p.number, x = position.x, y = position.y })
			end
		end
		local ball = { x = action.from.x + (action.to.x - action.from.x) * back, y = action.from.y + (action.to.y - action.from.y) * back }
		return { players = players, ball = ball, action = action, progress = t, celebration = { side = goal.side, scorerId = goal.actor, progress = t } }
	end
	for _, p in action.before.players do
		if p.active then
			local finish = afterById[p.id] or p
			table.insert(players, { id = p.id, name = p.name, side = p.side, role = p.role, number = p.number, x = p.x + (finish.x - p.x) * t, y = p.y + (finish.y - p.y) * t })
		end
	end
	local ball = { x = action.from.x + (action.to.x - action.from.x) * t, y = action.from.y + (action.to.y - action.from.y) * t }
	return { players = players, ball = ball, action = action, progress = t }
end

return Simulation
