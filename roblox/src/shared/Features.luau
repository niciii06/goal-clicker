--!strict
-- Club features beyond clicking: squad availability, transfer rumours (Fabrizio Romario),
-- loans, deadline day, Goal Gazette, random events, VAR and tournament rewards.
local Cards = require(script.Parent.Cards)
local Career = require(script.Parent.Career)
local Cup = require(script.Parent.Cup)
local Economy = require(script.Parent.Economy)
local Failures = require(script.Parent.Data.TransferFailures) :: { string }
local History = require(script.Parent.History)
local Packs = require(script.Parent.Packs)
local Press = require(script.Parent.Press)
local Season = require(script.Parent.Season)
local StarXI = require(script.Parent.StarXI)
local Texts = require(script.Parent.Data.Texts) :: any
local Travel = require(script.Parent.Travel)
local Util = require(script.Parent.Util)
local Catalog = require(script.Parent.Data.Catalog) :: any

local Features = {}

Features.CLUB_BADGES = { "⚽", "🦅", "🔥", "🦁", "⭐", "🛡️" }
Features.CLUB_COLORS = { "#0071e3", "#1d1d1f", "#e85d04", "#16845b", "#8b5cf6", "#d12c54" }
Features.TRANSFER_EVENT_MIN_DELAY_MS = 480000
Features.TRANSFER_EVENT_MAX_DELAY_MS = 720000
Features.TRANSFER_LOAN_CHANCE = 0.30
Features.TRANSFER_SALE_CHANCE = 0.10
Features.TRANSFER_PAID_SALE_CHANCE = 0.60
Features.TRANSFER_DEADLINE_LOAN_CHANCE = 0.60

local clamp = Util.clamp

function Features.randomEventDelay(roll: number): number
	return 60000 + math.floor(math.max(0, math.min(0.999999, roll)) * 120000)
end

function Features.transferEventDelay(roll: number): number
	return Features.TRANSFER_EVENT_MIN_DELAY_MS + math.floor(math.max(0, math.min(0.999999, roll)) * (Features.TRANSFER_EVENT_MAX_DELAY_MS - Features.TRANSFER_EVENT_MIN_DELAY_MS))
end

function Features.deadlineEventDelay(roll: number): number
	return 45000 + math.floor(math.max(0, math.min(0.999999, roll)) * 30000)
end

function Features.initial(now: number, random: () -> number): any
	local club = { name = "FC Arbeitszeitbetrug", badge = "⚽", color = "#0071e3" }
	local missions = Util.map(Catalog.missions, function(mission: any)
		local copy = table.clone(mission)
		copy.claimed = false
		return copy
	end)
	return {
		schemaVersion = 5,
		earnedPacks = {},
		completedTournamentRuns = {},
		travel = Travel.empty(),
		career = Career.initial(),
		transferMarket = { offerIds = { "turbo", "wall", "maestro" }, ownedIds = {} },
		starXI = StarXI.initial(),
		club = club,
		cup = Cup.initial(),
		seasonMode = Season.initial(club.name),
		goalBoost = { tournamentId = nil, multiplier = 1, startedAt = 0, endsAt = 0 },
		missions = missions,
		history = {},
		randomEvent = nil,
		starPackReveal = nil,
		transferSaga = { loans = {}, vacancies = {}, archive = {}, latestEvent = nil, lastFailedReason = "", nextAt = now + Features.transferEventDelay(random()), deadlineDayStartedAt = 0, deadlineDayEndsAt = 0 },
		gazetteIssues = {},
		dailyRewards = {},
		press = Press.initial(),
		nextEventAt = now + Features.randomEventDelay(random()),
		nextVarAt = now + Features.randomEventDelay(random()),
	}
end

function Features.loanedIds(features: any): { string }
	return Util.map(features.transferSaga.loans, function(loan)
		return loan.playerId
	end)
end

-- Suspended, injured, loaned and (during travel) players outside the travelling squad.
function Features.unavailableIds(features: any): { string }
	local ids = table.clone(features.cup.suspendedPlayerIds)
	for id, matches in features.cup.injuredPlayerIds or {} do
		if (tonumber(matches) or 0) > 0 then
			table.insert(ids, id)
		end
	end
	for _, id in Features.loanedIds(features) do
		table.insert(ids, id)
	end
	if features.squadLock then
		for _, id in features.starXI.ownedIds do
			if not table.find(features.squadLock.playerIds, id) then
				table.insert(ids, id)
			end
		end
	end
	return Util.unique(ids)
end

function Features.eventPlayers(features: any, position: string?): { Cards.Player }
	local unavailable = {}
	for _, id in Util.concat(Features.unavailableIds(features), features.cup.sentOffPlayerIds) do
		unavailable[id] = true
	end
	local result = {}
	for _, id in Util.unique(Util.concat(features.starXI.lineupIds, features.starXI.benchIds)) do
		local player = Cards.get(id)
		if player and table.find(features.starXI.ownedIds, id) and not unavailable[id] and (not position or table.find(player.positions, position)) then
			table.insert(result, player)
		end
	end
	return result
end

function Features.openVacancies(features: any): { any }
	local size = StarXI.filledCount(features.starXI.lineupIds) + StarXI.filledCount(features.starXI.benchIds)
	return Util.filter(features.transferSaga.vacancies, function(vacancy)
		return size < vacancy.requiredPlayers
	end)
end

function Features.lockSquad(features: any, fixtureId: string, now: number)
	if features.squadLock then
		return
	end
	local ids = Util.unique(Util.filter(Util.concat(features.starXI.lineupIds, features.starXI.benchIds), function(id)
		return id ~= ""
	end))
	features.squadLock = {
		fixtureId = fixtureId, playerIds = ids, startedAt = now,
		transferRemaining = math.max(0, features.transferSaga.nextAt - now),
		eventRemaining = math.max(0, features.nextEventAt - now),
		varRemaining = math.max(0, features.nextVarAt - now),
	}
	features.starXI.lockedPlayerIds = table.clone(ids)
end

function Features.releaseSquad(features: any, now: number)
	local lock = features.squadLock
	if not lock then
		return
	end
	features.transferSaga.nextAt = now + lock.transferRemaining
	features.nextEventAt = now + lock.eventRemaining
	features.nextVarAt = now + lock.varRemaining
	features.squadLock = nil
	features.starXI.lockedPlayerIds = nil
	if features.travel.journey then
		features.travel.journey.squadLock = nil
	end
end

function Features.activatePendingLoans(features: any, tournamentId: string)
	for _, loan in features.transferSaga.loans do
		if loan.status == "pending" then
			loan.status = "active"
			loan.tournamentId = tournamentId
		end
	end
end

local function appendArchive(features: any, event: any)
	if event.outcome == "failed" then
		return
	end
	local archive = Util.filter(features.transferSaga.archive, function(item)
		return item.id ~= event.id
	end)
	table.insert(archive, event)
	features.transferSaga.archive = Util.tail(archive, 30)
end

function Features.finishActiveLoans(features: any, now: number): any?
	local returned = Util.filter(features.transferSaga.loans, function(loan)
		return loan.status == "active"
	end)
	if #returned == 0 then
		return nil
	end
	local competition = features.cup.mode == "season" and "der Saisonpartie" or "dem Turnier"
	features.transferSaga.loans = Util.filter(features.transferSaga.loans, function(loan)
		return loan.status ~= "active"
	end)
	features.starXI = StarXI.normalize(features.starXI, Util.concat(Features.loanedIds(features), features.cup.suspendedPlayerIds))
	local names = {}
	for _, loan in returned do
		local player = Cards.get(loan.playerId)
		if player then
			table.insert(names, player.name)
		end
	end
	local joined = #names > 0 and table.concat(names, ", ") or "Deine Leihspieler"
	local event = {
		id = "transfer-return-" .. now, outcome = "return", playerId = #returned == 1 and returned[1].playerId or nil,
		playerName = joined, club = #returned == 1 and returned[1].club or "Leihstationen", headline = "Leihspieler zurück",
		message = ("%s %s nach %s wieder für deinen Club verfügbar."):format(joined, #names == 1 and "ist" or "sind", competition),
		reason = "Leihe beendet", fee = 0, createdAt = now,
	}
	features.transferSaga.latestEvent = event
	appendArchive(features, event)
	History.add(features, "Fabrizio Romario · Rückkehr", event.message, "positive", now)
	return event
end

function Features.isDeadlineDay(features: any, now: number): boolean
	local saga = features.transferSaga
	return saga.deadlineDayStartedAt > 0 and saga.deadlineDayStartedAt <= now and saga.deadlineDayEndsAt > now
end

function Features.startDeadlineDay(features: any, now: number, random: () -> number)
	local endsAt = features.cup.nextTournamentAt > now and features.cup.nextTournamentAt or now + Cup.COOLDOWN_MS
	features.transferSaga.deadlineDayStartedAt = now
	features.transferSaga.deadlineDayEndsAt = endsAt
	features.transferSaga.nextAt = math.min(endsAt - 1, now + 5000 + math.floor(Util.bounded(random) * 10000))
end

local function pickIndex(length: number, random: () -> number): number
	if length <= 1 then
		return 1
	end
	return math.floor(Util.bounded(random) * length) + 1
end

function Features.publishGazette(features: any, summary: any, now: number, random: () -> number): any
	local tournament = Cup.tournament(summary.tournamentId) or Cup.TOURNAMENTS[1]
	local pool = summary.tournamentWon and Texts.gazetteChampion or Texts.gazetteExit
	local previous = features.gazetteIssues[#features.gazetteIssues]
	local available = Util.filter(pool, function(headline)
		return not previous or headline ~= previous.headline
	end)
	local headline = available[pickIndex(#available, random)] or pool[1]
	local score = ("%d:%d"):format(summary.homeScore, summary.awayScore)
	local tieBreak = summary.tieBreak and " nach Elfmeterschiessen" or ""
	local issue = {
		id = ("gazette-%d-%s"):format(now, summary.tournamentId),
		headline = headline,
		strapline = summary.tournamentWon and ("%s gewinnt %s%s."):format(features.club.name, tournament.trophyName, tieBreak) or ("%s scheidet in Runde %d%s aus."):format(features.club.name, summary.completedRound, tieBreak),
		body = summary.tournamentWon and ("%s gegen %s. Die Trophäe ist da, die Fans feiern und der Platzwart hat das Konfetti offiziell aufgegeben."):format(score, summary.opponent)
			or ("%s gegen %s. Der Traum endet diesmal früh, doch im Club Office läuft die Analyse bereits auf höchster Lautstärke."):format(score, summary.opponent),
		tone = summary.tournamentWon and "champion" or "exit",
		tournamentId = summary.tournamentId, opponent = summary.opponent, homeScore = summary.homeScore, awayScore = summary.awayScore,
		completedRound = summary.completedRound, tieBreak = summary.tieBreak, createdAt = now,
	}
	table.insert(features.gazetteIssues, issue)
	features.gazetteIssues = Util.tail(features.gazetteIssues, 12)
	History.add(features, "Goal Gazette · " .. headline, issue.strapline, summary.tournamentWon and "positive" or "negative", now)
	return issue
end

-- End of a tournament run: reward pack, deadline day and the Goal Gazette.
function Features.completeTournamentRun(features: any, summary: any, now: number, random: () -> number)
	Features.finishActiveLoans(features, now)
	local runId = ("%s:%d"):format(summary.tournamentId, features.cup.matchStartedAt)
	if table.find(features.completedTournamentRuns, runId) then
		return
	end
	table.insert(features.completedTournamentRuns, runId)
	features.completedTournamentRuns = Util.tail(features.completedTournamentRuns, 60)
	if summary.tournamentWon then
		local pack = Packs.tournamentRewardPack(summary.tournamentId)
		table.insert(features.earnedPacks, { id = runId, packId = pack.id, earnedAt = now })
		History.add(features, pack.label .. " gewonnen", "Deine Prämie wartet im Packbereich.", "positive", now)
		features.goalBoost = { tournamentId = summary.tournamentId, multiplier = Economy.GOAL_BOOST_MULTIPLIERS[summary.tournamentId] or 1, startedAt = now, endsAt = now + Economy.GOAL_BOOST_DURATION_MS }
	end
	Features.startDeadlineDay(features, now, random)
	Features.publishGazette(features, summary, now, random)
end

-- Fabrizio Romario: loan, sale or a collapsed deal. Returns the event and goals received.
function Features.resolveTransferEvent(features: any, random: () -> number, now: number): (any?, number)
	if features.squadLock then
		return nil, 0
	end
	local deadline = Features.isDeadlineDay(features, now)
	local loanChance = deadline and Features.TRANSFER_DEADLINE_LOAN_CHANCE or Features.TRANSFER_LOAN_CHANCE
	local roll = Util.bounded(random)
	local requested = roll < loanChance and "loan" or roll < loanChance + Features.TRANSFER_SALE_CHANCE and "sale" or "failed"
	local clubs = Texts.transferClubs
	local club = clubs[pickIndex(#clubs, random)]
	local loaned = {}
	for _, id in Features.loanedIds(features) do
		loaned[id] = true
	end
	local candidates = Util.filter(Util.unique(Util.concat(features.starXI.lineupIds, features.starXI.benchIds)), function(id)
		return id ~= "" and table.find(features.starXI.ownedIds, id) ~= nil and not loaned[id] and Cards.get(id) ~= nil
	end)
	local candidateId = candidates[pickIndex(#candidates, random)]
	local player = candidateId and Cards.get(candidateId)
	local outcome = (requested ~= "failed" and player and not features.cup.active) and requested or "failed"
	local event
	local goalDelta = 0
	local function addVacancy()
		local lineupIndex = table.find(features.starXI.lineupIds, player.id)
		local benchIndex = table.find(features.starXI.benchIds, player.id)
		local required = StarXI.filledCount(features.starXI.lineupIds) + StarXI.filledCount(features.starXI.benchIds)
		local vacancy = lineupIndex and { area = "lineup", index = lineupIndex, requiredPlayers = required, createdAt = now } or { area = "bench", index = benchIndex or 1, requiredPlayers = required, createdAt = now }
		local open = Features.openVacancies(features)
		table.insert(open, vacancy)
		features.transferSaga.vacancies = Util.tail(open, 20)
	end
	if outcome == "loan" and player then
		addVacancy()
		local season = features.cup.mode == "season"
		local current = season and "der laufenden Saisonpartie" or "des laufenden Turniers"
		local nextOne = season and "der nächsten kompletten Saisonpartie" or "dem nächsten kompletten Turnier"
		local article = season and "eine Saisonpartie" or "ein Turnier"
		local joins = features.cup.pendingNextRound
		table.insert(features.transferSaga.loans, { playerId = player.id, club = club, status = joins and "active" or "pending", tournamentId = joins and features.cup.tournamentId or nil, createdAt = now })
		features.starXI = StarXI.normalize(features.starXI, Features.unavailableIds(features))
		event = {
			id = ("transfer-loan-%d-%s"):format(now, player.id), outcome = "loan", playerId = player.id, playerName = player.name, club = club,
			headline = "Leihe bestätigt",
			message = joins and ("Fabrizio Romario meldet: %s wechselt auf Leihbasis zu %s, fehlt für den Rest %s und kehrt danach zurück."):format(player.name, club, current)
				or ("Fabrizio Romario meldet: %s wechselt auf Leihbasis zu %s und fehlt deinem Club in %s. Danach kehrt er zurück."):format(player.name, club, nextOne),
			reason = joins and ("Leihe für den Rest " .. current) or ("Leihe für " .. article), fee = 0, createdAt = now,
		}
	elseif outcome == "sale" and player then
		addVacancy()
		local paid = Util.bounded(random) < Features.TRANSFER_PAID_SALE_CHANCE
		local fee = paid and math.max(0, math.floor(player.price)) or 0
		goalDelta = fee
		local state = features.starXI
		state.ownedIds = Util.filter(state.ownedIds, function(id)
			return id ~= player.id
		end)
		for index, id in state.lineupIds do
			if id == player.id then
				state.lineupIds[index] = ""
			end
		end
		for index, id in state.benchIds do
			if id == player.id then
				state.benchIds[index] = ""
			end
		end
		features.starXI = StarXI.normalize(state, Features.unavailableIds(features))
		event = {
			id = ("transfer-sale-%d-%s"):format(now, player.id), outcome = "sale", playerId = player.id, playerName = player.name, club = club,
			headline = paid and "HERE WE GOAL" or "Ablösefreier Abgang",
			message = paid and ("Fabrizio Romario meldet: %s wechselt dauerhaft zu %s. Dein Club erhält %s Goals Ablöse."):format(player.name, club, Util.formatInteger(fee))
				or ("Fabrizio Romario meldet: %s wechselt dauerhaft und ablösefrei zu %s. Dein Club erhält keine Goals."):format(player.name, club),
			reason = paid and "Verkauf mit Ablöse" or "Ablösefreier Wechsel", fee = fee, createdAt = now,
		}
	else
		local available = Util.filter(Failures, function(reason)
			return reason ~= features.transferSaga.lastFailedReason
		end)
		local reason = available[pickIndex(#available, random)] or Failures[1]
		event = {
			id = ("transfer-failed-%d-%s"):format(now, player and player.id or "none"), outcome = "failed", playerId = player and player.id, playerName = player and player.name,
			club = club, headline = "Deal geplatzt",
			message = ("Fabrizio Romario meldet: Der mögliche Wechsel von %s zu %s ist geplatzt, weil %s."):format(player and player.name or "einem angefragten Spieler", club, reason),
			reason = reason, fee = 0, createdAt = now,
		}
		features.transferSaga.lastFailedReason = reason
	end
	features.transferSaga.latestEvent = event
	appendArchive(features, event)
	local candidate = now + (deadline and Features.deadlineEventDelay(random()) or Features.transferEventDelay(random()))
	if deadline and candidate >= features.transferSaga.deadlineDayEndsAt then
		features.transferSaga.nextAt = features.transferSaga.deadlineDayEndsAt + Features.transferEventDelay(random())
	else
		features.transferSaga.nextAt = candidate
	end
	History.add(features, "Fabrizio Romario · " .. event.headline, event.message, event.outcome == "sale" and "negative" or "neutral", now)
	return event, goalDelta
end

-- Random club event; 1 % chance for Johhny Elefantino who takes everything.
function Features.randomEvent(goals: number, roll: number, now: number): any
	local safe = math.max(0, goals)
	local eventRoll = math.max(0, math.min(0.999999, roll))
	if eventRoll < 0.01 then
		local amount = math.ceil(safe)
		return {
			id = "elefantino", title = "Johhny Elefantino", amount = -amount, tone = amount > 0 and "negative" or "neutral", createdAt = now,
			message = amount > 0 and ("Johhny Elefantino erklärt dein gesamtes Guthaben von %s Toren zur offiziellen Fussballabgabe. Dein Konto steht auf 0."):format(Util.formatInteger(amount))
				or "Johhny Elefantino wollte dir alles wegnehmen, aber dein Konto war bereits leer.",
		}
	end
	local regular = (eventRoll - 0.01) / 0.99
	if regular < 0.48 then
		local amount = math.max(80, math.floor(safe * 0.025))
		return { id = "sponsor", title = "Sponsor im Stadion", message = ("Ein Sponsor überrascht den Club mit %s Toren."):format(Util.formatInteger(amount)), amount = amount, tone = "positive", createdAt = now }
	end
	if regular < 0.78 then
		local amount = math.max(40, math.floor(safe * 0.018))
		return { id = "fans", title = "Fans drehen auf", message = ("Die Kurve pusht das Team mit %s Extra Toren."):format(Util.formatInteger(amount)), amount = amount, tone = "positive", createdAt = now }
	end
	if regular < 0.9 then
		local amount = math.min(safe, math.max(20, math.floor(safe * 0.012)))
		return { id = "weather", title = "Platzregen", amount = -amount, tone = amount > 0 and "negative" or "neutral", createdAt = now,
			message = amount > 0 and ("Der Rasen ist unbespielbar. %s Tore gehen verloren."):format(Util.formatInteger(amount)) or "Der Regen kommt, aber der Club hat noch keine Tore zu verlieren." }
	end
	local amount = math.min(safe, math.max(30, math.floor(safe * 0.016)))
	return { id = "injury", title = "Verletzungspech", amount = -amount, tone = amount > 0 and "negative" or "neutral", createdAt = now,
		message = amount > 0 and ("Die medizinische Abteilung kostet den Club %s Tore."):format(Util.formatInteger(amount)) or "Die medizinische Abteilung meldet Entwarnung." }
end

function Features.varEvent(goals: number, roll: number, now: number): any
	local safe = math.max(0, goals)
	local varRoll = math.max(0, math.min(0.999999, roll))
	local positive = varRoll < 0.2
	local magnitude = positive and varRoll / 0.2 or (varRoll - 0.2) / 0.8
	local share = positive and 0.5 + magnitude * 2 or 0.1 + magnitude * 0.6
	local amount = positive and math.floor(safe * share) or math.min(safe, math.floor(safe * share))
	local percent = safe > 0 and Util.round(amount / safe * 100) or 0
	if positive then
		return { id = "var", title = "VAR gibt Tor frei", amount = amount, tone = amount > 0 and "positive" or "neutral", createdAt = now,
			message = amount > 0 and ("Nach langer Prüfung werden %s Tore, also %d%% deines aktuellen Guthabens, nachträglich anerkannt."):format(Util.formatInteger(amount), percent) or "Der VAR erkennt noch kein zusätzliches Tor an." }
	end
	return { id = "var", title = "VAR greift ein", amount = -amount, tone = amount > 0 and "negative" or "neutral", createdAt = now,
		message = amount > 0 and ("Abseits! Der VAR aberkennt %s Tore, also %d%% deines aktuellen Guthabens."):format(Util.formatInteger(amount), percent) or "Der VAR prüft lange, findet aber noch kein Tor zum Aberkennen." }
end

function Features.missionProgress(mission: any, game: any): number
	if mission.kind == "goals" then
		return math.floor(game.seasonGoals)
	elseif mission.kind == "clicks" then
		return math.floor(game.clicks)
	elseif mission.kind == "minigames" then
		return math.floor(game.minigameWins)
	end
	return math.floor(game.features.cup.wins)
end

-- Opens an earned reward pack; the result is already applied to the squad.
function Features.openEarnedPack(features: any, id: string, now: number, random: () -> number): any?
	local earned = Util.find(features.earnedPacks, function(pack)
		return pack.id == id
	end)
	if not earned or earned.opening or features.cup.active then
		return nil
	end
	local opening = Packs.open(earned.packId, features.starXI.ownedIds, random)
	local player = opening.player
	local duplicate = table.find(features.starXI.ownedIds, player.id) ~= nil
	local compensation = duplicate and Cards.fragmentCompensation(player) or 0
	earned.opening = { packId = opening.packId, packName = opening.packName, playerId = player.id, duplicate = duplicate, fragmentCompensation = compensation }
	if duplicate then
		features.starXI.fragments += compensation
	else
		features.starXI = StarXI.add(features.starXI, player.id)
	end
	local reveal = { packId = opening.packId, packName = opening.packName, playerId = player.id, duplicate = duplicate, fragmentCompensation = compensation, openedAt = now, openedBy = "Du", troll = Packs.shouldTroll(player, random) }
	features.starPackReveal = reveal
	History.add(features, opening.packName .. ": " .. player.name, duplicate and ("+%d Fragmente"):format(compensation) or ("%s · Rating %d"):format(table.concat(player.positions, " / "), player.rating), "positive", now)
	return reveal
end

return Features
