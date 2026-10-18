--!nonstrict
-- Club & more: club profile, Fabrizio Romario, missions, history, codes, ranking and settings.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Cards = require(Shared.Cards)
local Features = require(Shared.Features)
local Monetization = require(Shared.Monetization)
local Util = require(Shared.Util)

local Client = script.Parent.Parent
local Net = require(Client.Net)
local Robux = require(Client.Robux)
local State = require(Client.State)
local Theme = require(Client.Theme)
local UI = require(Client.UI)

local C = Theme.colors
local Club = {}

Club.sections = { "club", "transferSaga", "missions", "history", "core", "coop", "cup", "gazetteIssues", "shop" }

local draft: any = nil
local codeInput = ""
local ranking: { any }? = nil
local confirmReset = false
local currentCtx: any = nil

function Club.signature(ctx: any): string
	local saga = State.features("transferSaga") or {}
	local history = State.features("history") or {}
	local last = history[#history]
	local club = State.features("club") or {}
	local missions = State.features("missions") or {}
	local claimed = 0
	for _, mission in missions do
		if mission.claimed then
			claimed += 1
		end
	end
	local tab = ctx.subTab("club", "profile")
	local missionProgress = ""
	if tab == "missions" then
		local core = State.core()
		missionProgress = ("%d|%d|%d"):format(math.floor((core.seasonGoals or 0) / 100), core.clicks or 0, core.minigameWins or 0)
	end
	return table.concat({
		tab, tostring(club.name), tostring(club.badge), tostring(club.color), tostring(#(saga.archive or {})), tostring(#(saga.loans or {})),
		tostring(saga.deadlineDayEndsAt), last and last.id or "-", tostring(claimed), missionProgress, tostring(ranking ~= nil), tostring(confirmReset),
		tostring(State.features("coop") ~= nil), tostring(#(State.core().redeemedCodes or {})), tostring(Robux.passActive("vip")),
	}, "|")
end

local function profile(): Frame
	local club = State.features("club")
	draft = draft or table.clone(club)
	local nameBox = UI.input("Clubname (max. 22 Zeichen)", draft.name)
	nameBox.FocusLost:Connect(function()
		draft.name = string.sub(nameBox.Text, 1, 22)
	end)
	local badges = {}
	for _, badge in Features.CLUB_BADGES do
		table.insert(badges, UI.button(badge, { style = draft.badge == badge and "dark" or "secondary", height = 40, size = 20, onClick = function()
			draft.badge = badge
			currentCtx.refresh()
		end }))
	end
	local colors = {}
	for _, color in Features.CLUB_COLORS do
		table.insert(colors, UI.button(draft.color == color and "✓" or "", { color = Theme.color(color), height = 40, onClick = function()
			draft.color = color
			currentCtx.refresh()
		end }))
	end
	-- VIP clubs get extra jersey colours.
	local vipColors = nil
	if Robux.passActive("vip") then
		local buttons = {}
		for _, color in Monetization.VIP_CLUB_COLORS do
			table.insert(buttons, UI.button(draft.color == color and "✓" or "", { color = Theme.color(color), height = 40, onClick = function()
				draft.color = color
				currentCtx.refresh()
			end }))
		end
		vipColors = UI.box({ gap = 6 }, { UI.eyebrow("👑 VIP Trikotfarben", C.gold), UI.columns(buttons, 6) })
	end
	return UI.card({
		UI.eyebrow("Clubprofil"),
		UI.title(("%s %s"):format(club.badge, club.name), 24),
		UI.label("Name, Wappen und Farbe deines Clubs. Der Name erscheint in Tabelle, Zeitung und Live-Spiel.", { size = 13, color = C.muted }),
		nameBox,
		UI.columns(badges, 6),
		UI.columns(colors, 6),
		vipColors,
		UI.button("Clubprofil speichern", { style = "primary", onClick = function()
			draft.name = nameBox.Text
			local ok = Net.action("saveClub", draft)
			if ok then
				draft = nil
			end
		end }),
	}, { gap = 8 })
end

local function fabrizio(): Frame
	local saga = State.features("transferSaga")
	local cup = State.features("cup")
	local deadline = Features.isDeadlineDay({ transferSaga = saga }, State.now())
	local children: { Instance? } = {
		UI.eyebrow("Fabrizio Romario / Transfers"),
		UI.title("Markt zu, Gerüchte offen.", 20),
		UI.label("Keine Spielerkäufe bei Fabrizio. Er meldet weiterhin Leihen, Verkäufe und Rückkehrer.", { size = 13, color = C.muted }),
	}
	if deadline then
		local countdown = UI.label("", { size = 14, font = Theme.fonts.black, color = C.white })
		UI.bind(countdown, "Text", function()
			return "DEADLINE DAY · noch " .. Util.formatCountdown(saga.deadlineDayEndsAt, State.now())
		end)
		table.insert(children, UI.box({ color = C.red, padding = 10, radius = 10 }, { countdown, UI.label("Mehr Leihangebote bis das nächste Turnier wieder freigegeben wird.", { size = 12, color = C.white }) }))
	end
	if cup.active then
		table.insert(children, UI.label("Spiel läuft: Keine Abgänge bis zum Abpfiff.", { size = 13, color = C.accent }))
	end
	local nextRumour = UI.label("", { size = 12, color = C.muted })
	UI.bind(nextRumour, "Text", function()
		local live = State.features("transferSaga")
		return live and live.nextAt > State.now() and ("Nächste Meldung in etwa " .. Util.formatCountdown(live.nextAt, State.now())) or "Fabrizio telefoniert gerade."
	end)
	table.insert(children, nextRumour)
	table.insert(children, UI.eyebrow(("Aktuell verliehen · %d"):format(#saga.loans)))
	for _, loan in saga.loans do
		local player = Cards.get(loan.playerId)
		table.insert(children, UI.label(("✈️ %s · %s · %s"):format(player and player.name or "?", loan.club, loan.status == "active" and "kehrt nach dem laufenden Wettbewerb zurück" or "fehlt im nächsten Wettbewerb"), { size = 13 }))
	end
	table.insert(children, UI.eyebrow(("Transferhistorie · %d"):format(#saga.archive)))
	for index = #saga.archive, math.max(1, #saga.archive - 11), -1 do
		local event = saga.archive[index]
		local icon = event.outcome == "sale" and "↗" or event.outcome == "return" and "↙" or "⇄"
		local text = event.outcome == "return" and ("Zurück von " .. event.club) or ((event.outcome == "sale" and "Verkauft" or "Verliehen") .. " an " .. event.club .. (event.fee > 0 and (" · " .. Util.formatNumber(event.fee) .. " Tore") or ""))
		table.insert(children, UI.label(("%s %s · %s"):format(icon, event.playerName or "Mehrere Spieler", text), { size = 13 }))
	end
	if saga.latestEvent then
		table.insert(children, UI.box({ color = C.cardAlt, padding = 10, radius = 10 }, { UI.eyebrow("Letzte Meldung · " .. saga.latestEvent.headline), UI.label(saga.latestEvent.message, { size = 13 }) }))
	end
	return UI.card(children, { gap = 6 })
end

local function missions(ctx: any): Frame
	local list = State.features("missions") or {}
	local core = State.core()
	local cup = State.features("cup") or { wins = 0 }
	local children: { Instance? } = {
		UI.eyebrow("Missionen / Koop"),
		UI.title("Gemeinsame Ziele", 20),
		not ctx.isCoop() and UI.label("Missionen werden in einer Koop-Welt gemeinsam erfüllt. Wechsle oben zu Koop Multiplayer.", { size = 13, color = C.muted }) or nil,
	}
	for _, mission in list do
		local progress = mission.kind == "goals" and core.seasonGoals or mission.kind == "clicks" and core.clicks or mission.kind == "minigames" and core.minigameWins or cup.wins
		progress = math.floor(progress or 0)
		local done = progress >= mission.target
		table.insert(children, UI.box({ color = C.cardAlt, padding = 10, gap = 4, radius = 10 }, {
			UI.label(("%s · +%s Tore"):format(mission.title, Util.formatNumber(mission.reward)), { size = 14, font = Theme.fonts.bold }),
			UI.label(mission.description, { size = 12, color = C.muted }),
			UI.progress(progress / mission.target, mission.claimed and C.green or C.accent, 6),
			UI.label(("%s / %s"):format(Util.formatNumber(math.min(progress, mission.target)), Util.formatNumber(mission.target)), { size = 12 }),
			(ctx.isCoop() and done and not mission.claimed) and UI.button("Abholen", { style = "success", height = 32, onClick = function()
				Net.action("claimMission", { id = mission.id })
			end }) or (mission.claimed and UI.label("✅ abgeholt", { size = 12, color = C.green }) or nil),
		}))
	end
	return UI.card(children, { gap = 6 })
end

local function history(): Frame
	local list = State.features("history") or {}
	local children: { Instance? } = { UI.eyebrow("Verlauf / letzte 30 Ereignisse") }
	for index = #list, 1, -1 do
		local entry = list[index]
		local time = DateTime.fromUnixTimestampMillis(entry.timestamp):FormatLocalTime("HH:mm", "de-ch")
		table.insert(children, UI.box({ color = C.cardAlt, padding = 8, gap = 2, radius = 10 }, {
			UI.label(("%s · %s"):format(time, entry.title), { size = 13, font = Theme.fonts.bold, color = Theme.tone[entry.tone] or C.text }),
			UI.label(entry.detail, { size = 12, color = C.muted }),
		}))
	end
	if #list == 0 then
		table.insert(children, UI.label("Noch nichts passiert. Klick den Ball!", { size = 13, color = C.muted }))
	end
	return UI.card(children, { gap = 6 })
end

local function codes(): Frame
	local box = UI.input("Code eingeben", codeInput, function(text)
		codeInput = text
	end)
	local redeemed = State.core().redeemedCodes or {}
	return UI.card({
		UI.eyebrow("Codes"),
		UI.title("Code einlösen", 20),
		UI.label("Manche Codes schalten besondere Spieler frei. Jeder Code funktioniert einmal pro Club.", { size = 13, color = C.muted }),
		box,
		UI.button("Einlösen", { style = "primary", onClick = function()
			local ok = Net.action("redeemCode", { code = box.Text })
			if ok then
				codeInput = ""
			end
		end }),
		#redeemed > 0 and UI.label("Eingelöst: " .. table.concat(redeemed, ", "), { size = 12, color = C.muted }) or nil,
	}, { gap = 8 })
end

local function rankingCard(): Frame
	local children: { Instance? } = {
		UI.eyebrow("Rangliste / Tore insgesamt"),
		UI.title("Die besten Clubs", 20),
	}
	if ranking then
		for _, entry in ranking do
			table.insert(children, UI.label(("%d. %s · %s Tore"):format(entry.rank, Robux.name(entry.name, entry.vip), Util.formatNumber(entry.goals)), { size = 14, font = entry.rank <= 3 and Theme.fonts.bold or Theme.fonts.regular, rich = true }))
		end
		if #ranking == 0 then
			table.insert(children, UI.label("Die Rangliste ist in Studio ohne Speicherzugriff leer.", { size = 13, color = C.muted }))
		end
	end
	table.insert(children, UI.button(ranking and "Aktualisieren" or "Rangliste laden", { style = "secondary", onClick = function()
		ranking = Net.query("ranking") or {}
		currentCtx.refresh()
	end }))
	return UI.card(children, { gap = 6 })
end

local function settings(ctx: any): Frame
	local core = State.core()
	return UI.card({
		UI.eyebrow("Einstellungen"),
		UI.button(core.sound == false and "Sound einschalten" or "Sound ausschalten", { style = "secondary", onClick = function()
			Net.action("toggleSound")
		end }),
		UI.label(ctx.isCoop() and "Nur der Host kann den gemeinsamen Spielstand zurücksetzen." or "Setzt deinen eigenen Club vollständig zurück. Das kann nicht rückgängig gemacht werden.", { size = 12, color = C.muted }),
		confirmReset and UI.columns({
			UI.button("Ja, alles löschen", { style = "danger", onClick = function()
				confirmReset = false
				Net.action("resetGame")
				ctx.refresh()
			end }),
			UI.button("Abbrechen", { style = "secondary", onClick = function()
				confirmReset = false
				ctx.refresh()
			end }),
		}, 8) or UI.button("Spielstand zurücksetzen", { style = "danger", onClick = function()
			confirmReset = true
			ctx.refresh()
		end }),
	}, { gap = 8 })
end

function Club.render(container: Frame, ctx: any)
	currentCtx = ctx
	if not State.features("club") then
		return
	end
	local tab = ctx.subTab("club", "profile")
	UI.segmented({
		{ id = "profile", label = "Club" }, { id = "fabrizio", label = "Fabrizio" }, { id = "missions", label = "Missionen" },
		{ id = "history", label = "Verlauf" }, { id = "more", label = "Mehr" },
	}, tab, function(id)
		ctx.setSubTab("club", id)
	end, 12).Parent = container
	if tab == "fabrizio" then
		fabrizio().Parent = container
	elseif tab == "missions" then
		missions(ctx).Parent = container
	elseif tab == "history" then
		history().Parent = container
	elseif tab == "more" then
		codes().Parent = container
		rankingCard().Parent = container
		settings(ctx).Parent = container
	else
		profile().Parent = container
	end
end

return Club
