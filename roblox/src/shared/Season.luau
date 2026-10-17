--!strict
-- League mode: 15 divisions, 6 team tables, 10 matchdays, promotion and Hall of Fame.
local Travel = require(script.Parent.Data.Travel) :: any
local Util = require(script.Parent.Util)

local Season = {}

Season.DIVISION_COUNT = 15
Season.MATCHES_PER_SEASON = 10
Season.TABLE_SIZE = 6
Season.HOME_VENUE_ID = Travel.home.id

local OPPONENT_COUNT = 5

function Season.divisionLabel(division: number): string
	local index = math.max(1, math.min(Season.DIVISION_COUNT, math.floor(tonumber(division) or 1)))
	return ("Liga %d · %s"):format(16 - index, Travel.leagueLabels[index] or Travel.leagueLabels[1])
end

-- Club in a division; index is 1 to 5.
function Season.club(division: number, index: number): any
	local d = math.max(1, math.min(15, math.floor(division)))
	local i = math.max(1, math.min(5, index))
	return Travel.seasonClubs[d][i]
end

local function opponentRating(division: number, index: number): number
	if division == 15 then
		return ({ 98, 92, 91, 96, 94 })[math.max(1, math.min(5, index))]
	end
	return Util.round(Util.clamp(40 + (math.max(1, division) - 1) * 3.4 + index * 1.5, 40, 99))
end

local function row(id: string, name: string, rating: number, clubId: string?, venueId: string?): any
	return { id = id, name = name, rating = rating, clubId = clubId, venueId = venueId, played = 0, wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, points = 0 }
end

function Season.createTable(division: number, clubName: string): { any }
	local tableRows = { row("club", clubName ~= "" and clubName or "FC Goal", 0, nil, Season.HOME_VENUE_ID) }
	for index = 1, OPPONENT_COUNT do
		local club = Season.club(division, index)
		table.insert(tableRows, row("season-opponent-" .. index, club.name, opponentRating(division, index), club.id, club.venueId))
	end
	return tableRows
end

function Season.findRow(tableRows: { any }, id: string): any
	return Util.find(tableRows, function(team)
		return team.id == id
	end)
end

function Season.sortTable(tableRows: { any }): { any }
	local sorted = table.clone(tableRows)
	table.sort(sorted, function(a, b)
		if a.points ~= b.points then
			return a.points > b.points
		end
		local diffA, diffB = a.goalsFor - a.goalsAgainst, b.goalsFor - b.goalsAgainst
		if diffA ~= diffB then
			return diffA > diffB
		end
		if a.goalsFor ~= b.goalsFor then
			return a.goalsFor > b.goalsFor
		end
		if a.id == "club" then
			return true
		end
		if b.id == "club" then
			return false
		end
		return a.name < b.name
	end)
	return sorted
end

function Season.backgroundPairings(day: number): { { string } }
	local teams = { "club", "season-opponent-5", "season-opponent-4", "season-opponent-3", "season-opponent-2", "season-opponent-1" }
	for _ = 1, day % 5 do
		local last = table.remove(teams) :: string
		table.insert(teams, 2, last)
	end
	return { { teams[2], teams[5] }, { teams[3], teams[4] } }
end

function Season.createFixtures(tableRows: { any }): { any }
	local fixtures = {}
	for day = 0, 9 do
		local opponent = Season.findRow(tableRows, "season-opponent-" .. (day % 5 + 1))
		local away = day % 2 == 1
		table.insert(fixtures, { opponentId = opponent.id, clubId = opponent.clubId or opponent.id, away = away, venueId = away and opponent.venueId or Season.HOME_VENUE_ID })
	end
	return fixtures
end

function Season.initial(clubName: string): any
	local tableRows = Season.createTable(1, clubName)
	return {
		fixtures = Season.createFixtures(tableRows),
		division = 1,
		highestDivision = 1,
		matchday = 0,
		table = tableRows,
		lastTable = Util.deepCopy(tableRows),
		lastResult = "Die Saison wartet auf ihren ersten Anpfiff.",
		lastMatchAt = 0,
		history = {},
		hallOfFame = false,
		prestigeCount = 0,
	}
end

function Season.nextOpponent(state: any): any
	local index = (state.matchday % (Season.TABLE_SIZE - 1)) + 1
	local opponent = Season.findRow(state.table, "season-opponent-" .. index) or state.table[2]
	local strategies = { "ballbesitz", "konter", "angriff" }
	return {
		id = opponent.id,
		name = opponent.name,
		rating = opponent.rating,
		strategyId = strategies[((index - 1) % 3) + 1],
	}
end

local function rollScore(strength: number, random: () -> number): number
	local expected = Util.clamp(0.55 + strength * 0.035, 0.2, 3.8)
	local score = 0
	for attempt = 0, 4 do
		local chance = Util.clamp(expected / (attempt + 2.2), 0.035, 0.84)
		if Util.bounded(random) < chance then
			score += 1
		end
	end
	return score
end

local function updateRow(team: any, goalsFor: number, goalsAgainst: number)
	local won = goalsFor > goalsAgainst
	local draw = goalsFor == goalsAgainst
	team.played += 1
	team.wins += won and 1 or 0
	team.draws += draw and 1 or 0
	team.losses += (not won and not draw) and 1 or 0
	team.goalsFor += goalsFor
	team.goalsAgainst += goalsAgainst
	team.points += won and 3 or draw and 1 or 0
end

-- Records a played league match, simulates the two background matches and handles season end.
function Season.recordMatch(stateIn: any, clubScore: number, opponentScore: number, clubName: string, now: number, random: () -> number, opponentId: string?): (any, any?)
	local state = Util.deepCopy(stateIn)
	if state.hallOfFame then
		return state, nil
	end
	local matchday = state.matchday + 1
	local nextOpponent = Season.nextOpponent(state)
	local opponent = (opponentId and Season.findRow(state.table, opponentId)) or Season.findRow(state.table, nextOpponent.id) or state.table[2]
	local own = math.max(0, math.min(20, math.floor(clubScore)))
	local other = math.max(0, math.min(20, math.floor(opponentScore)))
	local outcome = own > other and "win" or own == other and "draw" or "loss"
	local clubRow = Season.findRow(state.table, "club")
	clubRow.name = clubName ~= "" and clubName or clubRow.name
	updateRow(clubRow, own, other)
	updateRow(opponent, other, own)
	for _, pairing in Season.backgroundPairings(state.matchday) do
		local first, second = Season.findRow(state.table, pairing[1]), Season.findRow(state.table, pairing[2])
		local firstScore = rollScore(first.rating - second.rating + 1, random)
		local secondScore = rollScore(second.rating - first.rating - 1, random)
		updateRow(first, firstScore, secondScore)
		updateRow(second, secondScore, firstScore)
	end
	local lastTable = Season.sortTable(state.table)
	local completed = matchday >= Season.MATCHES_PER_SEASON
	local seasonOutcome = nil
	local nextDivision, highest, hallOfFame = state.division, state.highestDivision, false
	local lastResult = ("%d:%d gegen %s. %d von %d Saisonspielen gespielt."):format(own, other, opponent.name, matchday, Season.MATCHES_PER_SEASON)
	if completed then
		local position = Util.findIndex(lastTable, function(team)
			return team.id == "club"
		end)
		if state.division == Season.DIVISION_COUNT and position <= 2 then
			hallOfFame = true
			seasonOutcome = "hall-of-fame"
			lastResult = ("Hall of Fame erreicht. Dein Club beendet die Saison auf Platz %d."):format(position)
		elseif position <= 2 and state.division < Season.DIVISION_COUNT then
			seasonOutcome = "promoted"
			nextDivision = state.division + 1
			lastResult = ("Saison beendet: Platz %d und Aufstieg in Liga %d."):format(position, 16 - nextDivision)
		elseif position >= Season.TABLE_SIZE - 1 and state.division > 1 then
			seasonOutcome = "relegated"
			nextDivision = state.division - 1
			lastResult = ("Saison beendet: Platz %d und Abstieg in Liga %d."):format(position, 16 - nextDivision)
		else
			seasonOutcome = "stayed"
			lastResult = ("Saison beendet: Platz %d. Dein Club bleibt in %s."):format(position, Season.divisionLabel(state.division))
		end
		highest = math.max(highest, nextDivision)
	end
	local entry = {
		id = ("season-match-%d-%d"):format(now, matchday),
		division = state.division,
		matchday = matchday,
		opponent = opponent.name,
		opponentRating = opponent.rating,
		clubScore = own,
		opponentScore = other,
		outcome = outcome,
		completedSeason = completed,
		seasonOutcome = seasonOutcome,
		createdAt = now,
	}
	state.division = nextDivision
	state.highestDivision = highest
	state.matchday = completed and 0 or matchday
	if completed and not hallOfFame then
		state.table = Season.createTable(nextDivision, clubName)
		state.fixtures = Season.createFixtures(state.table)
	else
		state.table = lastTable
	end
	state.lastTable = Util.deepCopy(lastTable)
	state.lastResult = lastResult
	state.lastMatchAt = now
	table.insert(state.history, entry)
	state.history = Util.tail(state.history, 30)
	state.hallOfFame = hallOfFame
	return state, entry
end

function Season.startPrestige(stateIn: any, clubName: string, now: number): any
	local state = Util.deepCopy(stateIn)
	if not state.hallOfFame then
		return state
	end
	local fresh = Season.createTable(1, clubName)
	state.division = 1
	state.matchday = 0
	state.table = fresh
	state.fixtures = Season.createFixtures(fresh)
	state.lastTable = Util.deepCopy(fresh)
	state.lastResult = ("Prestige %d gestartet. Die Jagd auf die Hall of Fame beginnt von vorn."):format(state.prestigeCount + 1)
	state.lastMatchAt = now
	state.hallOfFame = false
	state.prestigeCount += 1
	return state
end

function Season.renameClub(state: any, clubName: string)
	for _, list in { state.table, state.lastTable } do
		for _, team in list do
			if team.id == "club" then
				team.name = clubName
			end
		end
	end
end

return Season
