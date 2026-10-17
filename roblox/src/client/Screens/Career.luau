--!nonstrict
-- Career: player form and stats, milestone cards, season awards, rivalries,
-- the match archive and travel statistics.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Cards = require(Shared.Cards)
local CareerLogic = require(Shared.Career)
local Util = require(Shared.Util)

local Client = script.Parent.Parent
local State = require(Client.State)
local Theme = require(Client.Theme)
local UI = require(Client.UI)

local C = Theme.colors
local Career = {}

Career.sections = { "career", "starXI", "travel" }

local search = ""
local sort = "rating"
local selectedPlayer: string? = nil
local openReport: string? = nil
local listLimit = 30
local currentCtx: any = nil

function Career.signature(): string
	local career = State.features("career") or {}
	return table.concat({ tostring(#(career.reports or {})), tostring(#(career.awards or {})), tostring(#(career.processedMatchIds or {})), search, sort, tostring(selectedPlayer), tostring(openReport), tostring(listLimit), tostring(#((State.features("starXI") or {}).ownedIds or {})) }, "|")
end

local function signed(value: number): string
	return (value >= 0 and "+" or "") .. Util.formatDecimal(value, 1)
end

local function name(id: string): string
	local player = Cards.get(id)
	return player and player.name or "Unbekannter Spieler"
end

local function formSection(career: any, starXI: any): Frame
	local ids = Util.unique(Util.concat(starXI.ownedIds, Util.keys(career.players)))
	local players = {}
	local query = Util.lower(search)
	for _, id in ids do
		local player = Cards.get(id)
		if player and (query == "" or string.find(Util.lower(player.name), query, 1, true)) then
			table.insert(players, player)
		end
	end
	local function stat(player: Cards.Player): any
		return career.players[player.id] or CareerLogic.emptyStats()
	end
	table.sort(players, function(a, b)
		local sa, sb = stat(a), stat(b)
		local va, vb
		if sort == "rating" then
			va, vb = CareerLogic.card(career, a).rating, CareerLogic.card(career, b).rating
		elseif sort == "form" then
			va, vb = CareerLogic.form(career, a.id).bonus, CareerLogic.form(career, b.id).bonus
		elseif sort == "goals" then
			va, vb = sa.goals, sb.goals
		elseif sort == "appearances" then
			va, vb = sa.appearances, sb.appearances
		elseif sort == "average" then
			va, vb = sa.ratedMatches > 0 and sa.ratingTotal / sa.ratedMatches or 0, sb.ratedMatches > 0 and sb.ratingTotal / sb.ratedMatches or 0
		else
			return a.name < b.name
		end
		if va ~= vb then
			return va > vb
		end
		return a.name < b.name
	end)
	local searchBox = UI.input("Spieler suchen …", search)
	searchBox.FocusLost:Connect(function()
		search = searchBox.Text
		currentCtx.refresh()
	end)
	local children: { Instance? } = {
		UI.eyebrow("Karriere / Spielerform · letzte 5 Spiele"),
		UI.title("Deine Spieler entwickeln Geschichte.", 20),
		UI.label("Form entsteht aus den letzten fünf Einsätzen mit mindestens 15 Minuten und gibt maximal ±2 OVR. Spezialkarten sind dauerhaft.", { size = 13, color = C.muted }),
		searchBox,
		UI.segmented({ { id = "rating", label = "OVR" }, { id = "form", label = "Form" }, { id = "average", label = "Note" }, { id = "goals", label = "Tore" }, { id = "appearances", label = "Spiele" }, { id = "name", label = "A–Z" } }, sort, function(id)
			sort = id
			currentCtx.refresh()
		end, 11),
	}
	for index = 1, math.min(listLimit, #players) do
		local player = players[index]
		local s = stat(player)
		local form = CareerLogic.form(career, player.id)
		local card = CareerLogic.card(career, player)
		local average = s.ratedMatches > 0 and Util.formatDecimal(s.ratingTotal / s.ratedMatches, 2) or "-"
		table.insert(children, UI.button("", {
			style = selectedPlayer == player.id and "dark" or "ghost", height = 44, size = 12,
			onClick = function()
				selectedPlayer = player.id
				currentCtx.refresh()
			end,
		}))
		local button = children[#children] :: TextButton
		button.Text = ("%d%s  %s · %s · %d Sp · %d Tore · Ø %s%s"):format(card.rating, card.milestone and "★" or "", player.name, form.matches > 0 and (form.label .. " " .. signed(form.bonus)) or "neu", s.appearances, s.goals, average, s.motm > 0 and (" · " .. s.motm .. "× MOTM") or "")
		button.TextXAlignment = Enum.TextXAlignment.Left
	end
	if #players > listLimit then
		table.insert(children, UI.button(("Mehr anzeigen (%d weitere)"):format(#players - listLimit), { style = "secondary", height = 34, onClick = function()
			listLimit += 30
			currentCtx.refresh()
		end }))
	end
	return UI.card(children, { gap = 6 })
end

local function milestoneSection(career: any, starXI: any): Frame?
	local id = selectedPlayer or starXI.lineupIds[1] or starXI.ownedIds[1]
	local player = id and Cards.get(id)
	if not player then
		return nil
	end
	local stats = career.players[player.id] or CareerLogic.emptyStats()
	local unlocked = career.milestoneCards[player.id] or {}
	local card = CareerLogic.card(career, player)
	local children: { Instance? } = {
		UI.eyebrow("Meilensteine / Spezialkarten"),
		UI.title(player.name, 20),
		UI.label(("%s · Basis %d · aktiv %d OVR%s"):format(Cards.positionLabel(player), player.rating, card.rating, card.milestone and (" · ★ " .. card.milestone.label) or ""), { size = 13, color = C.muted }),
	}
	for _, milestone in CareerLogic.playerMilestones(career, player) do
		local value = stats[milestone.metric] or 0
		local done = table.find(unlocked, milestone.id) ~= nil
		table.insert(children, UI.box({ color = C.cardAlt, padding = 8, gap = 4, radius = 10 }, {
			UI.label(("%s%s · +%d OVR"):format(done and "✅ " or "", milestone.label, milestone.bonus), { size = 13, font = Theme.fonts.bold }),
			UI.label(("%d / %d %s"):format(math.min(value, milestone.target), milestone.target, CareerLogic.METRIC_LABELS[milestone.metric]), { size = 12, color = C.muted }),
			UI.progress(value / milestone.target, done and C.green or Theme.color(milestone.accent), 6),
		}))
	end
	return UI.card(children, { gap = 6 })
end

local function awardSection(career: any): Frame
	local awards = career.awards
	local latest = awards[#awards]
	local children: { Instance? } = { UI.eyebrow("Saisonabschluss / Auszeichnungen") }
	if not latest then
		table.insert(children, UI.label("Die Bühne wartet auf ihre Stars. Nach dem 10. Ligaspiel werden die Besten ausgezeichnet.", { size = 13, color = C.muted }))
	else
		table.insert(children, UI.title(("Saison %d · Liga %d"):format(latest.seasonNumber, 16 - latest.division), 18))
		for _, entry in { { "🏆 Bester Spieler", latest.best }, { "⚽ Torschützenkönig", latest.scorer }, { "🃏 Joker", latest.joker }, { "😬 Enttäuschung", latest.disappointment } } do
			local winner = entry[2]
			table.insert(children, UI.label(("%s: %s%s"):format(entry[1], winner and name(winner.playerId) or "Kein Gewinner", winner and (" · " .. winner.value) or ""), { size = 13 }))
		end
	end
	return UI.card(children, { gap = 6 })
end

local function rivalSection(career: any): Frame
	local rivals = {}
	for _, rival in career.rivals do
		table.insert(rivals, rival)
	end
	table.sort(rivals, function(a, b)
		if a.active ~= b.active then
			return a.active
		end
		if a.played ~= b.played then
			return a.played > b.played
		end
		return a.lastPlayedAt > b.lastPlayedAt
	end)
	local children: { Instance? } = {
		UI.eyebrow("Rivalitäten / direkte Bilanz"),
		UI.label("Eine Rivalität entsteht nach drei Duellen mit mindestens zwei knappen Spielen oder nach fünf Duellen. Derbysieg: 400 Fragmente, Remis: 150.", { size = 12, color = C.muted }),
	}
	for index = 1, math.min(10, #rivals) do
		local rival = rivals[index]
		table.insert(children, UI.label(("%s%s · %d-%d-%d · %d:%d · %s"):format(rival.active and "🔥 " or "", rival.opponent, rival.wins, rival.draws, rival.losses, rival.goalsFor, rival.goalsAgainst, table.concat(rival.lastResults, ", ")), { size = 13 }))
	end
	if #rivals == 0 then
		table.insert(children, UI.label("Noch keine Duelle.", { size = 13, color = C.muted }))
	end
	return UI.card(children, { gap = 6 })
end

local function archiveSection(career: any): Frame
	local children: { Instance? } = { UI.eyebrow(("Matcharchiv · %d / 10"):format(#career.reports)) }
	if #career.reports == 0 then
		table.insert(children, UI.label("Nach dem ersten Abpfiff erscheinen hier deine Matchberichte.", { size = 13, color = C.muted }))
	end
	for index = #career.reports, 1, -1 do
		local report = career.reports[index]
		local result = report.homeScore > report.awayScore and "Sieg" or report.homeScore < report.awayScore and "Niederlage" or report.penaltyScore and "i.E." or "Remis"
		local open = openReport == report.id
		table.insert(children, UI.button(("%d:%d %s · %s · %s%s"):format(report.homeScore, report.awayScore, report.opponent, report.competition or "", result, report.penaltyScore and (" (" .. report.penaltyScore .. " i.E.)") or ""), {
			style = open and "dark" or "ghost", height = 40, size = 13,
			onClick = function()
				openReport = if open then nil else report.id
				currentCtx.refresh()
			end,
		}))
		if open then
			local lines = {}
			local players = table.clone(report.players)
			table.sort(players, function(a, b)
				return a.rating > b.rating
			end)
			for _, entry in players do
				local reasons = {}
				for _, reason in entry.reasons do
					table.insert(reasons, ("%s %s"):format(reason.label, reason.value == 0 and "" or signed(reason.value)))
				end
				table.insert(lines, ("%s %s%s · %d Min · %d Tore · %d Vorlagen%s"):format(Util.formatDecimal(entry.rating, 1), name(entry.playerId), report.motmId == entry.playerId and " ★" or "", entry.minutes, entry.goals, entry.assists, entry.substitute and " · Joker" or ""))
				table.insert(lines, "    " .. table.concat(reasons, " · "))
			end
			table.insert(children, UI.label(table.concat(lines, "\n"), { size = 12 }))
			local events = {}
			for _, event in report.events or {} do
				table.insert(events, ("%d′ · %s"):format(event.minute, event.label))
			end
			if #events > 0 then
				table.insert(children, UI.label(table.concat(events, "\n"), { size = 12, color = C.muted }))
			end
		end
	end
	return UI.card(children, { gap = 6 })
end

local function travelSection(): Frame
	local travel = State.features("travel")
	local stats = travel and travel.stats or { trips = 0, km = 0, countries = {}, opponents = {} }
	local favourite, trips = nil, 0
	for _, entry in stats.opponents do
		if entry.trips > trips then
			favourite, trips = entry.name, entry.trips
		end
	end
	return UI.card({
		UI.eyebrow("Reisestatistik"),
		UI.columns({
			UI.box({ color = C.cardAlt, padding = 10 }, { UI.eyebrow("Reisen"), UI.label(tostring(stats.trips), { size = 22, font = Theme.fonts.black }) }),
			UI.box({ color = C.cardAlt, padding = 10 }, { UI.eyebrow("Kilometer"), UI.label(Util.formatInteger(stats.km), { size = 22, font = Theme.fonts.black }) }),
			UI.box({ color = C.cardAlt, padding = 10 }, { UI.eyebrow("Länder"), UI.label(tostring(#stats.countries), { size = 22, font = Theme.fonts.black }) }),
		}, 8),
		stats.furthest and UI.label(("Weiteste Reise: %s · %s km"):format(stats.furthest.opponent, Util.formatInteger(stats.furthest.km)), { size = 13 }) or nil,
		favourite and UI.label(("Häufigstes Ziel: %s (%d×)"):format(favourite, trips), { size = 13 }) or nil,
		#stats.countries > 0 and UI.label(table.concat(stats.countries, " · "), { size = 12, color = C.muted }) or nil,
	})
end

function Career.render(container: Frame, ctx: any)
	currentCtx = ctx
	local career = State.features("career")
	local starXI = State.features("starXI")
	if not career or not starXI then
		return
	end
	local phone = ctx.isPhone()
	local left = UI.box({ gap = 12, width = phone and UDim.new(1, 0) or UDim.new(0.5, -6) }, { formSection(career, starXI), archiveSection(career) })
	local right = UI.box({ gap = 12, width = phone and UDim.new(1, 0) or UDim.new(0.5, -6) }, { milestoneSection(career, starXI), awardSection(career), rivalSection(career), travelSection() })
	UI.box({ direction = Enum.FillDirection.Horizontal, gap = 12, wraps = true }, { left, right }).Parent = container
end

return Career
