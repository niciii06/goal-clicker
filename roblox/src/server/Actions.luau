--!strict
-- Every player action and the per second club tick. Runs on the server only; the client
-- just sends intentions. A session is one club (a player's own club or a coop world).
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared

local Cards = require(Shared.Cards)
local Career = require(Shared.Career)
local Cup = require(Shared.Cup)
local Daily = require(Shared.Daily)
local Economy = require(Shared.Economy)
local Features = require(Shared.Features)
local GameState = require(Shared.GameState)
local History = require(Shared.History)
local MatchRatings = require(Shared.MatchRatings)
local MiniGames = require(Shared.MiniGames)
local Packs = require(Shared.Packs)
local Press = require(Shared.Press)
local Season = require(Shared.Season)
local StarXI = require(Shared.StarXI)
local Travel = require(Shared.Travel)
local Util = require(Shared.Util)
local Progression = require(Shared.Data.Progression) :: any

local Actions = {}

export type Session = {
	game: any,
	testMode: boolean,
	notices: { any },
	clickTimes: { number },
	combo: { count: number, last: number },
	streak: { count: number, last: number },
	miniGame: any?,
	memberName: (string?) -> string,
}

local MAX_CAREER_SEASON = #Progression.seasonMilestones

function Actions.newSession(game: any): Session
	return {
		game = game,
		testMode = false,
		notices = {},
		clickTimes = {},
		combo = { count = 0, last = 0 },
		streak = { count = 0, last = 0 },
		miniGame = nil,
		memberName = function(name)
			return name or "Du"
		end,
	}
end

local function notify(session: Session, kind: string, data: any?)
	local notice = data and table.clone(data) or {}
	notice.kind = kind
	table.insert(session.notices, notice)
end

local function toast(session: Session, text: string)
	notify(session, "toast", { text = text })
end

function Actions.currentSeason(seasons: number): number
	return math.min(MAX_CAREER_SEASON, math.max(1, math.floor(seasons) + 1))
end

local function unlocked(session: Session, unlockSeason: number): boolean
	return session.testMode or Actions.currentSeason(session.game.seasons) >= unlockSeason
end

local function features(session: Session): any
	return session.game.features
end

function Actions.clickPower(game: any, now: number): number
	return Economy.clickPower(game.upgrades, game.stars, game.features, now)
end

function Actions.passivePower(game: any, now: number): number
	return Economy.passivePower(game.upgrades, game.stars, game.features, now)
end

local function ratingOf(session: Session): (Cards.Player) -> number
	local f = features(session)
	return function(player)
		return Career.selectionRating(player, f.career, f.cup, 1)
	end
end

------------------------------------------------------------------------------------------
-- Clicking

-- One click; the server keeps the combo, the streak and a hard rate limit.
function Actions.click(session: Session, now: number, random: () -> number): (number?, boolean?, number?)
	local times = session.clickTimes
	table.insert(times, now)
	while #times > 0 and times[1] < now - 1000 do
		table.remove(times, 1)
	end
	if #times > 20 then
		return nil
	end
	local combo = session.combo
	combo.count = (now - combo.last <= Economy.COMBO_WINDOW_MS) and combo.count + 1 or 1
	combo.last = now
	local level = Economy.comboLevel(combo.count)
	local power = Actions.clickPower(session.game, now) * level.multiplier
	local amount, streak, critical = Economy.clickResult(power, now, session.streak.last, session.streak.count, random)
	session.streak.count = streak
	session.streak.last = now
	GameState.addGoals(session.game, amount)
	session.game.clicks += 1
	return amount, critical, level.multiplier
end

------------------------------------------------------------------------------------------
-- Upgrades

function Actions.buyUpgrade(session: Session, payload: any): (boolean, string)
	local game = session.game
	local upgrade = Economy.upgrade(tostring(payload.id))
	if not upgrade then
		return false, "Dieses Upgrade gibt es nicht."
	end
	local unlockSeason = Economy.UNLOCK_SEASONS[upgrade.id] or 1
	if Economy.level(game.upgrades, upgrade.id) == 0 and not unlocked(session, unlockSeason) then
		return false, ("%s wird in Saison %d freigeschaltet."):format(upgrade.name, unlockSeason)
	end
	local mode = payload.mode == "max" and "max" or math.clamp(math.floor(tonumber(payload.mode) or 1), 1, 1000)
	local count, total = Economy.bulkPurchase(upgrade, game.upgrades, game.goals, mode, session.testMode)
	if count == 0 then
		local nextCost = Economy.cost(upgrade, game.upgrades)
		return false, nextCost == math.huge and "Dieses Upgrade ist auf dem Maximum." or ("%s kostet %s Tore."):format(upgrade.name, Util.formatNumber(nextCost))
	end
	game.goals -= total
	local level = Economy.level(game.upgrades, upgrade.id) + count
	game.upgrades[upgrade.id] = level
	notify(session, "feed", { icon = upgrade.icon, text = ("%s x%d für %s Tore."):format(upgrade.name, count, Util.formatNumber(total)) })
	notify(session, "sound", { name = "buy" })
	return true, count == 1 and ("%s auf Level %d"):format(upgrade.name, level) or ("%s: %d Level gekauft"):format(upgrade.name, count)
end

------------------------------------------------------------------------------------------
-- Packs

local function revealFor(opening: any, now: number, random: () -> number, by: string): any
	return {
		packId = opening.packId, packName = opening.packName, playerId = opening.player.id, duplicate = opening.duplicate,
		fragmentCompensation = opening.fragmentCompensation, source = opening.source, openedAt = now, openedBy = by,
		troll = Packs.shouldTroll(opening.player, random),
	}
end

function Actions.buyPack(session: Session, payload: any, now: number, random: () -> number, by: string?): (boolean, string)
	local game, f = session.game, features(session)
	local pack = Packs.get(tostring(payload.id))
	if not pack or Packs.isReward(pack.id) then
		return false, "Dieses Pack gibt es nicht."
	end
	if not unlocked(session, pack.unlockSeason or 1) then
		return false, ("%s wird in Saison %d freigeschaltet."):format(pack.label, pack.unlockSeason)
	end
	if f.cup.active then
		return false, "Während eines Pokalspiels keine Packs."
	end
	if not session.testMode and game.goals < pack.price then
		return false, ("%s kostet %s Tore."):format(pack.label, Util.formatNumber(pack.price))
	end
	local opening = Packs.open(pack.id, f.starXI.ownedIds, random)
	if not session.testMode then
		game.goals -= pack.price
	end
	local reveal = revealFor(opening, now, random, by or "Du")
	f.starPackReveal = reveal
	if opening.duplicate then
		f.starXI.fragments += opening.fragmentCompensation
		History.add(f, "Doppelter Star: " .. opening.player.name, ("+%s Fragmente · nur für Custom-Karten."):format(Util.formatNumber(opening.fragmentCompensation)), "neutral", now)
	else
		f.starXI = StarXI.add(f.starXI, opening.player.id)
		History.add(f, opening.player.name .. " in die Star XI gezogen", ("%s · Rating %d"):format(Cards.positionLabel(opening.player), opening.player.rating), "positive", now)
	end
	notify(session, "reveal", { reveal = reveal })
	return true, opening.duplicate and ("Doppelter Star · +%s Fragmente"):format(Util.formatNumber(opening.fragmentCompensation)) or opening.player.name .. " gezogen"
end

function Actions.drawCustom(session: Session, now: number, random: () -> number, by: string?): (boolean, string)
	local f = features(session)
	local cost = Cards.RANDOM_CUSTOM_CARD_COST
	if f.cup.active then
		return false, "Während eines Pokalspiels keine Karten."
	end
	if session.testMode then
		f.starXI.fragments = math.max(f.starXI.fragments, cost)
	end
	local opening = Packs.drawCustom(f.starXI.fragments, f.starXI.ownedIds, random)
	if not opening then
		return false, ("Ein Spezialkarten-Zug kostet %s Fragmente."):format(Util.formatNumber(cost))
	end
	f.starXI.fragments -= cost
	if opening.duplicate then
		f.starXI.fragments += opening.fragmentCompensation
		History.add(f, "Doppelter Spezialspieler: " .. opening.player.name, ("+%s Fragmente zurück."):format(Util.formatNumber(opening.fragmentCompensation)), "neutral", now)
	else
		f.starXI = StarXI.add(f.starXI, opening.player.id)
		History.add(f, opening.player.name .. " als Spezialkarte gezogen", ("%s · Rating %d"):format(Cards.positionLabel(opening.player), opening.player.rating), "positive", now)
	end
	local reveal = revealFor(opening, now, random, by or "Du")
	f.starPackReveal = reveal
	notify(session, "reveal", { reveal = reveal })
	return true, opening.duplicate and ("Doppelt gezogen · +%s Fragmente"):format(Util.formatNumber(opening.fragmentCompensation)) or opening.player.name .. " gezogen"
end

function Actions.openRewardPack(session: Session, payload: any, now: number, random: () -> number): (boolean, string)
	local f = features(session)
	if f.cup.active then
		return false, "Während eines Spiels keine Packs."
	end
	local reveal = Features.openEarnedPack(f, tostring(payload.id), now, random)
	if not reveal then
		return false, "Diese Prämie wurde bereits geöffnet."
	end
	notify(session, "reveal", { reveal = reveal })
	return true, ""
end

------------------------------------------------------------------------------------------
-- Squad

local function squadLockError(f: any, playerId: string): string?
	if f.squadLock and not table.find(f.squadLock.playerIds, playerId) then
		return "Dieser Spieler gehört nicht zum Reisekader."
	end
	return nil
end

function Actions.setStarter(session: Session, payload: any): (boolean, string)
	local f = features(session)
	local playerId, slot = tostring(payload.playerId), math.floor(tonumber(payload.slot) or 0)
	local player = Cards.get(playerId)
	if f.cup.active then
		return false, "Öffne Wechsel / Taktik in der Matchansicht."
	end
	if not player or slot < 1 or slot > Cards.SQUAD_SIZE or not table.find(f.starXI.ownedIds, playerId) then
		return false, "Dieser Spieler ist nicht verfügbar."
	end
	local lockError = squadLockError(f, playerId)
	if lockError then
		return false, lockError
	end
	if table.find(f.cup.suspendedPlayerIds, playerId) then
		return false, player.name .. " ist nach der Roten Karte für die nächste Partie gesperrt."
	end
	if not Cards.canFillSlot(playerId, slot, f.starXI.formationPositions) then
		return false, ("%s kann nicht auf %s spielen."):format(player.name, f.starXI.formationPositions[slot])
	end
	f.starXI = StarXI.setStarter(f.starXI, slot, playerId, Features.unavailableIds(f))
	return true, ("%s auf %s gesetzt"):format(player.name, f.starXI.formationPositions[slot])
end

function Actions.setBench(session: Session, payload: any): (boolean, string)
	local f = features(session)
	local playerId, index = tostring(payload.playerId), math.floor(tonumber(payload.index) or 0)
	local player = Cards.get(playerId)
	if not player or f.cup.active or not table.find(f.starXI.ownedIds, playerId) or table.find(f.starXI.lineupIds, playerId) then
		return false, "Dieser Spieler kann nicht auf die Bank."
	end
	local lockError = squadLockError(f, playerId)
	if lockError then
		return false, lockError
	end
	if table.find(f.cup.suspendedPlayerIds, playerId) then
		return false, player.name .. " darf nach einer Roten Karte nicht auf die Bank."
	end
	f.starXI = StarXI.setBench(f.starXI, index, playerId, Features.unavailableIds(f))
	return true, player.name .. " auf die Bank verschoben"
end

-- Moves a starter to the bench slot (or swaps with the bench player there).
function Actions.swapLineupBench(session: Session, payload: any): (boolean, string)
	local f = features(session)
	local slot, index = math.floor(tonumber(payload.slot) or 0), math.floor(tonumber(payload.index) or 0)
	local incoming = f.starXI.benchIds[index]
	if not incoming or incoming == "" then
		return false, "Auf diesem Bankplatz sitzt niemand."
	end
	return Actions.setStarter(session, { playerId = incoming, slot = slot })
end

function Actions.setFormation(session: Session, payload: any, now: number): (boolean, string)
	local f = features(session)
	local formation = Cards.formation(tostring(payload.id))
	if f.cup.active then
		return false, "Während eines Spiels bleibt die Formation."
	end
	if formation.id ~= payload.id or formation.id == f.starXI.formationId then
		return false, ""
	end
	if not unlocked(session, formation.unlockSeason or 1) then
		return false, ("%s wird in Saison %d freigeschaltet."):format(formation.label, formation.unlockSeason)
	end
	f.starXI = StarXI.setFormation(f.starXI, formation.id, Features.unavailableIds(f))
	History.add(f, "Formation angepasst", ("Die Startelf spielt jetzt im %s."):format(formation.label), "neutral", now)
	return true, "Formation: " .. formation.label
end

function Actions.bestLineup(session: Session, now: number): (boolean, string)
	local f = features(session)
	if f.cup.active then
		return false, "Während eines Pokalspiels kann die Startelf nicht automatisch geändert werden."
	end
	local nextState = StarXI.setBest(f.starXI, Features.unavailableIds(f), ratingOf(session))
	local count = StarXI.filledCount(nextState.lineupIds)
	if count == 0 then
		return false, "Du hast noch keine passenden Spieler im Kader."
	end
	f.starXI = nextState
	History.add(f, "Beste Startelf aufgestellt", ("%d von 11 Positionen mit den stärksten passenden Spielern besetzt."):format(count), "positive", now)
	return true, ("Beste Startelf · %d von 11"):format(count)
end

------------------------------------------------------------------------------------------
-- Matches and travel

function Actions.eligibilityError(session: Session, mode: string, tournamentId: string, now: number): string?
	local f = features(session)
	if f.cup.active then
		return "Es läuft bereits ein Match."
	end
	if mode == "season" and (f.seasonMode.hallOfFame or f.cup.pendingNextRound) then
		return f.seasonMode.hallOfFame and "Die Hall of Fame ist erreicht. Starte zuerst Prestige." or "Zuerst die laufende Saison oder Turnierrunde abschliessen."
	end
	if mode == "tournament" then
		local tournament = Cup.tournament(tournamentId)
		if not tournament then
			return "Dieses Turnier gibt es nicht."
		end
		if f.cup.pendingNextRound and f.cup.tournamentId ~= tournamentId then
			return "Zuerst die aktuelle Turnierrunde abschliessen."
		end
		if not f.cup.pendingNextRound and f.cup.nextTournamentAt > now then
			return "Neues Turnier in " .. Util.formatCountdown(f.cup.nextTournamentAt, now) .. "."
		end
		if not unlocked(session, tournament.unlockSeason or 1) then
			return ("%s wird in Saison %d freigeschaltet."):format(tournament.label, tournament.unlockSeason)
		end
	end
	if #Features.openVacancies(f) > 0 then
		return "Schliesse zuerst die Kaderlücke."
	end
	if #StarXI.selection(f.starXI.ownedIds, f.starXI.lineupIds) < Cards.SQUAD_SIZE then
		return "Für die Startelf werden 11 passende Spieler benötigt."
	end
	local squad = Util.concat(f.starXI.lineupIds, f.starXI.benchIds)
	if Util.some(f.cup.suspendedPlayerIds, function(id)
		return table.find(squad, id) ~= nil
	end) then
		return "Ersetze zuerst die gesperrten Spieler."
	end
	if Util.some(squad, function(id)
		return (tonumber(f.cup.injuredPlayerIds[id]) or 0) > 0
	end) then
		return "Ersetze zuerst die verletzten Spieler."
	end
	if f.squadLock and Util.some(squad, function(id)
		return id ~= "" and not table.find(f.squadLock.playerIds, id)
	end) then
		return "Dieser Spieler gehört nicht zum Reisekader."
	end
	if mode == "tournament" and StarXI.rating(f.starXI.ownedIds, f.starXI.lineupIds) < Cup.tournament(tournamentId).minimumRating then
		return ("%s braucht mindestens %d OVR."):format(Cup.tournament(tournamentId).label, Cup.tournament(tournamentId).minimumRating)
	end
	return nil
end

-- Home matches start right away; away matches first need the journey.
function Actions.startMatch(session: Session, payload: any, now: number, random: () -> number): (boolean, string)
	local f = features(session)
	local mode = payload.mode == "tournament" and "tournament" or "season"
	local tournamentId = mode == "tournament" and tostring(payload.tournamentId or "stadium") or "stadium"
	local problem = Actions.eligibilityError(session, mode, tournamentId, now)
	if problem then
		return false, problem
	end
	local fixture = Travel.fixture(f, mode, tournamentId)
	Travel.settle(f.travel, now)
	local journey = f.travel.journey
	if journey and not journey.consumed and journey.fixture.id ~= fixture.id then
		return false, "Schliesse zuerst die bereits begonnene Auswärtsreise ab."
	end
	if fixture.away then
		if not journey or journey.fixture.id ~= fixture.id then
			Features.lockSquad(f, fixture.id, now)
			f.travel.journey = Travel.createJourney(fixture, now, random, Features.eventPlayers(f), f.travel.stats.recentEvents, f.squadLock and Util.deepCopy(f.squadLock))
			local venue = Travel.venue(fixture.venueId)
			History.add(f, "Reise nach " .. venue.city, ("%s · %s · %s km"):format(fixture.opponent, Travel.transportLabel(f.travel.journey.transport), Util.formatInteger(venue.km)), "neutral", now)
			return true, "Reise gestartet."
		end
		if journey.consumed then
			return false, "Diese Partie wurde bereits gestartet."
		end
		if now < journey.endsAt then
			return false, "Die Mannschaft ist noch unterwegs."
		end
		fixture = journey.fixture
	end
	local homePlayers = StarXI.selection(f.starXI.ownedIds, f.starXI.lineupIds)
	if mode == "tournament" then
		if not f.cup.pendingNextRound then
			Features.activatePendingLoans(f, tournamentId)
		end
		f.cup = Cup.beginTournament(f.cup, now, tournamentId, homePlayers, f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds, fixture.schedule, random)
	else
		Features.activatePendingLoans(f, "stadium")
		local state = f.seasonMode
		f.cup = Cup.beginSeason(f.cup, Season.nextOpponent(state), state.division, state.matchday, now, homePlayers, f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds)
	end
	if not f.cup.active then
		return false, "Das Turnier ist noch in der Pause."
	end
	f.cup.careerMatchId = "career:" .. fixture.id
	f.cup.fixture = { id = fixture.id, away = fixture.away, neutral = fixture.neutral, venueId = fixture.venueId, opponentId = fixture.opponentId }
	if f.travel.journey and f.travel.journey.fixture.id == fixture.id then
		f.travel.journey.consumed = true
	end
	Career.prepareMatch(f, now)
	notify(session, "matchStart", {})
	if mode == "tournament" then
		return true, Cup.tournament(tournamentId).label .. " · Anpfiff"
	end
	return true, ("Spieltag %d · %s · Anpfiff"):format(f.seasonMode.matchday + 1, f.cup.opponent)
end

local function recordSeasonMatch(session: Session, now: number, random: () -> number)
	local game, f = session.game, features(session)
	local state, entry = Season.recordMatch(f.seasonMode, f.cup.homeScore, f.cup.awayScore, f.club.name, now, random, f.cup.opponentIds[1])
	if not entry then
		return
	end
	Career.recordMatch(f, now, entry)
	f.seasonMode = state
	Season.renameClub(f.seasonMode, f.club.name)
	Features.finishActiveLoans(f, now)
	local label = entry.seasonOutcome == "promoted" and "Aufstieg" or entry.seasonOutcome == "relegated" and "Abstieg" or entry.seasonOutcome == "hall-of-fame" and "Hall of Fame"
		or entry.completedSeason and "Klassenerhalt" or entry.outcome == "win" and "Sieg" or entry.outcome == "loss" and "Niederlage" or "Remis"
	local tone = (entry.seasonOutcome == "relegated" or entry.outcome == "loss") and "negative" or (entry.seasonOutcome == "promoted" or entry.seasonOutcome == "hall-of-fame" or entry.outcome == "win") and "positive" or "neutral"
	History.add(f, "Saisonspiel · " .. label, ("%d:%d gegen %s · Spieltag %d/%d"):format(entry.clubScore, entry.opponentScore, entry.opponent, entry.matchday, Season.MATCHES_PER_SEASON), tone, now)
	local reward = entry.seasonOutcome == "promoted" and 1 or entry.seasonOutcome == "hall-of-fame" and 2 or 0
	game.seasons = math.max(game.seasons, f.seasonMode.highestDivision - 1)
	game.stars = math.min(Economy.MAX_SEASON_STARS, game.stars + reward)
	notify(session, "standings", { entry = entry, table = f.seasonMode.lastTable })
end

-- After the final whistle (or the decisive penalty).
local function afterMatch(session: Session, result: any, now: number, random: () -> number)
	local f = features(session)
	Features.releaseSquad(f, now)
	f.starXI = StarXI.restoreAfterMatch(f.starXI, f.cup)
	if f.cup.mode == "season" then
		recordSeasonMatch(session, now, random)
	else
		Career.recordMatch(f, now, nil)
		local title = result.tournamentWon and ((Cup.tournament(f.cup.tournamentId) or {}).trophyName or "Pokal") .. " gewonnen"
			or result.won and ("Runde %d gewonnen"):format(result.completedRound) or "Turnieraus gegen " .. result.opponent
		local detail = result.tournamentWon and ("Trophäe erhalten · " .. Packs.tournamentRewardPack(f.cup.tournamentId).label)
			or f.cup.pendingNextRound and (#f.cup.suspendedPlayerIds > 0 and "Rote Karte · Gesperrten Spieler ersetzen und nächste Partie manuell starten" or "Aufstellung anpassen und nächste Partie manuell starten")
			or "Der nächste Turnierlauf kommt bestimmt."
		History.add(f, title, detail, result.won and "positive" or "negative", now)
		if result.runEnded then
			Features.completeTournamentRun(f, { tournamentId = f.cup.tournamentId, tournamentWon = result.tournamentWon, completedRound = result.completedRound, opponent = result.opponent, homeScore = f.cup.homeScore, awayScore = f.cup.awayScore, tieBreak = result.tieBreak }, now, random)
			local issue = f.gazetteIssues[#f.gazetteIssues]
			if issue and issue.createdAt == now then
				notify(session, "gazette", { issue = issue })
			end
		end
	end
	notify(session, "matchEnd", { won = result.won, tournamentWon = result.tournamentWon })
end

function Actions.penalty(session: Session, payload: any, now: number, random: () -> number): (boolean, string)
	local f = features(session)
	if not f.cup.active or f.cup.phase ~= "penalties" then
		return false, ""
	end
	local homePlayers = StarXI.selection(f.starXI.ownedIds, f.starXI.lineupIds)
	local rating = MatchRatings.effectiveTeamRating(f.starXI.ownedIds, f.starXI.lineupIds, f.cup, 120)
	local cup, result = Cup.penalty(f.cup, rating, tostring(payload.direction), now, random, homePlayers, f.starXI.formationPositions)
	f.cup = cup
	if result.finished then
		afterMatch(session, result, now, random)
	end
	return true, ""
end

function Actions.editMatch(session: Session, now: number): (boolean, string)
	local f = features(session)
	f.cup = Cup.requestEdit(f.cup, now)
	return true, ""
end

function Actions.confirmDraft(session: Session, payload: any, now: number): (boolean, string)
	local f = features(session)
	local draft = {
		lineup = type(payload.lineup) == "table" and Util.map(Util.slice(payload.lineup, 1, 11), function(id)
			return tostring(id)
		end) or {},
		formation = f.starXI.formationId,
		strategy = tostring(payload.strategy or f.cup.strategyId),
	}
	local problem = Cup.confirmDraft(f, draft, now)
	if problem ~= "" then
		return false, problem
	end
	return true, "Änderungen übernommen. Die Partie läuft weiter."
end

function Actions.resumeMatch(session: Session, now: number): (boolean, string)
	local f = features(session)
	if not f.cup.active or not f.cup.matchPaused then
		return false, ""
	end
	f.cup = Cup.resume(f.cup, now)
	return true, ""
end

------------------------------------------------------------------------------------------
-- Rewards, press, album, missions, prestige, club

function Actions.claimDaily(session: Session, key: string, now: number): (boolean, string)
	local game, f = session.game, features(session)
	local claim = Daily.claim(f.dailyRewards, key, Economy.basePassivePower(game.upgrades, game.stars, f), Economy.baseClickPower(game.upgrades, game.stars, f), now)
	if not claim then
		return false, "Die Prämie für heute ist schon abgeholt."
	end
	f.dailyRewards = claim.state
	GameState.addGoals(game, claim.amount)
	if claim.pack and not Util.some(f.earnedPacks, function(pack)
		return pack.id == claim.pack.id
	end) then
		table.insert(f.earnedPacks, claim.pack)
	end
	History.add(f, "Tägliche Prämie · Tag " .. claim.dayIndex, ("%s holt +%s Tore%s. Serie: %d %s."):format(session.memberName(nil), Util.formatNumber(claim.amount), claim.pack and " und ein Prämienpack" or "", claim.streak, claim.streak == 1 and "Tag" or "Tage"), "positive", now)
	notify(session, "sound", { name = "reward" })
	return true, ("Tag %d: +%s Tore%s"):format(claim.dayIndex, Util.formatNumber(claim.amount), claim.pack and " und ein Prämienpack" or "")
end

function Actions.answerPress(session: Session, payload: any, now: number): (boolean, string)
	local game, f = session.game, features(session)
	local result = Press.answer(f.press, f.cup, f.club.name, tostring(payload.matchId), tostring(payload.questionId), math.floor(tonumber(payload.answer) or 0), now)
	if not result then
		return false, "Diese Pressekonferenz ist schon vorbei."
	end
	local reward = Press.reward(Economy.basePassivePower(game.upgrades, game.stars, f), Economy.baseClickPower(game.upgrades, game.stars, f))
	f.press = result.press
	GameState.addGoals(game, reward)
	History.add(f, "Pressekonferenz", ("«%s» · Fanstimmung %s"):format(result.answer, Util.formatSigned(result.mood)), result.mood >= 0 and "positive" or "neutral", now)
	return true, ("Medienprämie +%s Tore · Fanstimmung %s"):format(Util.formatNumber(reward), Util.formatSigned(result.mood))
end

function Actions.claimAlbum(session: Session, payload: any, now: number): (boolean, string)
	local f = features(session)
	local id = tostring(payload.id)
	local ok = id == "all" and Career.claimAllAlbums(f, now) > 0 or (id ~= "all" and Career.claimAlbum(f, id, now))
	if not ok then
		return false, "Diese Sammlung ist noch nicht vollständig oder ihre Prämie wurde bereits abgeholt."
	end
	return true, "Sammelprämie abgeholt"
end

function Actions.claimMission(session: Session, payload: any, now: number): (boolean, string)
	local game, f = session.game, features(session)
	local mission = Util.find(f.missions, function(item)
		return item.id == payload.id
	end)
	if not mission then
		return false, "Diese Mission gibt es nicht."
	end
	if mission.claimed then
		return false, "Diese Mission wurde bereits abgeholt."
	end
	if Features.missionProgress(mission, game) < mission.target then
		return false, "Die Mission ist noch nicht abgeschlossen."
	end
	mission.claimed = true
	GameState.addGoals(game, mission.reward)
	History.add(f, mission.title .. " abgeschlossen", ("+%s Tore Teamprämie"):format(Util.formatInteger(mission.reward)), "positive", now)
	return true, ("%s abgeschlossen. +%s Tore für das Team."):format(mission.title, Util.formatNumber(mission.reward))
end

function Actions.prestige(session: Session, now: number): (boolean, string)
	local game, f = session.game, features(session)
	if f.travel.journey and not f.travel.journey.consumed then
		return false, "Schliesse zuerst die Auswärtsreise ab."
	end
	if not f.seasonMode.hallOfFame then
		return false, "Prestige wird erst nach der Hall of Fame freigeschaltet."
	end
	f.seasonMode = Season.startPrestige(f.seasonMode, f.club.name, now)
	game.seasons = math.max(game.seasons, MAX_CAREER_SEASON - 1)
	game.stars = math.min(Economy.MAX_SEASON_STARS, game.stars + 2)
	History.add(f, ("Prestige %d gestartet"):format(f.seasonMode.prestigeCount), "Die Hall-of-Fame-Jagd beginnt erneut in Saison 1.", "positive", now)
	return true, "Prestige gestartet"
end

function Actions.saveClub(session: Session, payload: any, now: number, filterName: ((string) -> string)?): (boolean, string)
	local f = features(session)
	local raw = string.sub(string.gsub(tostring(payload.name or ""), "%s+", " "), 1, 22)
	raw = (string.gsub(raw, "^%s+", ""))
	raw = (string.gsub(raw, "%s+$", ""))
	local name = raw ~= "" and raw or "FC Goal"
	if filterName then
		name = filterName(name)
	end
	local badge = table.find(Features.CLUB_BADGES, payload.badge) and payload.badge or Features.CLUB_BADGES[1]
	local color = table.find(Features.CLUB_COLORS, payload.color) and payload.color or Features.CLUB_COLORS[1]
	f.club = { name = name, badge = badge, color = color }
	Season.renameClub(f.seasonMode, name)
	History.add(f, "Clubprofil aktualisiert", ("%s %s ist bereit für die nächste Runde."):format(badge, name), "neutral", now)
	return true, "Clubprofil gespeichert"
end

------------------------------------------------------------------------------------------
-- Mini games

function Actions.startMiniGame(session: Session, payload: any, now: number, random: () -> number): (boolean, string)
	local id = tostring(payload.id)
	if not MiniGames.COOLDOWN_SECONDS[id] then
		return false, "Dieses Minigame gibt es nicht."
	end
	local cooldown = session.game.miniGameCooldowns[id] or 0
	if cooldown > now then
		return false, ("%s ist noch %s gesperrt."):format(MiniGames.NAMES[id], Util.formatCountdown(cooldown, now))
	end
	session.miniGame = MiniGames.start(id, random)
	return true, ""
end

function Actions.playMiniGame(session: Session, payload: any, now: number, random: () -> number): (boolean, string)
	local current = session.miniGame
	if not current or current.finished then
		return false, ""
	end
	local nextGame = MiniGames.play(current, tostring(payload.choice), random)
	session.miniGame = nextGame
	if nextGame.finished then
		local game = session.game
		GameState.addGoals(game, nextGame.reward)
		game.minigameWins += 1
		game.miniGameCooldowns[current.id] = now + MiniGames.COOLDOWN_SECONDS[current.id] * 1000
		notify(session, "feed", { icon = "star", text = ("%s: +%s Tore Prämie. Nächste Runde in %d Sekunden."):format(nextGame.title, Util.formatNumber(nextGame.reward), MiniGames.COOLDOWN_SECONDS[current.id]) })
		notify(session, "sound", { name = "reward" })
		return true, ("%s: +%s Tore"):format(nextGame.title, Util.formatNumber(nextGame.reward))
	end
	return true, ""
end

------------------------------------------------------------------------------------------
-- Codes

Actions.CODES = {
	SILVAN = function(session: Session, now: number): string
		local f = features(session)
		local silvuz = Cards.get("star-silvuz")
		if silvuz and not table.find(f.starXI.ownedIds, silvuz.id) then
			f.starXI = StarXI.add(f.starXI, silvuz.id)
			local reveal = { packId = "legend", packName = "Silvan Code", playerId = silvuz.id, duplicate = false, fragmentCompensation = 0, openedAt = now, openedBy = session.memberName(nil), troll = false }
			f.starPackReveal = reveal
			notify(session, "reveal", { reveal = reveal })
			History.add(f, "Silvuz freigeschaltet", "100 Rating · LF / LM / RF · Schweiz", "positive", now)
			return "Silvan Code eingelöst: Silvuz ist in deinem Club."
		end
		History.add(f, "Silvuz freigeschaltet", "Silvuz war bereits im Club.", "positive", now)
		return "Silvuz war bereits in deinem Club."
	end,
}

function Actions.redeemCode(session: Session, payload: any, now: number): (boolean, string)
	local code = string.upper((string.gsub(tostring(payload.code or ""), "%s", "")))
	local handler = Actions.CODES[code]
	if not handler then
		return false, "Dieser Code ist ungültig."
	end
	if table.find(session.game.redeemedCodes, code) then
		return false, "Dieser Code wurde bereits eingelöst."
	end
	table.insert(session.game.redeemedCodes, code)
	return true, handler(session, now)
end

------------------------------------------------------------------------------------------
-- Dispatcher

local HANDLERS: { [string]: (Session, any, number, () -> number) -> (boolean, string) } = {
	buyUpgrade = function(s, p)
		return Actions.buyUpgrade(s, p)
	end,
	buyPack = function(s, p, n, r)
		return Actions.buyPack(s, p, n, r, s.memberName(nil))
	end,
	drawCustom = function(s, _, n, r)
		return Actions.drawCustom(s, n, r, s.memberName(nil))
	end,
	openRewardPack = Actions.openRewardPack,
	setStarter = function(s, p)
		return Actions.setStarter(s, p)
	end,
	setBench = function(s, p)
		return Actions.setBench(s, p)
	end,
	swapLineupBench = function(s, p)
		return Actions.swapLineupBench(s, p)
	end,
	setFormation = function(s, p, n)
		return Actions.setFormation(s, p, n)
	end,
	bestLineup = function(s, _, n)
		return Actions.bestLineup(s, n)
	end,
	startMatch = Actions.startMatch,
	penalty = Actions.penalty,
	editMatch = function(s, _, n)
		return Actions.editMatch(s, n)
	end,
	confirmDraft = function(s, p, n)
		return Actions.confirmDraft(s, p, n)
	end,
	resumeMatch = function(s, _, n)
		return Actions.resumeMatch(s, n)
	end,
	answerPress = function(s, p, n)
		return Actions.answerPress(s, p, n)
	end,
	claimAlbum = function(s, p, n)
		return Actions.claimAlbum(s, p, n)
	end,
	claimMission = function(s, p, n)
		return Actions.claimMission(s, p, n)
	end,
	prestige = function(s, _, n)
		return Actions.prestige(s, n)
	end,
	startMiniGame = Actions.startMiniGame,
	playMiniGame = Actions.playMiniGame,
	redeemCode = function(s, p, n)
		return Actions.redeemCode(s, p, n)
	end,
	toggleSound = function(s)
		s.game.sound = not s.game.sound
		return true, s.game.sound and "Sound an" or "Sound aus"
	end,
}

function Actions.run(session: Session, name: string, payload: any, now: number, random: () -> number): (boolean, string)
	local handler = HANDLERS[name]
	if not handler then
		return false, "Unbekannte Aktion."
	end
	return handler(session, type(payload) == "table" and payload or {}, now, random)
end

------------------------------------------------------------------------------------------
-- Tick: passive income, events, rumours, travel and the live match.

function Actions.tick(session: Session, now: number, elapsedMs: number, random: () -> number)
	local game, f = session.game, features(session)
	local base = Economy.basePassivePower(game.upgrades, game.stars, f)
	if base > 0 and elapsedMs > 0 then
		GameState.addGoals(game, Economy.boostedPassiveReward(base, f, now - elapsedMs, now))
	end
	Travel.settle(f.travel, now)
	if f.cup.active then
		local lastGoalId = f.cup.lastGoal and f.cup.lastGoal.id
		local cardCount = #f.cup.cardEvents
		local cup, result = Cup.advance(f.cup, now)
		f.cup = cup
		if cup.lastGoal and cup.lastGoal.id ~= lastGoalId then
			notify(session, "matchGoal", { goal = cup.lastGoal })
		end
		if #cup.cardEvents > cardCount then
			notify(session, "redCard", { event = cup.cardEvents[#cup.cardEvents] })
		end
		if result.finished then
			afterMatch(session, result, now, random)
		end
	end
	if not f.squadLock then
		if not f.cup.active and f.transferSaga.nextAt <= now then
			local event, delta = Features.resolveTransferEvent(f, random, now)
			if event then
				GameState.addGoals(game, delta)
				notify(session, "transfer", { event = event })
			end
		elseif f.nextVarAt <= now then
			local event = Features.varEvent(game.goals, random(), now)
			GameState.addGoals(game, math.floor(event.amount))
			f.randomEvent = event
			f.nextVarAt = now + Features.randomEventDelay(random())
			History.add(f, event.title, event.message, event.tone, now)
			notify(session, "event", { event = event })
		elseif f.nextEventAt <= now then
			local event = Features.randomEvent(game.goals, random(), now)
			GameState.addGoals(game, math.floor(event.amount))
			f.randomEvent = event
			f.nextEventAt = now + Features.randomEventDelay(random())
			History.add(f, event.title, event.message, event.tone, now)
			notify(session, "event", { event = event })
		end
	end
	for _, achievement in GameState.newAchievements(game) do
		notify(session, "achievement", { achievement = achievement })
	end
end

return Actions
