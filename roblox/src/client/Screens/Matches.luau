--!nonstrict
-- Matches: league table, travel, tournaments, the live match with changes and penalties,
-- the post match report and the press conference.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Cards = require(Shared.Cards)
local Career = require(Shared.Career)
local Cup = require(Shared.Cup)
local MatchRatings = require(Shared.MatchRatings)
local Packs = require(Shared.Packs)
local Press = require(Shared.Press)
local Season = require(Shared.Season)
local StarXI = require(Shared.StarXI)
local Travel = require(Shared.Travel)
local Util = require(Shared.Util)
local Economy = require(Shared.Economy)

local Client = script.Parent.Parent
local MatchView = require(Client.MatchView)
local Net = require(Client.Net)
local State = require(Client.State)
local Theme = require(Client.Theme)
local UI = require(Client.UI)

local C = Theme.colors
local Matches = {}

Matches.sections = { "cup", "seasonMode", "travel", "press", "starXI", "career", "core", "club" }

local selectedTournament = "stadium"
local editing = false
local draft: any = nil
local draftSlot: number? = nil
local currentCtx: any = nil

local function features(): any
	return {
		cup = State.features("cup"), seasonMode = State.features("seasonMode"), travel = State.features("travel"),
		starXI = State.features("starXI"), career = State.features("career"), club = State.features("club"),
		transferSaga = State.features("transferSaga"), squadLock = State.features("squadLock"), press = State.features("press"),
	}
end

function Matches.signature(): string
	local f = features()
	local cup, travel = f.cup or {}, f.travel or {}
	local journey = travel.journey
	local core = State.core()
	return table.concat({
		tostring(cup.active), tostring(cup.phase), tostring(cup.matchPaused), tostring(cup.pendingNextRound), tostring(cup.nextTournamentAt),
		tostring(cup.careerMatchId), tostring(cup.penaltyHomeTaken), tostring(cup.penaltyAwayTaken), tostring(cup.substitutionsUsed),
		tostring(#(cup.sentOffPlayerIds or {})), tostring(#(cup.injuryEvents or {})),
		tostring(f.seasonMode and f.seasonMode.matchday), tostring(f.seasonMode and #f.seasonMode.history), tostring(f.seasonMode and f.seasonMode.hallOfFame),
		journey and (journey.id .. tostring(journey.consumed) .. tostring(State.now() >= journey.endsAt)) or "-",
		tostring(f.press and #f.press.answered), tostring(core.seasons), tostring(core.testMode),
		f.starXI and table.concat(f.starXI.lineupIds, ",") or "", tostring(editing), tostring(draftSlot), draft and table.concat(draft.lineup, ",") .. draft.strategy or "",
		selectedTournament, tostring(f.club and f.club.name),
	}, "|")
end

local function clubColor(): Color3
	local club = State.features("club")
	return Theme.color(club and club.color)
end

local function unlocked(unlockSeason: number): boolean
	local core = State.core()
	return core.testMode or math.min(15, math.max(1, (core.seasons or 0) + 1)) >= unlockSeason
end

------------------------------------------------------------------------------------------
-- Live match

local STRATEGY_OPTIONS = { { id = "angriff", label = "Pressing" }, { id = "konter", label = "Konter" }, { id = "ballbesitz", label = "Ballbesitz" } }

local function scoreboard(cup: any): Frame
	local club = State.features("club") or {}
	local minute = UI.label("", { size = 14, font = Theme.fonts.bold, color = C.goldLight, align = Enum.TextXAlignment.Center })
	UI.bind(minute, "Text", function()
		local liveCup = State.features("cup")
		local match = State.features("match")
		if not liveCup or not liveCup.active then
			return "ABPFIFF"
		end
		if liveCup.phase == "penalties" then
			return "ELFMETERSCHIESSEN"
		end
		local seconds = match and MatchView.gameTime() or 0
		local status = match and match.status
		local suffix = status == "halftime" and " · HALBZEIT" or status == "editing" and " · PAUSIERT" or (match and match.pauseRequested) and " · Spielzug läuft" or ""
		return ("%d′%s"):format(math.max(1, math.min(120, math.ceil(math.max(1, seconds) / 60))), suffix)
	end)
	local score = UI.label("", { size = 34, font = Theme.fonts.black, color = C.white, align = Enum.TextXAlignment.Center })
	UI.bind(score, "Text", function()
		local liveCup = State.features("cup") or cup
		local base = ("%d : %d"):format(liveCup.homeScore, liveCup.awayScore)
		if liveCup.phase == "penalties" then
			base ..= ("  (%d:%d i.E.)"):format(liveCup.penaltyHomeScore, liveCup.penaltyAwayScore)
		end
		return base
	end)
	local tournament = Cup.tournament(cup.tournamentId)
	local competition = cup.mode == "season" and "Saisonspiel" or ("%s · Runde %d"):format(tournament and tournament.label or "Turnier", cup.round + 1)
	return UI.box({ color = C.dark, padding = 14, gap = 4, radius = 16 }, {
		UI.label(Util.upper(competition) .. ((cup.fixture and cup.fixture.away) and " · AUSWÄRTS" or " · HEIM"), { size = 11, font = Theme.fonts.bold, color = C.faint, align = Enum.TextXAlignment.Center }),
		UI.columns({
			UI.label((club.badge or "⚽") .. " " .. (club.name or "Dein Club"), { size = 15, font = Theme.fonts.bold, color = C.white, align = Enum.TextXAlignment.Right }),
			score,
			UI.label(cup.opponent .. (" (%d)"):format(cup.opponentRating), { size = 15, font = Theme.fonts.bold, color = C.white, align = Enum.TextXAlignment.Left }),
		}, 8),
		minute,
	})
end

local function tickerLines(cup: any): { string }
	local lines = {}
	local events = {}
	for _, event in cup.matchEvents do
		table.insert(events, { minute = event.minute, text = ("⚽ %d′ %s %s"):format(event.minute, Career.goalLabel(event, false), event.side == "home" and "" or "(Gegner)") })
	end
	for _, event in cup.cardEvents do
		table.insert(events, { minute = event.minute, text = ("🟥 %d′ %s · %s"):format(event.minute, event.player, event.reason) })
	end
	for _, event in cup.injuryEvents do
		table.insert(events, { minute = event.minute, text = ("🩹 %d′ %s · %s"):format(event.minute, event.player, event.reason) })
	end
	for _, event in (cup.broadcast and cup.broadcast.events or {}) do
		if event.kind == "yellow" then
			table.insert(events, { minute = event.minute, text = ("🟨 %d′ %s"):format(event.minute, event.player) })
		elseif event.kind == "substitution" then
			local out = Cards.get(event.secondaryId or "")
			table.insert(events, { minute = event.minute, text = ("🔁 %d′ %s für %s"):format(event.minute, event.player, out and out.name or "?") })
		elseif event.kind == "shot" and event.side == "club" then
			table.insert(events, { minute = event.minute, text = ("🎯 %d′ %s · %s"):format(event.minute, event.player, event.outcome == "save" and "gehalten" or event.outcome == "wide" and "daneben" or "geblockt") })
		end
	end
	table.sort(events, function(a, b)
		return a.minute > b.minute
	end)
	for index = 1, math.min(14, #events) do
		table.insert(lines, events[index].text)
	end
	return lines
end

local function statsPanel(): Frame
	local text = UI.label("", { size = 13, color = C.text, font = Theme.fonts.mono })
	UI.bind(text, "Text", function()
		local cup = State.features("cup")
		local broadcast = cup and cup.broadcast
		if not broadcast then
			return "Noch keine Statistik."
		end
		local club, opponent = broadcast.clubStats, broadcast.opponentStats
		local total = math.max(1, club.possessionSeconds + opponent.possessionSeconds)
		local function row(label: string, a: number, b: number): string
			return ("%-14s %6s   %s"):format(label, tostring(a), tostring(b))
		end
		return table.concat({
			row("Ballbesitz %", Util.round(club.possessionSeconds / total * 100), Util.round(opponent.possessionSeconds / total * 100)),
			row("Schüsse", club.shots, opponent.shots),
			row("Aufs Tor", club.onTarget, opponent.onTarget),
			row("Paraden", club.saves, opponent.saves),
			row("Gelbe Karten", club.yellowCards, opponent.yellowCards),
		}, "\n")
	end)
	return UI.card({ UI.eyebrow("Statistik · Dein Club / Gegner"), text }, { padding = 12 })
end

local function tickerPanel(): Frame
	local text = UI.label("", { size = 13 })
	UI.bind(text, "Text", function()
		local cup = State.features("cup")
		if not cup then
			return ""
		end
		local lines = tickerLines(cup)
		return #lines > 0 and table.concat(lines, "\n") or "Anpfiff. Noch keine Höhepunkte."
	end)
	return UI.card({ UI.eyebrow("Liveticker"), text }, { padding = 12 })
end

local function ratingsPanel(cup: any): Frame
	local text = UI.label("", { size = 13, font = Theme.fonts.mono })
	UI.bind(text, "Text", function()
		local liveCup = State.features("cup")
		local starXI = State.features("starXI")
		if not liveCup or not starXI then
			return ""
		end
		local minute = math.max(1, math.ceil(math.max(1, MatchView.gameTime()) / 60))
		local lines = {}
		for slot, id in starXI.lineupIds do
			local player = Cards.get(id)
			if player then
				local rating = MatchRatings.cupPlayerRating(liveCup, id, minute)
				local fitness = liveCup.broadcast and liveCup.broadcast.fitness[id] or 100
				local status = table.find(liveCup.sentOffPlayerIds, id) and " 🟥" or (liveCup.injuredPlayerIds[id] and " 🩹" or "")
				table.insert(lines, ("%-4s %-20s %4s  %3d%%%s"):format(starXI.formationPositions[slot], string.sub(player.name, 1, 20), rating and Util.formatDecimal(rating, 1) or "-", Util.round(fitness), status))
			end
		end
		return table.concat(lines, "\n")
	end)
	return UI.card({ UI.eyebrow("Noten · Fitness"), text }, { padding = 12 })
end

local function draftEditor(cup: any): Frame
	local starXI = State.features("starXI")
	draft = draft or { lineup = table.clone(starXI.lineupIds), strategy = cup.strategyId }
	local children: { Instance? } = {
		UI.eyebrow("Wechsel / Taktik"),
		UI.label(("Wechsel: %d von %d gebraucht. Tippe einen Feldspieler, dann einen Bankspieler. Die Formation bleibt bestehen."):format(cup.substitutionsUsed, Cards.MAX_SUBSTITUTIONS), { size = 13, color = C.muted }),
		UI.segmented(STRATEGY_OPTIONS, draft.strategy, function(id)
			draft.strategy = id
			currentCtx.refresh()
		end),
	}
	for slot, id in draft.lineup do
		local player = Cards.get(id)
		local sentOff = table.find(cup.sentOffPlayerIds, starXI.lineupIds[slot]) ~= nil
		local changed = id ~= starXI.lineupIds[slot]
		table.insert(children, UI.button(("%s  %s%s"):format(starXI.formationPositions[slot], player and player.name or "leer", sentOff and "  🟥" or changed and "  🔁" or ""), {
			style = draftSlot == slot and "primary" or "secondary",
			height = 34,
			size = 13,
			disabled = sentOff,
			onClick = function()
				draftSlot = if draftSlot == slot then nil else slot
				currentCtx.refresh()
			end,
		}))
	end
	if draftSlot then
		table.insert(children, UI.eyebrow("Bank für " .. starXI.formationPositions[draftSlot]))
		for _, id in starXI.benchIds do
			local player = Cards.get(id)
			if player and not table.find(draft.lineup, id) then
				local fits = Cards.canFillSlot(id, draftSlot, starXI.formationPositions)
				local unavailable = cup.playerExitedAt[id] ~= nil or table.find(cup.sentOffPlayerIds, id) ~= nil or (cup.injuredPlayerIds[id] or 0) > 0
				table.insert(children, UI.button(("%d  %s · %s"):format(player.rating, player.name, Cards.positionLabel(player, true)), {
					style = "ghost", height = 34, size = 13, disabled = not fits or unavailable,
					onClick = function()
						draft.lineup[draftSlot :: number] = id
						draftSlot = nil
						currentCtx.refresh()
					end,
				}))
			end
		end
		table.insert(children, UI.button("Ursprünglichen Spieler zurück", { style = "secondary", height = 32, size = 13, onClick = function()
			draft.lineup[draftSlot :: number] = starXI.lineupIds[draftSlot :: number]
			draftSlot = nil
			currentCtx.refresh()
		end }))
	end
	table.insert(children, UI.columns({
		UI.button("Bestätigen & weiter", { style = "success", onClick = function()
			local ok = Net.action("confirmDraft", { lineup = draft.lineup, strategy = draft.strategy })
			if ok then
				editing, draft, draftSlot = false, nil, nil
				currentCtx.refresh()
			end
		end }),
		UI.button("Abbrechen", { style = "secondary", onClick = function()
			editing, draft, draftSlot = false, nil, nil
			Net.action("resumeMatch", nil, true)
			currentCtx.refresh()
		end }),
	}, 8))
	return UI.card(children, { gap = 6, stroke = true, strokeColor = C.accent })
end

local function penaltyPanel(cup: any): Frame
	local homeTurn = cup.penaltyTurn == "home"
	local marks = { home = {}, away = {} }
	for _, event in cup.penaltyEvents do
		table.insert(marks[event.side], event.outcome == "goal" and "🟢" or "🔴")
	end
	local buttons = {}
	for _, option in { { "left", "← Links" }, { "center", "↑ Mitte" }, { "right", "Rechts →" } } do
		table.insert(buttons, UI.button(option[2], { height = 54, onClick = function()
			Net.action("penalty", { direction = option[1] }, true)
		end }))
	end
	return UI.card({
		UI.eyebrow("Elfmeterschiessen" .. ((cup.penaltyHomeTaken >= 5 and cup.penaltyAwayTaken >= 5) and " · Sudden Death" or "")),
		UI.title(("%d : %d"):format(cup.penaltyHomeScore, cup.penaltyAwayScore), 30),
		UI.label("Dein Club   " .. table.concat(marks.home, " "), { size = 15 }),
		UI.label("Gegner      " .. table.concat(marks.away, " "), { size = 15 }),
		UI.label(cup.penaltyMessage ~= "" and cup.penaltyMessage or "Du beginnst am Punkt.", { size = 14, color = C.muted }),
		UI.label(homeTurn and "Dein Schuss: Wähle die Ecke." or "Dein Torwart: Wähle die Ecke für den Hechtsprung.", { size = 15, font = Theme.fonts.bold }),
		UI.columns(buttons, 8),
	}, { stroke = true, strokeColor = C.gold })
end

local function liveMatch(container: Frame, cup: any, ctx: any)
	scoreboard(cup).Parent = container
	local match = State.features("match")
	if cup.phase == "penalties" then
		penaltyPanel(cup).Parent = container
	elseif match then
		local pitchCard = UI.card({ MatchView.pitch(clubColor()) }, { padding = 8 })
		pitchCard.Parent = container
		local controls = {}
		if cup.matchPaused then
			if editing then
				draftEditor(cup).Parent = container
			else
				local injury = cup.lastInjury
				UI.card({
					UI.eyebrow(match.status == "halftime" and "Halbzeitpause" or "Spiel pausiert"),
					UI.label(cup.lastResult or "", { size = 14 }),
					injury and UI.label(("🩹 %s fällt %d %s aus."):format(injury.player, injury.matches, injury.matches == 1 and "Spiel" or "Spiele"), { size = 14, color = C.red }) or nil,
				}, { color = C.cardAlt }).Parent = container
				table.insert(controls, UI.button("Weiterspielen", { style = "success", onClick = function()
					Net.action("resumeMatch", nil, true)
				end }))
				table.insert(controls, UI.button("Wechsel / Taktik", { style = "secondary", onClick = function()
					editing = true
					draft = nil
					ctx.refresh()
				end }))
			end
		else
			table.insert(controls, UI.button(match.pauseRequested and "Spielzug wird abgeschlossen …" or "Wechsel / Taktik", { style = "secondary", disabled = match.pauseRequested, onClick = function()
				editing = true
				draft = nil
				Net.action("editMatch", nil, true)
			end }))
		end
		table.insert(controls, UI.button(MatchView.is3D() and "2D Ansicht" or "3D im Stadion", { style = "dark", onClick = function()
			if MatchView.is3D() then
				MatchView.stop3D()
				ctx.hidePanel(false)
			else
				MatchView.start3D(clubColor())
				ctx.hidePanel(true)
			end
		end }))
		if #controls > 0 then
			UI.columns(controls, 8).Parent = container
		end
	end
	local phone = ctx.isPhone()
	local left = UI.box({ gap = 12, width = phone and UDim.new(1, 0) or UDim.new(0.5, -6) }, { tickerPanel(), statsPanel() })
	local right = UI.box({ gap = 12, width = phone and UDim.new(1, 0) or UDim.new(0.5, -6) }, { ratingsPanel(cup) })
	UI.box({ direction = Enum.FillDirection.Horizontal, gap = 12, wraps = true }, { left, right }).Parent = container
end

------------------------------------------------------------------------------------------
-- Between matches

local function lastReport(): any?
	local career = State.features("career")
	return career and career.reports[#career.reports]
end

local function postMatch(cup: any): Frame?
	local report = lastReport()
	if not report or cup.matchStartedAt == 0 then
		return nil
	end
	local motm = report.motmId and Cards.get(report.motmId)
	local rows = {}
	local players = table.clone(report.players)
	table.sort(players, function(a, b)
		return a.rating > b.rating
	end)
	for index = 1, math.min(6, #players) do
		local entry = players[index]
		local player = Cards.get(entry.playerId)
		if player then
			table.insert(rows, UI.label(("%s  %s%s%s"):format(Util.formatDecimal(entry.rating, 1), player.name, entry.goals > 0 and ("  ⚽×" .. entry.goals) or "", entry.assists > 0 and ("  🅰×" .. entry.assists) or ""), { size = 13 }))
		end
	end
	local children: { Instance? } = {
		UI.eyebrow("Spielbericht · " .. (report.competition or "")),
		UI.title(("%d:%d gegen %s%s"):format(report.homeScore, report.awayScore, report.opponent, report.penaltyScore and (" · " .. report.penaltyScore .. " i.E.") or ""), 22),
		UI.label(cup.lastResult or "", { size = 14, color = C.muted }),
		motm and UI.label("⭐ Spieler des Spiels: " .. motm.name, { size = 14, font = Theme.fonts.bold, color = C.gold }) or nil,
		report.derby and UI.pill(("DERBY · +%d Fragmente"):format(report.derbyReward), C.orange, C.white) or nil,
	}
	for _, row in rows do
		table.insert(children, row)
	end
	return UI.card(children)
end

local function pressPanel(cup: any): Frame?
	local f = features()
	local conference = Press.conference(f.press, cup, f.club and f.club.name or "")
	if not conference then
		return nil
	end
	local core = State.core()
	local reward = Press.reward(core.passivePower or 0, core.clickPower or 1)
	local children: { Instance? } = {
		UI.eyebrow(("Pressekonferenz · Fanstimmung %d (%s)"):format(f.press.fanMood, Press.moodLabel(f.press.fanMood))),
		UI.title("«" .. conference.text .. "»", 18),
		UI.label(("Jede Antwort bringt etwa %s Tore Medienprämie und verändert die Fanstimmung."):format(Util.formatNumber(reward)), { size = 12, color = C.muted }),
	}
	for _, answer in conference.answers do
		table.insert(children, UI.button(answer.text, { style = "ghost", height = 52, size = 13, onClick = function()
			Net.action("answerPress", { matchId = conference.matchId, questionId = conference.questionId, answer = answer.index })
		end }))
	end
	return UI.card(children)
end

local function squadStatus(): Frame
	local f = features()
	local starXI = f.starXI
	local cup = f.cup
	local rating = StarXI.rating(starXI.ownedIds, starXI.lineupIds)
	local starters = #StarXI.selection(starXI.ownedIds, starXI.lineupIds)
	local warnings: { Instance? } = {}
	for _, id in cup.suspendedPlayerIds do
		local player = Cards.get(id)
		if player then
			table.insert(warnings, UI.label("🟥 " .. player.name .. " ist für die nächste Partie gesperrt.", { size = 13, color = C.red }))
		end
	end
	for id, matches in cup.injuredPlayerIds do
		local player = Cards.get(id)
		if player and matches > 0 then
			table.insert(warnings, UI.label(("🩹 %s fällt noch %d %s aus."):format(player.name, matches, matches == 1 and "Spiel" or "Spiele"), { size = 13, color = C.red }))
		end
	end
	local children: { Instance? } = {
		UI.columns({
			UI.box({ color = C.cardAlt, padding = 10 }, { UI.eyebrow("Star XI Rating"), UI.label(tostring(rating), { size = 26, font = Theme.fonts.black }) }),
			UI.box({ color = C.cardAlt, padding = 10 }, { UI.eyebrow("Startelf"), UI.label(starters .. " / 11", { size = 26, font = Theme.fonts.black, color = starters == 11 and C.green or C.red }) }),
		}, 8),
	}
	for _, warning in warnings do
		table.insert(children, warning)
	end
	if starters < 11 then
		table.insert(children, UI.button("Zum Kader", { style = "secondary", onClick = function()
			currentCtx.navigate("squad")
		end }))
	end
	return UI.card(children)
end

local function journeyPanel(): Frame?
	local travel = State.features("travel")
	local journey = travel and travel.journey
	if not journey or journey.consumed then
		return nil
	end
	local venue = Travel.venue(journey.fixture.venueId) or Travel.HOME
	local progress = UI.progress(0, C.accent, 10)
	local fill = progress:FindFirstChild("Fill") :: Frame
	UI.bind(fill, "Size", function()
		return UDim2.fromScale(Travel.view(journey, State.now()).progress, 1)
	end)
	local status = UI.label("", { size = 14, font = Theme.fonts.bold })
	UI.bind(status, "Text", function()
		local view = Travel.view(journey, State.now())
		if view.arrived then
			return "✅ Angekommen in " .. venue.city .. ". Das Spiel kann starten."
		end
		local stage = view.stage
		return ("%s · noch %s"):format(stage and stage.segment.label or Travel.transportLabel(journey.transport), Util.formatCountdown(journey.endsAt, State.now()))
	end)
	local events = UI.label("", { size = 13, color = C.muted })
	UI.bind(events, "Text", function()
		local view = Travel.view(journey, State.now())
		local lines = {}
		for _, event in view.events do
			table.insert(lines, "• " .. event.text)
		end
		return table.concat(lines, "\n")
	end)
	local arrived = State.now() >= journey.endsAt
	return UI.card({
		UI.eyebrow(("Auswärtsreise · %s · %s km"):format(Travel.transportLabel(journey.transport), Util.formatInteger(venue.km))),
		UI.title(("%s · %s"):format(journey.fixture.opponent, venue.stadium), 20),
		UI.label(venue.city .. ", " .. venue.country .. " · " .. Travel.REGION_LABELS[(journey.fixture.region or 0) + 1], { size = 13, color = C.muted }),
		progress,
		status,
		events,
		arrived and UI.button("Match starten", { style = "success", onClick = function()
			Net.action("startMatch", { mode = journey.fixture.mode, tournamentId = journey.fixture.tournamentId })
		end }) or nil,
	}, { stroke = true, strokeColor = C.accent })
end

local function startLabel(mode: string, tournamentId: string): string
	local f = features()
	local fixture = Travel.fixture(f, mode, tournamentId)
	if not fixture.away then
		return "Match starten"
	end
	local journey = f.travel.journey
	if not journey or journey.fixture.id ~= fixture.id or journey.consumed then
		return "Reise antreten"
	end
	return State.now() >= journey.endsAt and "Match starten" or "Reise läuft …"
end

local function seasonPanel(ctx: any): Frame
	local state = State.features("seasonMode")
	local opponent = Season.nextOpponent(state)
	local f = features()
	local fixture = Travel.fixture(f, "season", "stadium")
	local venue = Travel.venue(fixture.venueId) or Travel.HOME
	local sorted = Season.sortTable(state.table)
	local rows: { Instance? } = {}
	for index, team in sorted do
		local diff = team.goalsFor - team.goalsAgainst
		local highlight = index <= 2 and C.green or index >= 5 and state.division > 1 and C.red or C.muted
		table.insert(rows, UI.box({ direction = Enum.FillDirection.Horizontal, gap = 4, color = team.id == "club" and C.cardAlt or nil, padding = 4, radius = 8 }, {
			UI.label(tostring(index), { size = 13, font = Theme.fonts.black, color = highlight, width = UDim.new(0, 20) }),
			UI.label(team.name, { size = 13, font = team.id == "club" and Theme.fonts.black or Theme.fonts.medium, width = UDim.new(1, -168) }),
			UI.label(("%d · %d-%d-%d"):format(team.played, team.wins, team.draws, team.losses), { size = 12, color = C.muted, width = UDim.new(0, 72) }),
			UI.label((diff > 0 and "+" or "") .. diff, { size = 12, color = diff > 0 and C.green or diff < 0 and C.red or C.muted, width = UDim.new(0, 30) }),
			UI.label(tostring(team.points), { size = 13, font = Theme.fonts.black, width = UDim.new(0, 26), align = Enum.TextXAlignment.Right }),
		}))
	end
	local children: { Instance? } = {
		UI.eyebrow(("Saisonmodus · Spieltag %d / 10 · Prestige %d"):format(state.matchday + 1, state.prestigeCount)),
		UI.title(Season.divisionLabel(state.division), 20),
		UI.label(state.lastResult, { size = 13, color = C.muted }),
	}
	for _, row in rows do
		table.insert(children, row)
	end
	if state.hallOfFame then
		table.insert(children, UI.label("🏆 Hall of Fame erreicht. Starte Prestige für die nächste Jagd (+2 Saisonsterne).", { size = 14, font = Theme.fonts.bold, color = C.gold }))
		table.insert(children, UI.button("Prestige starten", { style = "gold", onClick = function()
			Net.action("prestige")
		end }))
	else
		local rival = f.career and f.career.rivals[Career.rivalryKey(opponent.name)]
		table.insert(children, UI.box({ color = C.cardAlt, padding = 10, gap = 2 }, {
			UI.eyebrow(fixture.away and "Nächstes Spiel · Auswärts" or "Nächstes Spiel · Heim"),
			UI.label(("%s (%d OVR)"):format(opponent.name, opponent.rating), { size = 16, font = Theme.fonts.black }),
			UI.label(("%s · %s%s"):format(venue.stadium, venue.city, fixture.away and (" · " .. Util.formatInteger(venue.km) .. " km") or ""), { size = 12, color = C.muted }),
			(rival and rival.active) and UI.label(("🔥 Derby · %d Siege · %d Remis · %d Niederlagen"):format(rival.wins, rival.draws, rival.losses), { size = 12, color = C.orange, font = Theme.fonts.bold }) or nil,
		}))
		table.insert(children, UI.button(startLabel("season", "stadium"), { style = "primary", height = 46, onClick = function()
			Net.action("startMatch", { mode = "season" })
		end }))
	end
	return UI.card(children, { gap = 6 })
end

local function tournamentPanel(): Frame
	local cup = State.features("cup")
	local starXI = State.features("starXI")
	local rating = StarXI.rating(starXI.ownedIds, starXI.lineupIds)
	if cup.pendingNextRound then
		selectedTournament = cup.tournamentId
	end
	local options = {}
	for _, tournament in Cup.TOURNAMENTS do
		table.insert(options, { id = tournament.id, label = tournament.label })
	end
	local tournament = Cup.tournament(selectedTournament) or Cup.TOURNAMENTS[1]
	local isUnlocked = unlocked(tournament.unlockSeason or 1)
	local cooldown = UI.label("", { size = 13, color = C.muted })
	UI.bind(cooldown, "Text", function()
		local liveCup = State.features("cup")
		if liveCup.pendingNextRound then
			return ("Runde %d von %d wartet. Passe die Aufstellung an und starte manuell."):format(liveCup.round + 1, tournament.rounds)
		end
		if liveCup.nextTournamentAt > State.now() then
			return "Neues Turnier in " .. Util.formatCountdown(liveCup.nextTournamentAt, State.now())
		end
		return "Bereit für den Anpfiff."
	end)
	local reward = Packs.tournamentRewardPack(tournament.id)
	local boost = Economy.GOAL_BOOST_MULTIPLIERS[tournament.id]
	return UI.card({
		UI.eyebrow("Turniere · Trophäen " .. (cup.trophies.stadium + cup.trophies.champions + cup.trophies.world)),
		cup.pendingNextRound and UI.pill("LAUFENDES TURNIER", C.accent, C.white) or UI.segmented(options, selectedTournament, function(id)
			selectedTournament = id
			currentCtx.refresh()
		end, 12),
		UI.title(tournament.trophyIcon .. " " .. tournament.label, 22),
		UI.label(tournament.description, { size = 13, color = C.muted }),
		UI.row({
			UI.pill(("Min. %d OVR"):format(tournament.minimumRating), rating >= tournament.minimumRating and C.green or C.red, C.white),
			UI.pill(("%d Runden"):format(tournament.rounds), C.cardAlt),
			UI.pill(("Gewonnen: %d×"):format(cup.trophies[tournament.id] or 0), C.cardAlt),
		}, 6, nil, true),
		UI.label(("Siegprämie: %s und %s× Goalboost für 3 Minuten."):format(reward.label, Util.formatDecimal(boost, boost % 1 == 0 and 0 or 1)), { size = 13 }),
		cooldown,
		isUnlocked and UI.button(startLabel("tournament", tournament.id), { style = "primary", height = 46, onClick = function()
			Net.action("startMatch", { mode = "tournament", tournamentId = tournament.id })
		end }) or UI.button(("Freischaltung in Saison %d"):format(tournament.unlockSeason), { style = "secondary", disabled = true }),
	}, { gap = 8 })
end

function Matches.render(container: Frame, ctx: any)
	currentCtx = ctx
	local cup = State.features("cup")
	if not cup or not State.features("seasonMode") then
		return
	end
	if cup.active then
		liveMatch(container, cup, ctx)
		return
	end
	editing, draft, draftSlot = false, nil, nil
	if MatchView.is3D() then
		MatchView.stop3D()
		ctx.hidePanel(false)
	end
	local report = postMatch(cup)
	if report then
		report.Parent = container
	end
	local press = pressPanel(cup)
	if press then
		press.Parent = container
	end
	local journey = journeyPanel()
	if journey then
		journey.Parent = container
	end
	local phone = ctx.isPhone()
	local left = UI.box({ gap = 12, width = phone and UDim.new(1, 0) or UDim.new(0.5, -6) }, { squadStatus(), seasonPanel(ctx) })
	local right = UI.box({ gap = 12, width = phone and UDim.new(1, 0) or UDim.new(0.5, -6) }, { tournamentPanel() })
	UI.box({ direction = Enum.FillDirection.Horizontal, gap = 12, wraps = true }, { left, right }).Parent = container
end

return Matches
