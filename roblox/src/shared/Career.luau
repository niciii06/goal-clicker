--!strict
-- Player careers: match reports, form, milestone cards, rivalries, season awards and the album.
local Broadcast = require(script.Parent.Broadcast)
local Cards = require(script.Parent.Cards)
local History = require(script.Parent.History)
local MatchRatings = require(script.Parent.MatchRatings)
local Progression = require(script.Parent.Data.Progression) :: any
local Simulation = require(script.Parent.Simulation)
local Util = require(script.Parent.Util)

local Career = {}

Career.MILESTONES = Progression.careerMilestones :: { any }
Career.METRIC_LABELS = Progression.milestoneMetricLabels :: { [string]: string }

local milestoneById = {}
for _, milestone in Career.MILESTONES do
	milestoneById[milestone.id] = milestone
end

function Career.emptyStats(): any
	return { appearances = 0, minutes = 0, goals = 0, assists = 0, ratingTotal = 0, ratedMatches = 0, motm = 0, subAppearances = 0, subRatingTotal = 0, subMinutes = 0, recent = {} }
end

function Career.initial(): any
	return { version = 2, players = {}, seasonPlayers = {}, seasonNumber = 1, seasonMatches = 0, awards = {}, reports = {}, processedMatchIds = {}, rivals = {}, collectedIds = {}, claimedAlbumRewards = {}, milestoneCards = {}, milestoneCategories = {} }
end

local CATEGORY_BY_POSITION = {
	TW = "goalkeeper", IV = "defender", LV = "defender", RV = "defender", LAV = "defender", RAV = "defender",
	ZDM = "midfielder", ZM = "midfielder", ZOM = "midfielder", LM = "winger", RM = "winger", LF = "winger", RF = "winger",
}

function Career.category(player: Cards.Player): string
	return CATEGORY_BY_POSITION[player.position or ""] or "striker"
end

function Career.playerMilestones(career: any, player: Cards.Player): { any }
	local category = career.milestoneCategories[player.id] or Career.category(player)
	local prefix = "position-" .. category .. "-"
	return Util.filter(Career.MILESTONES, function(milestone)
		return string.sub(milestone.id, 1, #prefix) == prefix
	end)
end

function Career.form(career: any, playerId: string): any
	local recent = career.players[playerId] and career.players[playerId].recent or {}
	local average = #recent > 0 and Util.sum(recent, function(value)
		return value
	end) / #recent or 6.5
	local bonus = #recent > 0 and Util.round1(math.max(-2, math.min(2, (average - 6.5) * 1.5))) or 0
	return { average = average, bonus = bonus, matches = #recent, label = bonus >= 0.5 and "In Form" or bonus <= -0.5 and "Formtief" or "Stabil" }
end

function Career.card(career: any, player: Cards.Player): any
	local best = nil
	for _, id in career.milestoneCards[player.id] or {} do
		local milestone = milestoneById[id]
		if milestone and (not best or milestone.bonus > best.bonus) then
			best = milestone
		end
	end
	return {
		milestone = best,
		bonus = best and math.min(best.bonus, 100 - player.rating) or 0,
		rating = math.min(100, player.rating + (best and best.bonus or 0)),
	}
end

-- Rating used to pick the best eleven: card, form, milestone card and live match form.
function Career.selectionRating(player: Cards.Player, career: any?, cup: any?, minute: number?): number
	local form = career and Career.form(career, player.id).bonus or 0
	local card = career and Career.card(career, player).bonus or 0
	local currentMatch = cup and cup.active and cup.matchStartedAt > 0
	local prepared = nil
	if currentMatch and cup.careerRatingSeed == cup.matchStartedAt and cup.careerBonuses then
		prepared = cup.careerBonuses[player.id]
	end
	local base = math.min(100, player.rating + (prepared or (form + card)))
	local live = currentMatch and MatchRatings.cupPlayerRating(cup, player.id, minute or 1) or nil
	local fitness = currentMatch and cup.broadcast and cup.broadcast.fitness[player.id] or 100
	return base - math.max(0, 100 - fitness) * 0.045 + (live and (live - 6.5) * 2.8 or 0)
end

function Career.rivalryKey(opponent: string): string
	return "rival:" .. string.lower((string.gsub(Util.replaceAll(opponent, "\t", " "), "%s+", " ")))
end

-- Prepares a fresh match: form bonuses, deterministic seed and the interactive engine.
function Career.prepareMatch(features: any, now: number)
	local bonuses = {}
	for _, id in features.starXI.ownedIds do
		local player = Cards.get(id)
		if player then
			bonuses[id] = Career.form(features.career, id).bonus + Career.card(features.career, player).bonus
		end
	end
	local cup = features.cup
	cup.careerBonuses = bonuses
	cup.careerRatingSeed = cup.matchStartedAt
	cup.careerMatchId = cup.careerMatchId or ("career-%d-%s-%s"):format(cup.matchStartedAt, cup.mode, cup.opponent)
	if not cup.simulation then
		cup.broadcast = cup.broadcast or Broadcast.create(cup)
		cup.simulation = Simulation.create(cup, features.starXI.lineupIds, features.starXI.formationId)
	end
	local rival = features.career.rivals[Career.rivalryKey(cup.opponent)]
	if rival and rival.active then
		History.add(features, "Derby gegen " .. rival.opponent, ("%d Siege · %d Remis · %d Niederlagen. Die Kurve fordert Revanche!"):format(rival.wins, rival.draws, rival.losses), "neutral", now)
	end
end

function Career.goalAssistId(goal: any): string?
	if goal.pattern == "penalty" or goal.pattern == "rebound" then
		return nil
	end
	if goal.assistId ~= nil then
		return goal.assistId
	end
	for id, impact in goal.ratingImpacts do
		if id ~= goal.scorerId and impact > 0 then
			return id
		end
	end
	return nil
end

function Career.goalLabel(goal: any, includeMinute: boolean?): string
	local assistId = Career.goalAssistId(goal)
	local assistCard = assistId and Cards.get(assistId)
	local assist = assistId and (goal.assistName or (assistCard and assistCard.name)) or nil
	return goal.scorer .. (includeMinute ~= false and (" " .. goal.minute .. "′") or "") .. (goal.pattern == "penalty" and " (P)" or "") .. (assist and (" (" .. assist .. ")") or "")
end

function Career.ratingBreakdown(cup: any, playerId: string, minute: number): any?
	local entered = cup.playerEnteredAt[playerId]
	local player = Cards.get(playerId)
	if not entered or not player or entered > minute then
		return nil
	end
	local finish = math.min(minute, cup.playerExitedAt[playerId] or minute)
	local goals, assists, goalValue, assistValue, faultValue, clean = 0, 0, 0, 0, 0, true
	for _, event in cup.matchEvents do
		if event.minute >= entered and event.minute <= finish then
			local impact = event.ratingImpacts[playerId] or 0
			if event.side == "home" and event.scorerId == playerId then
				goals += 1
				goalValue += impact
			elseif event.side == "home" then
				if impact > 0 then
					assists += 1
				end
				assistValue += math.max(0, impact)
			else
				clean = false
				faultValue += math.min(0, impact)
			end
		end
	end
	local position = cup.playerMatchPositions[playerId] or player.position
	local cleanValue = clean and MatchRatings.cleanSheetValue(position, math.min(1, (finish - entered + 1) / 90)) or 0
	local rating = MatchRatings.cupPlayerRating(cup, playerId, minute) or 6.4
	local base = MatchRatings.playerRating(playerId, cup.careerRatingSeed or cup.matchStartedAt, finish, 0, entered, 0, position)
	local reasons = { { label = "Grundleistung und Tagesform", value = base } }
	if goals > 0 then
		table.insert(reasons, { label = goals .. (goals == 1 and " Tor" or " Tore"), value = goalValue })
	end
	if assists > 0 then
		table.insert(reasons, { label = assists .. (assists == 1 and " Vorlage" or " Vorlagen"), value = assistValue })
	end
	if faultValue ~= 0 then
		table.insert(reasons, { label = "Beteiligung an Gegentoren", value = faultValue })
	end
	if cleanValue ~= 0 then
		table.insert(reasons, { label = "Ohne Gegentor auf dem Platz", value = cleanValue })
	end
	local actions = Broadcast.actionRating(cup, playerId, finish)
	if actions ~= 0 then
		table.insert(reasons, { label = "Erfasste Aktionen: Zuspiele, Schüsse, Paraden und Karten", value = actions })
	end
	local rounding = rating - base - goalValue - assistValue - faultValue - cleanValue - actions
	if math.abs(rounding) > 0.00001 then
		table.insert(reasons, { label = "Rundung und Notengrenzen (4.5 bis 10)", value = rounding })
	end
	if Util.some(cup.cardEvents, function(event)
		return event.playerId == playerId
	end) then
		table.insert(reasons, { label = "Rote Karte: Team geschwächt, Einsatz beendet", value = 0 })
	end
	if Util.some(cup.injuryEvents, function(event)
		return event.playerId == playerId
	end) then
		table.insert(reasons, { label = "Verletzungsbedingtes Einsatzende", value = 0 })
	end
	return { playerId = playerId, rating = rating, minutes = finish - entered + 1, goals = goals, assists = assists, substitute = entered > 1, reasons = reasons }
end

local function addStats(current: any?, report: any, motm: boolean): any
	local s = current or Career.emptyStats()
	local recent = table.clone(s.recent)
	if report.minutes >= 15 then
		table.insert(recent, report.rating)
		recent = Util.tail(recent, 5)
	end
	return {
		appearances = s.appearances + 1, minutes = s.minutes + report.minutes, goals = s.goals + report.goals, assists = s.assists + report.assists,
		ratingTotal = s.ratingTotal + report.rating, ratedMatches = s.ratedMatches + 1, motm = s.motm + (motm and 1 or 0),
		subAppearances = s.subAppearances + (report.substitute and 1 or 0), subRatingTotal = s.subRatingTotal + (report.substitute and report.rating or 0),
		subMinutes = s.subMinutes + (report.substitute and report.minutes or 0), recent = recent,
	}
end

local function pickAward(entries: { any }, score: (any) -> number, display: (any) -> string, ascending: boolean?): any?
	local sorted = table.clone(entries)
	table.sort(sorted, function(a, b)
		local sa, sb = score(a.stats), score(b.stats)
		if sa ~= sb then
			if ascending then
				return sa < sb
			end
			return sa > sb
		end
		if a.stats.minutes ~= b.stats.minutes then
			return a.stats.minutes > b.stats.minutes
		end
		return a.id < b.id
	end)
	local first = sorted[1]
	return first and { playerId = first.id, value = display(first.stats) } or nil
end

-- Writes reports, stats, milestones, rivalries and (at season end) the season awards.
function Career.recordMatch(features: any, now: number, seasonEntry: any?)
	local cup, career = features.cup, features.career
	if cup.active or cup.matchStartedAt == 0 then
		return
	end
	local id = cup.careerMatchId or ("career-%d-%s-%s"):format(cup.matchStartedAt, cup.mode, cup.opponent)
	if table.find(career.processedMatchIds, id) then
		return
	end
	local minute = (cup.phase == "extra-time" or cup.phase == "penalties") and 120 or 90
	local players = {}
	for _, playerId in Util.keys(cup.playerEnteredAt) do
		local report = Career.ratingBreakdown(cup, playerId, minute)
		if report then
			table.insert(players, report)
		end
	end
	local ranked = Util.filter(players, function(report)
		return report.minutes >= 15
	end)
	table.sort(ranked, function(a, b)
		if a.rating ~= b.rating then
			return a.rating > b.rating
		end
		if a.goals ~= b.goals then
			return a.goals > b.goals
		end
		if a.assists ~= b.assists then
			return a.assists > b.assists
		end
		return a.playerId < b.playerId
	end)
	local motmId = ranked[1] and ranked[1].playerId or nil
	local key = Career.rivalryKey(cup.opponent)
	local old = career.rivals[key] or { opponent = cup.opponent, played = 0, wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, closeGames = 0, active = false, lastResults = {}, lastPlayedAt = 0 }
	local shootout = #cup.penaltyEvents > 0
	local draw = cup.homeScore == cup.awayScore and not shootout
	local won = cup.homeScore > cup.awayScore or (cup.homeScore == cup.awayScore and cup.penaltyHomeScore > cup.penaltyAwayScore)
	local derbyReward = old.active and (won and 400 or draw and 150 or 0) or 0
	local played = old.played + 1
	local closeGames = old.closeGames + (math.abs(cup.homeScore - cup.awayScore) <= 1 and 1 or 0)
	local active = old.active or (played >= 3 and closeGames >= 2) or played >= 5
	local resultLabel = ("%d:%d"):format(cup.homeScore, cup.awayScore) .. (shootout and (" (%d:%d i.E.)"):format(cup.penaltyHomeScore, cup.penaltyAwayScore) or "")
	local lastResults = table.clone(old.lastResults)
	table.insert(lastResults, resultLabel)
	career.rivals[key] = {
		opponent = old.opponent, played = played, closeGames = closeGames, active = active,
		wins = old.wins + (won and 1 or 0), draws = old.draws + (draw and 1 or 0), losses = old.losses + ((not won and not draw) and 1 or 0),
		goalsFor = old.goalsFor + cup.homeScore, goalsAgainst = old.goalsAgainst + cup.awayScore, lastResults = Util.tail(lastResults, 5), lastPlayedAt = now,
	}
	if active and not old.active then
		History.add(features, "Neue Rivalität: " .. cup.opponent, "Die Fans haben ihren Derbygegner gefunden. Künftige Derbys bringen bis zu 400 Fragmente.", "positive", now)
	end
	if old.active then
		History.add(features, won and "Derbysieg! Die Kurve eskaliert." or draw and "Derbyremis. Die Revanche wartet." or "Derbyniederlage. Das vergessen die Fans nicht.", resultLabel .. " gegen " .. cup.opponent .. (derbyReward > 0 and (" · +" .. derbyReward .. " Fragmente") or ""), won and "positive" or draw and "neutral" or "negative", now)
	end
	features.starXI.fragments += derbyReward
	for _, report in players do
		local player = Cards.get(report.playerId) :: Cards.Player
		career.players[report.playerId] = addStats(career.players[report.playerId], report, report.playerId == motmId)
		if cup.mode == "season" then
			career.seasonPlayers[report.playerId] = addStats(career.seasonPlayers[report.playerId], report, report.playerId == motmId)
		end
		if not table.find(career.collectedIds, report.playerId) then
			table.insert(career.collectedIds, report.playerId)
		end
		career.milestoneCategories[report.playerId] = career.milestoneCategories[report.playerId] or Career.category(player)
		for _, milestone in Career.playerMilestones(career, player) do
			local cards = career.milestoneCards[report.playerId] or {}
			if career.players[report.playerId][milestone.metric] >= milestone.target and not table.find(cards, milestone.id) then
				table.insert(cards, milestone.id)
				career.milestoneCards[report.playerId] = cards
				History.add(features, milestone.label .. "-Karte freigeschaltet", ("%s · %d %s. Die stärkste Version ist automatisch aktiv."):format(player.name, milestone.target, Career.METRIC_LABELS[milestone.metric]), "positive", now)
			end
		end
	end
	local events = {}
	for _, event in cup.matchEvents do
		table.insert(events, { id = event.id, minute = event.minute, label = "⚽ " .. Career.goalLabel(event, false) })
	end
	for _, event in cup.cardEvents do
		table.insert(events, { id = event.id, minute = event.minute, label = "🟥 " .. event.player .. " · " .. event.reason })
	end
	for _, event in cup.injuryEvents do
		table.insert(events, { id = event.id, minute = event.minute, label = "🩹 " .. event.player .. " · " .. event.reason })
	end
	for _, event in (cup.broadcast and cup.broadcast.events or {}) do
		if event.kind == "substitution" or event.kind == "yellow" then
			table.insert(events, { id = event.id, minute = event.minute, label = (event.kind == "yellow" and "🟨 " or "🔁 ") .. event.player })
		end
	end
	Util.stableSort(events, function(a, b)
		return a.minute < b.minute
	end)
	local Catalog = require(script.Parent.Data.Catalog) :: any
	local competition = nil
	if cup.mode == "season" then
		competition = "Saison " .. career.seasonNumber
	else
		for _, tournament in Catalog.tournaments do
			if tournament.id == cup.tournamentId then
				competition = tournament.label
			end
		end
	end
	table.insert(career.reports, {
		away = cup.fixture and cup.fixture.away, competition = competition,
		penaltyScore = shootout and ("%d:%d"):format(cup.penaltyHomeScore, cup.penaltyAwayScore) or nil,
		startingIds = table.clone(cup.originalLineupIds), benchIds = table.clone(cup.originalBenchIds), events = events,
		id = id, opponent = cup.opponent, homeScore = cup.homeScore, awayScore = cup.awayScore, mode = cup.mode, createdAt = now,
		motmId = motmId, derby = old.active, derbyReward = derbyReward, players = players,
	})
	career.reports = Util.tail(career.reports, 10)
	table.insert(career.processedMatchIds, id)
	career.processedMatchIds = Util.tail(career.processedMatchIds, 100)
	if cup.mode == "season" then
		career.seasonMatches += 1
		if seasonEntry and seasonEntry.completedSeason then
			local eligible = {}
			for playerId, stats in career.seasonPlayers do
				if stats.ratedMatches >= 3 and stats.minutes >= 90 then
					table.insert(eligible, { id = playerId, stats = stats })
				end
			end
			local function average(stats: any): number
				return stats.ratingTotal / math.max(1, stats.ratedMatches)
			end
			local scorers, jokers = {}, {}
			for playerId, stats in career.seasonPlayers do
				if stats.goals > 0 then
					table.insert(scorers, { id = playerId, stats = stats })
				end
				if stats.subAppearances >= 2 and stats.subMinutes >= 30 then
					table.insert(jokers, { id = playerId, stats = stats })
				end
			end
			table.insert(career.awards, {
				id = id, division = seasonEntry.division, seasonNumber = career.seasonNumber, matchesTracked = career.seasonMatches, createdAt = now,
				best = pickAward(eligible, average, function(stats)
					return ("Ø %s · %d× Spieler des Spiels"):format(Util.formatDecimal(average(stats), 2), stats.motm)
				end),
				scorer = pickAward(scorers, function(stats)
					return stats.goals
				end, function(stats)
					return stats.goals .. " Tore"
				end),
				joker = pickAward(jokers, function(stats)
					return stats.subRatingTotal / stats.subAppearances
				end, function(stats)
					return ("Ø %s · %d Einwechslungen"):format(Util.formatDecimal(stats.subRatingTotal / stats.subAppearances, 2), stats.subAppearances)
				end),
				disappointment = pickAward(Util.filter(eligible, function(entry)
					return average(entry.stats) < 6.5
				end), average, function(stats)
					return ("Ø %s · unter der Erwartung 6.5"):format(Util.formatDecimal(average(stats), 2))
				end, true),
			})
			career.awards = Util.tail(career.awards, 20)
			History.add(features, ("Saisonauszeichnungen · Saison %d"):format(career.seasonNumber), ("%d erfasste Ligaspiele. Die Gewinner stehen im Karrierebereich."):format(career.seasonMatches), "positive", now)
			career.seasonPlayers = {}
			career.seasonMatches = 0
			career.seasonNumber += 1
		end
	end
end

local albumDefinitions: { any }? = nil
local function definitions(): { any }
	if albumDefinitions then
		return albumDefinitions
	end
	local list = {
		{ id = "base", label = "Alle Basiskarten", reward = 10000, players = Util.filter(Cards.ALL, function(p)
			return string.sub(p.id, 1, 6) ~= "scrap-" and not p.isCustom and p.cardType ~= "icon" and p.cardType ~= "legendary"
		end) },
		{ id = "scrap", label = "Alle Schrottkarten", reward = 500, players = Cards.SCRAP },
		{ id = "icons", label = "Alle Icons", reward = 5000, players = Util.filter(Cards.ALL, function(p)
			return p.cardType == "icon"
		end) },
		{ id = "custom", label = "Alle Custom-Karten", reward = 5000, players = Cards.CUSTOM },
		{ id = "legendary", label = "Alle legendären Karten", reward = 5000, players = Util.filter(Cards.ALL, function(p)
			return p.cardType == "legendary"
		end) },
	}
	local codes = {}
	for _, player in Cards.ALL do
		if player.countryCode then
			codes[player.countryCode] = true
		end
	end
	for _, code in Util.keys(codes) do
		table.insert(list, { id = "nation-" .. code, label = "Nation " .. code, reward = 500, players = Util.filter(Cards.ALL, function(p)
			return p.countryCode == code
		end) })
	end
	albumDefinitions = Util.filter(list, function(definition)
		return #definition.players > 0
	end)
	return albumDefinitions :: { any }
end

function Career.albumGroups(career: any): { any }
	local owned, claimed = {}, {}
	for _, id in career.collectedIds do
		owned[id] = true
	end
	for _, id in career.claimedAlbumRewards do
		claimed[id] = true
	end
	return Util.map(definitions(), function(definition)
		local collected = 0
		for _, player in definition.players do
			if owned[player.id] then
				collected += 1
			end
		end
		return { id = definition.id, label = definition.label, total = #definition.players, collected = collected, reward = definition.reward, claimed = claimed[definition.id] == true }
	end)
end

local function syncCollected(features: any)
	features.career.collectedIds = Util.unique(Util.concat(features.career.collectedIds, features.starXI.ownedIds))
end

function Career.claimAlbum(features: any, groupId: string, now: number): boolean
	syncCollected(features)
	local group = Util.find(Career.albumGroups(features.career), function(item)
		return item.id == groupId
	end)
	if not group or group.claimed or group.collected < group.total then
		return false
	end
	table.insert(features.career.claimedAlbumRewards, group.id)
	features.starXI.fragments += group.reward
	History.add(features, "Sammelalbum: " .. group.label .. " komplett", ("+%d Fragmente. Einmalige Sammlungsprämie."):format(group.reward), "positive", now)
	return true
end

function Career.claimAllAlbums(features: any, now: number): number
	syncCollected(features)
	local available = Util.filter(Career.albumGroups(features.career), function(group)
		return not group.claimed and group.collected == group.total
	end)
	for _, group in available do
		Career.claimAlbum(features, group.id, now)
	end
	return #available
end

return Career
