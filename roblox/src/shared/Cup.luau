--!strict
-- Matches: tournaments and league matches, live engine, penalties and in-match changes.
-- cup.round is 0 based like in the web version; slots and opponent lists are 1 based.
local Broadcast = require(script.Parent.Broadcast)
local Cards = require(script.Parent.Cards)
local Catalog = require(script.Parent.Data.Catalog) :: any
local MatchRatings = require(script.Parent.MatchRatings)
local Simulation = require(script.Parent.Simulation)
local StarXI = require(script.Parent.StarXI)
local Util = require(script.Parent.Util)

local Cup = {}

Cup.TOURNAMENTS = Catalog.tournaments :: { any }
Cup.COOLDOWN_MS = 5 * 60 * 1000
Cup.STRATEGIES = {
	{ id = "angriff", label = "Offensivpressing", description = "Stark gegen Ballbesitz, anfällig für Konter" },
	{ id = "konter", label = "Schneller Konter", description = "Stark gegen Pressing, anfällig für Ballbesitz" },
	{ id = "ballbesitz", label = "Ballbesitz", description = "Stark gegen Konter, anfällig für Pressing" },
}
Cup.GOAL_WEIGHTS = Catalog.goalWeights :: { [string]: number }

local clamp = Util.clamp

function Cup.tournament(id: string?): any
	for _, tournament in Cup.TOURNAMENTS do
		if tournament.id == id then
			return tournament
		end
	end
	return nil
end

function Cup.strategy(id: string?): any
	for _, strategy in Cup.STRATEGIES do
		if strategy.id == id then
			return strategy
		end
	end
	return Cup.STRATEGIES[2]
end

function Cup.initial(): any
	return {
		active = false, mode = "season", phase = "regular", tournamentId = "stadium", round = 0, wins = 0, best = 0,
		trophies = { stadium = 0, champions = 0, world = 0 }, lastResult = "Noch kein Saisonspiel.",
		matchStartedAt = 0, matchEndsAt = 0, lastTickAt = 0, homeScore = 0, awayScore = 0, opponent = "", opponentRating = 58,
		opponentStrategyId = "ballbesitz", opponentIds = {}, strategyId = "konter", substitutionsUsed = 0, matchMomentum = 0,
		originalLineupIds = {}, originalBenchIds = {}, playerEnteredAt = {}, playerExitedAt = {}, playerMatchPositions = {},
		lastGoal = nil, lastInjury = nil, matchEvents = {}, cardEvents = {}, injuryEvents = {}, sentOffPlayerIds = {},
		suspendedPlayerIds = {}, injuredPlayerIds = {}, matchPaused = false, pendingNextRound = false, nextTournamentAt = 0,
		penaltyHomeScore = 0, penaltyAwayScore = 0, penaltyHomeTaken = 0, penaltyAwayTaken = 0, penaltyTurn = "home",
		penaltyEvents = {}, penaltyMessage = "", allTimeScorers = {}, allTimeAppearances = {},
	}
end

function Cup.opponentSchedule(tournament: any, random: () -> number): { string }
	local shuffled = table.clone(tournament.opponents)
	for index = #shuffled, 2, -1 do
		local swap = math.floor(Util.bounded(random) * index) + 1
		shuffled[index], shuffled[swap] = shuffled[swap], shuffled[index]
	end
	local ids = {}
	for index = 1, tournament.rounds do
		ids[index] = shuffled[index].id
	end
	return ids
end

local function opponentById(tournament: any, id: string?): any
	if not id then
		return nil
	end
	for _, opponent in tournament.opponents do
		if opponent.id == id then
			return opponent
		end
	end
	return nil
end

function Cup.opponentAt(tournament: any, round: number, opponentIds: { string }): any
	local scheduled = opponentById(tournament, opponentIds[round + 1])
	if scheduled then
		return scheduled
	end
	local used = {}
	for index = 1, round do
		used[opponentIds[index] or ""] = true
	end
	for _, opponent in tournament.opponents do
		if not used[opponent.id] then
			return opponent
		end
	end
	return tournament.opponents[math.min(round + 1, #tournament.opponents)]
end

local function tournamentDuration(minimumRating: number): number
	return minimumRating >= 85 and 300000 or minimumRating >= 70 and 270000 or 240000
end

local function freshMatch(cup: any, now: number, duration: number, homePlayers: { Cards.Player }, positions: { string }): any
	local entered, matchPositions = {}, {}
	local appearances = table.clone(cup.allTimeAppearances or {})
	local index = 0
	for _, player in homePlayers do
		if not player.benchOnly then
			index += 1
			entered[player.id] = 1
			matchPositions[player.id] = positions[index] or player.position
			appearances[player.id] = math.max(0, math.floor(appearances[player.id] or 0)) + 1
		end
	end
	cup.simulation = nil
	cup.broadcast = nil
	cup.careerRatingSeed = now
	cup.careerBonuses = nil
	cup.active = true
	cup.phase = "regular"
	cup.matchStartedAt = now
	cup.regularDurationMs = duration
	cup.matchEndsAt = now + duration
	cup.lastTickAt = now
	cup.homeScore, cup.awayScore = 0, 0
	cup.substitutionsUsed = 0
	cup.subWindowsUsed = 0
	cup.matchMomentum = 0
	cup.playerEnteredAt = entered
	cup.playerExitedAt = {}
	cup.playerMatchPositions = matchPositions
	cup.lastGoal, cup.lastInjury = nil, nil
	cup.matchEvents, cup.cardEvents, cup.injuryEvents = {}, {}, {}
	cup.sentOffPlayerIds = {}
	cup.matchPaused = false
	cup.penaltyHomeScore, cup.penaltyAwayScore, cup.penaltyHomeTaken, cup.penaltyAwayTaken = 0, 0, 0, 0
	cup.penaltyTurn = "home"
	cup.penaltyEvents = {}
	cup.penaltyMessage = ""
	cup.allTimeAppearances = appearances
	return cup
end

-- Starts the first round of a tournament or the pending next round.
function Cup.beginTournament(cupIn: any, now: number, tournamentId: string, homePlayers: { Cards.Player }, positions: { string }, lineupIds: { string }, benchIds: { string }, plannedOpponentIds: { string }?, random: () -> number): any
	local cup = Util.deepCopy(cupIn)
	local tournament = Cup.tournament(tournamentId) or Cup.TOURNAMENTS[1]
	if not cup.pendingNextRound and cup.nextTournamentAt > now then
		return cup
	end
	local round = 0
	if cup.pendingNextRound and cup.tournamentId == tournament.id and cup.round < tournament.rounds then
		round = cup.round
	else
		cup.opponentIds = (plannedOpponentIds and #plannedOpponentIds == tournament.rounds) and table.clone(plannedOpponentIds) or Cup.opponentSchedule(tournament, random)
		cup.nextTournamentAt = 0
		cup.strategyId = "konter"
	end
	cup.pendingNextRound = false
	cup.suspendedPlayerIds = {}
	cup.originalLineupIds = table.clone(lineupIds)
	cup.originalBenchIds = table.clone(benchIds)
	local opponent = Cup.opponentAt(tournament, round, cup.opponentIds)
	freshMatch(cup, now, tournamentDuration(tournament.minimumRating), homePlayers, positions)
	cup.careerMatchId = ("career-%d-tournament-%s"):format(now, opponent.name)
	cup.mode = "tournament"
	cup.tournamentId = tournament.id
	cup.round = round
	cup.opponent = opponent.name
	cup.opponentRating = opponent.rating
	cup.opponentStrategyId = opponent.strategyId
	cup.lastResult = ("Runde %d von %d gegen %s beginnt."):format(round + 1, tournament.rounds, opponent.name)
	return cup
end

function Cup.beginSeason(cupIn: any, opponent: any, division: number, matchday: number, now: number, homePlayers: { Cards.Player }, positions: { string }, lineupIds: { string }, benchIds: { string }): any
	local cup = Util.deepCopy(cupIn)
	freshMatch(cup, now, division >= 14 and 240000 or 210000, homePlayers, positions)
	cup.careerMatchId = ("career-%d-season-%s"):format(now, opponent.name)
	cup.mode = "season"
	cup.tournamentId = "stadium"
	cup.round = 0
	cup.opponent = opponent.name
	cup.opponentRating = opponent.rating
	cup.opponentStrategyId = opponent.strategyId
	cup.opponentIds = { opponent.id }
	cup.originalLineupIds = table.clone(lineupIds)
	cup.originalBenchIds = table.clone(benchIds)
	cup.suspendedPlayerIds = {}
	cup.pendingNextRound = false
	cup.nextTournamentAt = 0
	cup.lastResult = ("Spieltag %d von 10 gegen %s beginnt."):format(matchday + 1, opponent.name)
	return cup
end

local function decrementInjuries(injured: { [string]: number }): { [string]: number }
	local nextInjured = {}
	for id, matches in injured do
		local left = math.max(0, math.floor(tonumber(matches) or 0) - 1)
		if left > 0 then
			nextInjured[id] = left
		end
	end
	return nextInjured
end

local function baseResult(cup: any): any
	local tournament = Cup.tournament(cup.tournamentId) or Cup.TOURNAMENTS[1]
	return {
		finished = false, won = false, opponent = cup.opponent, tieBreak = false, tournamentWon = false, runEnded = false,
		completedRound = cup.round + 1, totalRounds = cup.mode == "season" and 1 or tournament.rounds,
	}
end

local function finishRound(cup: any, won: boolean, now: number, tieBreak: boolean): (any, any)
	local tournament = Cup.tournament(cup.tournamentId) or Cup.TOURNAMENTS[1]
	local result = baseResult(cup)
	result.finished = true
	result.won = won
	result.tieBreak = tieBreak
	if cup.simulation then
		cup.simulation.status = "completed"
	end
	cup.injuredPlayerIds = decrementInjuries(cup.injuredPlayerIds or {})
	cup.matchPaused = false
	cup.active = false
	if cup.mode == "season" then
		cup.phase = "regular"
		cup.pendingNextRound = false
		cup.nextTournamentAt = 0
		cup.round = 0
		cup.lastResult = ("%d:%d gegen %s beendet."):format(cup.homeScore, cup.awayScore, cup.opponent)
		result.runEnded = true
		result.completedRound = 1
		result.seasonMatch = true
		return cup, result
	end
	local completedRound = cup.round + 1
	local tournamentWon = won and completedRound >= tournament.rounds
	local decision = tieBreak and " im Elfmeterschiessen" or cup.phase == "extra-time" and " nach Verlängerung" or ""
	cup.wins += won and 1 or 0
	cup.best = math.max(cup.best, won and completedRound or cup.round)
	if won and not tournamentWon then
		cup.pendingNextRound = true
		cup.nextTournamentAt = 0
		cup.round = completedRound
		local names = {}
		for _, id in cup.suspendedPlayerIds do
			local player = Cards.get(id)
			if player then
				table.insert(names, player.name)
			end
		end
		result.replacementRequired = #cup.suspendedPlayerIds > 0
		cup.lastResult = result.replacementRequired
				and ("Runde %d%s gewonnen. %s muss vor der nächsten Partie ersetzt werden."):format(completedRound, decision, #names > 0 and table.concat(names, ", ") or "Ein Spieler")
			or ("Runde %d%s gewonnen. Passe deine Aufstellung an und starte Runde %d manuell."):format(completedRound, decision, completedRound + 1)
		result.completedRound = completedRound
		return cup, result
	end
	cup.pendingNextRound = false
	cup.nextTournamentAt = now + Cup.COOLDOWN_MS
	cup.round = 0
	if tournamentWon then
		cup.trophies[tournament.id] = (cup.trophies[tournament.id] or 0) + 1
	end
	cup.lastResult = tournamentWon and (tournament.trophyName .. decision .. " gewonnen! Der temporäre Goalboost ist aktiv.")
		or ("Turnieraus in Runde %d gegen %s%s."):format(completedRound, cup.opponent, decision)
	result.tournamentWon = tournamentWon
	result.runEnded = true
	result.completedRound = completedRound
	return cup, result
end

-- Advances a running match to "now". Returns the next cup and a result (finished = true at the end).
function Cup.advance(cupIn: any, now: number): (any, any)
	local result = baseResult(cupIn)
	if not cupIn.active or cupIn.matchPaused or cupIn.phase == "penalties" or not cupIn.simulation then
		return cupIn, result
	end
	local regular = MatchRatings.regularDurationMs(cupIn)
	local cup = Simulation.advance(cupIn, now, regular)
	-- Simulation.advance works in place; callers compare against copies they made themselves.
	local limit = cup.phase == "extra-time" and 7200 or 5400
	if cup.matchPaused or cup.simulation.time < limit then
		return cup, result
	end
	if cup.mode == "season" or cup.homeScore ~= cup.awayScore then
		return finishRound(cup, cup.homeScore > cup.awayScore, now, false)
	end
	if cup.phase == "regular" then
		cup.phase = "extra-time"
		cup.matchEndsAt += regular / 3
		cup.lastResult = "Verlängerung bis 120′."
		return cup, result
	end
	cup.simulation.status = "completed"
	cup.phase = "penalties"
	cup.penaltyTurn = "home"
	cup.penaltyMessage = "Nach 120′ steht es unentschieden. Du beginnst am Punkt."
	cup.lastResult = "Elfmeterschiessen. Wähle eine Richtung."
	return cup, result
end

function Cup.shiftTimeline(cup: any, duration: number): any
	if duration <= 0 then
		return cup
	end
	cup.matchStartedAt += duration
	cup.matchEndsAt += duration
	cup.lastTickAt += duration
	cup.careerRatingSeed = cup.careerRatingSeed or (cup.matchStartedAt - duration)
	if cup.lastGoal then
		cup.lastGoal.createdAt += duration
	end
	if cup.lastInjury then
		cup.lastInjury.createdAt += duration
	end
	for _, list in { cup.matchEvents, cup.cardEvents, cup.injuryEvents, cup.penaltyEvents } do
		for _, event in list do
			event.createdAt += duration
		end
	end
	if cup.broadcast then
		for _, event in cup.broadcast.events do
			event.at += duration
		end
	end
	return cup
end

-- Resumes after a pause (halftime, injury, edit) without catching up the paused time.
function Cup.resume(cupIn: any, now: number): any
	if not cupIn.active or not cupIn.matchPaused then
		return cupIn
	end
	local cup = Util.deepCopy(cupIn)
	Cup.shiftTimeline(cup, math.max(0, now - cup.lastTickAt))
	Simulation.resume(cup)
	cup.matchPaused = false
	cup.lastResult = "Die Partie läuft weiter. Die medizinische Abteilung beobachtet den Rest von der Seitenlinie."
	return cup
end

-- Request a pause at the next action boundary to change players or tactics.
function Cup.requestEdit(cupIn: any, now: number): any
	if not cupIn.active or cupIn.phase == "penalties" or cupIn.matchPaused or not cupIn.simulation then
		return cupIn
	end
	local cup = Cup.advance(cupIn, now)
	if cup.active and not cup.matchPaused and cup.simulation then
		cup.simulation.pauseRequested = true
	end
	return cup
end

local DIRECTIONS = { "left", "center", "right" }

local function directionLabel(direction: string): string
	return direction == "left" and "nach links" or direction == "right" and "nach rechts" or "in die Mitte"
end

local function penaltyTaker(homePlayers: { Cards.Player }, positions: { string }, attempt: number): Cards.Player?
	local ordered = {}
	for index, player in homePlayers do
		table.insert(ordered, { player = player, score = player.rating * 10 + (Cup.GOAL_WEIGHTS[positions[index] or player.position or "ZM"] or 1) })
	end
	table.sort(ordered, function(a, b)
		if a.score ~= b.score then
			return a.score > b.score
		end
		return a.player.name < b.player.name
	end)
	local entry = ordered[(attempt % math.max(1, #ordered)) + 1]
	return entry and entry.player
end

local function penaltyWinner(home: number, away: number, homeTaken: number, awayTaken: number): boolean?
	local homeLeft, awayLeft = math.max(0, 5 - homeTaken), math.max(0, 5 - awayTaken)
	if home > away + awayLeft then
		return true
	end
	if away > home + homeLeft then
		return false
	end
	if homeTaken >= 5 and awayTaken >= 5 and homeTaken == awayTaken and home ~= away then
		return home > away
	end
	return nil
end

-- One penalty: own shot (direction = where to shoot) or own keeper dive (direction = where to dive).
function Cup.penalty(cupIn: any, teamRating: number, direction: string, now: number, random: () -> number, homePlayers: { Cards.Player }, positions: { string }): (any, any)
	local result = baseResult(cupIn)
	if not cupIn.active or cupIn.phase ~= "penalties" or not table.find(DIRECTIONS, direction) then
		return cupIn, result
	end
	local cup = Util.deepCopy(cupIn)
	local event, message
	if cup.penaltyTurn == "home" then
		local player = penaltyTaker(homePlayers, positions, cup.penaltyHomeTaken)
		local keeperDirection = DIRECTIONS[math.floor(Util.bounded(random) * 3) + 1]
		local same = direction == keeperDirection
		local skill = clamp(((player and player.rating or teamRating) - 67) / 33, 0, 1)
		local chance = same and clamp(0.32 + skill * 0.25, 0.32, 0.6) or clamp(0.8 + skill * 0.16, 0.8, 0.96)
		local scored = random() < chance
		local outcome = scored and "goal" or (same and random() < 0.9) and "save" or "miss"
		cup.penaltyHomeTaken += 1
		if scored then
			cup.penaltyHomeScore += 1
		end
		local name = player and player.name or "Dein Schütze"
		message = scored and ("TOR! %s verwandelt %s."):format(name, directionLabel(direction))
			or outcome == "save" and name .. " scheitert. Der Keeper ist in der richtigen Ecke."
			or name .. " setzt den Ball neben das Tor."
		event = { id = ("%d-%d-%d-home"):format(now, cup.penaltyHomeTaken, cup.penaltyAwayTaken), side = "home", playerId = player and player.id, player = name, direction = direction, keeperDirection = keeperDirection, outcome = outcome }
	else
		local shot = DIRECTIONS[math.floor(Util.bounded(random) * 3) + 1]
		local keeperIndex = table.find(positions, "TW")
		local goalkeeper = (keeperIndex and homePlayers[keeperIndex]) or Util.find(homePlayers, function(player)
			return table.find(player.positions, "TW") ~= nil
		end)
		local roster = (cup.broadcast or Broadcast.create(cup)).opponentXI
		local shooters = {}
		for _, opponent in roster do
			if opponent.position == "ST" or opponent.position == "LF" or opponent.position == "RF" or opponent.position == "ZOM" or opponent.position == "MS" then
				table.insert(shooters, opponent.name)
			end
		end
		local name = #shooters > 0 and shooters[(cup.penaltyAwayTaken % #shooters) + 1] or cup.opponent
		local same = shot == direction
		local opponentSkill = clamp((cup.opponentRating - 55) / 44, 0, 1)
		local keeperSkill = clamp(((goalkeeper and goalkeeper.rating or teamRating) - 67) / 33, 0, 1)
		local chance = same and clamp(0.54 - keeperSkill * 0.28 + opponentSkill * 0.12, 0.16, 0.62) or clamp(0.79 + opponentSkill * 0.16 - keeperSkill * 0.05, 0.7, 0.96)
		local scored = random() < chance
		local outcome = scored and "goal" or (same and random() < 0.92) and "save" or "miss"
		cup.penaltyAwayTaken += 1
		if scored then
			cup.penaltyAwayScore += 1
		end
		message = scored and ("%s trifft %s. Dein Torwart war %s."):format(name, directionLabel(shot), directionLabel(direction))
			or outcome == "save" and (goalkeeper and goalkeeper.name or "Dein Torwart") .. " hält! Du hast die richtige Ecke gewählt."
			or name .. " verschiesst."
		event = { id = ("%d-%d-%d-away"):format(now, cup.penaltyHomeTaken, cup.penaltyAwayTaken), side = "away", player = name, direction = shot, keeperDirection = direction, outcome = outcome }
	end
	event.createdAt = now
	event.homeScore = cup.penaltyHomeScore
	event.awayScore = cup.penaltyAwayScore
	event.homeTaken = cup.penaltyHomeTaken
	event.awayTaken = cup.penaltyAwayTaken
	table.insert(cup.penaltyEvents, event)
	cup.penaltyTurn = cup.penaltyTurn == "home" and "away" or "home"
	cup.penaltyMessage = message
	local winner = penaltyWinner(cup.penaltyHomeScore, cup.penaltyAwayScore, cup.penaltyHomeTaken, cup.penaltyAwayTaken)
	if winner == nil then
		return cup, baseResult(cup)
	end
	cup.penaltyMessage = message .. (winner and " Das Elfmeterschiessen ist gewonnen." or " Das Elfmeterschiessen ist verloren.")
	return finishRound(cup, winner, now, true)
end

-- Validates a lineup and tactic draft while the match is paused.
function Cup.validateDraft(features: any, draft: any): string
	local cup = features.cup
	if not cup.active or cup.phase == "penalties" then
		return "Gerade sind keine Änderungen möglich."
	end
	if draft.formation ~= features.starXI.formationId then
		return "Die Formation bleibt während der Partie bestehen; passende Positionen können getauscht werden."
	end
	local formation = Cards.formation(draft.formation)
	if type(draft.lineup) ~= "table" or #draft.lineup ~= 11 or not Util.some(Cup.STRATEGIES, function(strategy)
		return strategy.id == draft.strategy
	end) then
		return "Aufstellung oder Taktik ungültig."
	end
	local ids = Util.filter(draft.lineup, function(id)
		return id ~= ""
	end)
	if #Util.unique(ids) ~= #ids then
		return "Ein Spieler ist mehrfach aufgestellt."
	end
	local changes = 0
	for index = 1, 11 do
		local id, old = draft.lineup[index], features.starXI.lineupIds[index]
		if table.find(cup.sentOffPlayerIds, old) then
			if id ~= old then
				return "Nach einer Roten Karte bleibt der Platz leer."
			end
		else
			local player = Cards.get(id)
			if not player or not table.find(features.starXI.ownedIds, id) then
				return "Ein Spieler ist nicht verfügbar."
			end
			if not Cards.canFillSlot(id, index, formation.positions) then
				return player.name .. " passt nicht auf " .. formation.positions[index] .. "."
			end
			if table.find(cup.sentOffPlayerIds, id) or table.find(cup.suspendedPlayerIds, id) or cup.playerExitedAt[id] or cup.injuredPlayerIds[id] then
				return "Ein Spieler ist nicht spielberechtigt."
			end
			if not table.find(features.starXI.lineupIds, id) then
				if not table.find(features.starXI.benchIds, id) then
					return "Neue Spieler müssen von der Bank kommen."
				end
				changes += 1
			end
		end
	end
	if cup.substitutionsUsed + changes > Cards.MAX_SUBSTITUTIONS then
		return "Zu viele Wechsel geplant."
	end
	return ""
end

-- Applies a validated draft at the safe boundary and resumes the match.
function Cup.confirmDraft(features: any, draft: any, now: number): string
	local problem = Cup.validateDraft(features, draft)
	if problem ~= "" then
		return problem
	end
	local cup = features.cup
	if not cup.matchPaused then
		return "Der laufende Spielzug wird noch abgeschlossen."
	end
	local minute = math.max(1, math.min(120, math.ceil((cup.simulation and cup.simulation.time or 0) / 60)))
	local oldLineup = features.starXI.lineupIds
	local incoming = Util.filter(draft.lineup, function(id)
		return id ~= "" and not table.find(oldLineup, id)
	end)
	local outgoing = Util.filter(oldLineup, function(id)
		return id ~= "" and not table.find(draft.lineup, id) and not table.find(cup.sentOffPlayerIds, id)
	end)
	local formation = Cards.formation(draft.formation)
	local regular = MatchRatings.regularDurationMs(cup)
	for index, id in incoming do
		local out = outgoing[index]
		cup.broadcast = Broadcast.addSubstitution(cup, out, id, minute, regular)
		cup.playerExitedAt[out] = minute
		cup.playerEnteredAt[id] = minute
		cup.allTimeAppearances[id] = (cup.allTimeAppearances[id] or 0) + 1
	end
	features.starXI.lineupIds = table.clone(draft.lineup)
	for index, id in features.starXI.benchIds do
		local position = table.find(incoming, id)
		if position then
			features.starXI.benchIds[index] = outgoing[position]
		end
	end
	cup.substitutionsUsed += #incoming
	cup.strategyId = draft.strategy
	cup.lastInjury = nil
	for index, id in draft.lineup do
		cup.playerMatchPositions[id] = formation.positions[index]
		if cup.broadcast then
			cup.broadcast.slots[id] = index
		end
	end
	local sim = cup.simulation
	if sim then
		local checkpoint = sim.committed
		for index, out in outgoing do
			local old = Util.find(checkpoint.players, function(p)
				return p.id == out
			end)
			local source = Cards.get(incoming[index])
			if old and source then
				checkpoint.players = Util.filter(checkpoint.players, function(p)
					return p.id ~= out
				end)
				local replacement = table.clone(old)
				replacement.id = source.id
				replacement.name = source.name
				replacement.rating = source.rating
				replacement.passing = Cards.attribute(source, "shortPassing", source.rating)
				replacement.shooting = Cards.attribute(source, "finishing", source.rating)
				replacement.pace = Cards.attribute(source, "sprintSpeed", source.rating)
				replacement.control = Cards.attribute(source, "dribbling", source.rating)
				replacement.defending = Cards.attribute(source, "standingTackle", source.rating)
				replacement.keeping = Cards.attribute(source, "gkReflexes", source.rating)
				replacement.stamina = Cards.attribute(source, "stamina", source.rating)
				replacement.fitness = 100
				replacement.active = true
				if checkpoint.owner == out then
					checkpoint.owner = source.id
				end
				table.insert(checkpoint.players, replacement)
			end
		end
		for index, id in draft.lineup do
			local p = Util.find(checkpoint.players, function(candidate)
				return candidate.id == id
			end)
			if p then
				local slot = formation.slots[index]
				local right = checkpoint.direction > 0
				local x = p.role == "TW" and 3 or 12 + (100 - slot.y) * 0.68
				local y = p.role == "TW" and 34 or 5 + slot.x * 0.58
				p.role = slot.position
				p.slot = index
				p.anchor = { x = right and x or 105 - x, y = right and y or 68 - y }
			end
		end
		if checkpoint.lastPass and table.find(outgoing, checkpoint.lastPass.id) then
			checkpoint.lastPass = nil
		end
		sim.clubFormation = formation.id
		Simulation.invalidate(cup)
	end
	features.cup = Cup.resume(cup, now)
	return ""
end

function Cup.homePlayers(features: any): { Cards.Player }
	return StarXI.selection(features.starXI.ownedIds, features.starXI.lineupIds)
end

return Cup
