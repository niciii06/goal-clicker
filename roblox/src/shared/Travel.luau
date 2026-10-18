--!strict
-- Away travel: door to door plans (bus, train, plane) precomputed from the web version,
-- travel time at 60x speed, small travel stories and statistics.
local Cup = require(script.Parent.Cup)
local Season = require(script.Parent.Season)
local TravelData = require(script.Parent.Data.Travel) :: any
local Util = require(script.Parent.Util)

local Travel = {}

Travel.HOME = TravelData.home
Travel.VENUES = TravelData.venues :: { [string]: any }
Travel.REGION_LABELS = TravelData.regionLabels :: { string }

local EVENTS = {
	{ id = "bundesrat", text = "Der Bundesrat hat den Teambus zugeparkt.", modes = { "bus" } },
	{ id = "pass", phase = "airport", text = "{player} hat den Reisepass vergessen.", modes = { "plane" } },
	{ id = "shortcut", text = "Der Busfahrer kennt eine Abkürzung.", modes = { "bus" } },
	{ id = "mikeboy", text = "{player} schläft im Gepäckfach.", modes = { "bus", "train", "plane" } },
	{ id = "olten", text = "Die Mannschaft nimmt versehentlich den Zug nach Olten.", modes = { "train" } },
	{ id = "pilot", text = "Der Pilot ist YB-Fan und gibt Vollgas.", modes = { "plane" } },
	{ id = "kebab", phase = "airport", text = "Die Mannschaft bestellt 47 Döner am Flughafen.", modes = { "plane" } },
	{ id = "walking", text = "Der Trainer hat Google Maps auf Fussweg gestellt.", modes = { "bus", "train" } },
	{ id = "var", phase = "airport", text = "Das Flughafenpersonal verlangt einen VAR-Check beim Boarding.", modes = { "plane" } },
	{ id = "ticket", text = "{player} diskutiert mit dem Kontrolleur über die Taktik.", modes = { "train" } },
	{ id = "green", text = "Alle Ampeln sind grün. Der Chauffeur fühlt sich wie ein Rennfahrer.", modes = { "bus" } },
	{ id = "snacks", text = "{player} hat sämtliche Snacks schon vor der Abfahrt gegessen.", modes = { "bus", "train", "plane" } },
	{ id = "express", text = "Der Lokführer erklärt den Zug spontan zum AZB-Express.", modes = { "train" } },
	{ id = "roadworks", text = "Eine Baustelle zwingt den Teambus auf eine kleine Umleitung.", modes = { "bus" } },
	{ id = "exit", text = "Der Chauffeur nimmt fast die falsche Ausfahrt. Der Trainer rettet die Route.", modes = { "bus" } },
	{ id = "playlist", text = "{player} verteidigt seine Playlist gegen den Rest der Mannschaft.", modes = { "bus", "train", "plane" } },
	{ id = "headphones", text = "{player} merkt, dass die Kopfhörer noch zuhause liegen.", modes = { "bus", "train", "plane" } },
	{ id = "crowded", text = "Der Zug ist voll. Die Mannschaft verteilt sich auf zwei Wagen.", modes = { "train" } },
	{ id = "platform", phase = "station", text = "Gleisänderung: Die Mannschaft wechselt rechtzeitig das Perron.", modes = { "train" } },
	{ id = "connection", phase = "station", text = "Der Anschlusszug wartet bereits. Alle finden ihren Wagen.", modes = { "train" } },
	{ id = "security", phase = "airport", text = "Bei der Sicherheitskontrolle bildet sich eine kurze Schlange.", modes = { "plane" } },
	{ id = "gate", phase = "airport", text = "Gateänderung: Die Mannschaft folgt der neuen Anzeige.", modes = { "plane" } },
	{ id = "baggage", phase = "airport", text = "{player} verwechselt kurz seine Tasche mit dem Materialkoffer.", modes = { "plane" } },
	{ id = "parking", phase = "arrival", text = "Der Ordner zeigt dem Teambus den richtigen Stadionparkplatz.", modes = { "bus", "train", "plane" } },
	{ id = "fans", phase = "arrival", text = "Ein paar Fans begrüssen die Mannschaft vor dem Stadion.", modes = { "bus", "train", "plane" } },
	{ id = "entrance", phase = "arrival", text = "Der Trainer findet nach kurzer Suche den Spielereingang.", modes = { "bus", "train", "plane" } },
}

function Travel.empty(): any
	return { journey = nil, stats = { recentEvents = {}, trips = 0, km = 0, countries = {}, furthest = nil, opponents = {} } }
end

function Travel.venue(id: string?): any
	if id == Travel.HOME.id then
		return Travel.HOME
	end
	return id and Travel.VENUES[id] or nil
end

-- The next fixture in league or tournament mode (venue, opponent, away flag).
function Travel.fixture(features: any, mode: string, tournamentId: string?): any
	if mode == "season" then
		local state = features.seasonMode
		local opponent = Season.nextOpponent(state)
		local saved = state.fixtures and state.fixtures[state.matchday + 1]
		local away = saved and saved.away or state.matchday % 2 == 1
		local opponentRow = Season.findRow(state.table, opponent.id)
		local venueId = away and ((saved and saved.venueId) or (opponentRow and opponentRow.venueId)) or Travel.HOME.id
		local last = state.history[#state.history]
		local id = ("season:%d:%d:%d:%d:%s"):format(state.prestigeCount, features.career.seasonNumber, state.division, state.matchday, last and last.id or "initial")
		local venue = Travel.venue(venueId) or Travel.HOME
		return { id = id, mode = mode, tournamentId = "stadium", opponentId = opponent.id, opponent = opponent.name, away = away, region = away and venue.region or 0, venueId = venue.id, schedule = {} }
	end
	local cup = features.cup
	local tournament = Cup.tournament(tournamentId) or Cup.TOURNAMENTS[1]
	local trophies = 0
	for _, count in cup.trophies do
		trophies += count
	end
	local id = ("cup:%s:%d:%d:%d"):format(tournament.id, cup.pendingNextRound and cup.matchStartedAt or cup.nextTournamentAt, cup.pendingNextRound and cup.round or 0, trophies)
	local previous = features.travel.journey and features.travel.journey.fixture
	local schedule
	if cup.pendingNextRound then
		schedule = cup.opponentIds
	elseif previous and previous.id == id then
		schedule = previous.schedule
	else
		schedule = Cup.opponentSchedule(tournament, Util.seededRandom(id))
	end
	local round = cup.pendingNextRound and cup.round or 0
	local opponent = Cup.opponentAt(tournament, round, schedule)
	local neutral = tournament.id == "world" and round == tournament.rounds - 1
	local venueId = neutral and TravelData.wembley or TravelData.tournamentVenues[opponent.id]
	local venue = Travel.venue(venueId)
	return { id = id, mode = mode, tournamentId = tournament.id, opponentId = opponent.id, opponent = opponent.name, away = true, neutral = neutral, region = neutral and venue.eliteRegion or venue.region, venueId = venueId, schedule = table.clone(schedule) }
end

function Travel.transportOf(venue: any): string
	local plane, train = false, false
	for _, segment in venue.plan.segments do
		plane = plane or segment.mode == "plane"
		train = train or segment.mode == "train"
	end
	return plane and "plane" or train and "train" or "bus"
end

function Travel.durationMs(venue: any): number
	return Util.round(venue.plan.realSeconds / venue.plan.acceleration * 1000)
end

-- Current segment of a journey for the progress display.
function Travel.segmentAt(venue: any, elapsedGameSeconds: number): any?
	local elapsed = math.max(0, elapsedGameSeconds) * venue.plan.acceleration
	local segments = venue.plan.segments
	for index, segment in segments do
		if elapsed < segment.realSeconds or index == #segments then
			return { segment = segment, index = index, fraction = math.max(0, math.min(1, elapsed / segment.realSeconds)), nextSegment = segments[index + 1] }
		end
		elapsed -= segment.realSeconds
	end
	return nil
end

-- speed > 1 shortens the journey (Schnellreise pass); the stages keep their proportions.
function Travel.createJourney(fixture: any, now: number, random: () -> number, eventPlayers: { any }, recentEvents: { string }, squadLock: any, speed: number?): any
	local venue = Travel.venue(fixture.venueId)
	local pace = math.max(1, speed or 1)
	local baseMs = Travel.durationMs(venue)
	local transport = Travel.transportOf(venue)
	local events = {}
	if random() < 0.5 then
		local count = (baseMs > 30000 and random() < 0.15) and 2 or 1
		for i = 1, count do
			local at = Util.round(baseMs * (i == 1 and 0.3 or 0.9))
			local stage = Travel.segmentAt(venue, at / 1000)
			local mode = transport
			local phase = nil
			if stage then
				if stage.segment.mode == "wait" then
					phase = transport == "plane" and "airport" or "station"
				else
					mode = stage.segment.mode
					if stage.index == #venue.plan.segments and stage.fraction > 0.6 then
						phase = "arrival"
					end
				end
			end
			local candidates = Util.filter(EVENTS, function(event)
				return table.find(event.modes, mode) ~= nil and (not event.phase or event.phase == phase)
					and (not string.find(event.text, "{player}", 1, true) or #eventPlayers > 0)
					and not Util.some(events, function(existing)
						return existing.id == event.id
					end)
			end)
			local fresh = Util.filter(candidates, function(event)
				return not table.find(recentEvents, event.id)
			end)
			local pool = #fresh > 0 and fresh or candidates
			if #pool > 0 then
				local event = pool[math.min(#pool, math.floor(random() * #pool) + 1)]
				local player = #eventPlayers > 0 and eventPlayers[math.min(#eventPlayers, math.floor(random() * #eventPlayers) + 1)] or nil
				table.insert(events, { id = event.id, playerId = player and player.id, text = Util.replaceAll(event.text, "{player}", player and player.name or "Die Mannschaft"), at = Util.round(at / pace) })
			end
		end
	end
	local durationMs = Util.round(baseMs / pace)
	return {
		squadLock = squadLock, id = fixture.id, fixture = fixture, startedAt = now, baseMs = durationMs, endsAt = now + durationMs, speed = pace,
		transport = transport, km = venue.km, events = events, consumed = false, counted = false,
	}
end

function Travel.view(journey: any, now: number): any
	local venue = Travel.venue(journey.fixture.venueId)
	local elapsed = math.max(0, now - journey.startedAt)
	local total = math.max(1, journey.endsAt - journey.startedAt)
	return {
		stage = venue and Travel.segmentAt(venue, elapsed * (journey.speed or 1) / 1000) or nil,
		arrived = now >= journey.endsAt,
		progress = math.max(0, math.min(1, elapsed / total)),
		remaining = math.max(0, journey.endsAt - now),
		events = Util.filter(journey.events, function(event)
			return elapsed >= event.at
		end),
	}
end

-- Counts a finished journey once in the travel statistics.
function Travel.settle(travel: any, now: number)
	local journey = travel.journey
	if not journey or journey.consumed or now < journey.endsAt or journey.counted then
		return
	end
	local stats = travel.stats
	for _, event in journey.events do
		table.insert(stats.recentEvents, event.id)
	end
	stats.recentEvents = Util.tail(stats.recentEvents, 8)
	stats.trips += 1
	stats.km += journey.km
	local venue = Travel.venue(journey.fixture.venueId)
	if venue and not table.find(stats.countries, venue.country) then
		table.insert(stats.countries, venue.country)
	end
	if not stats.furthest or journey.km > stats.furthest.km then
		stats.furthest = { opponent = journey.fixture.opponent, km = journey.km }
	end
	local key = journey.fixture.venueId .. ":" .. journey.fixture.opponent
	local entry = stats.opponents[key] or { name = journey.fixture.opponent, trips = 0 }
	stats.opponents[key] = { name = entry.name, trips = entry.trips + 1 }
	journey.counted = true
end

function Travel.transportLabel(transport: string): string
	return transport == "plane" and "Flugzeug" or transport == "train" and "Zug" or "Teambus"
end

return Travel
