--!nonstrict
-- Squad: formation, starting eleven on a pitch, bench and the reserve with filters.
-- Tap a pitch or bench slot first, then the player who should go there.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Cards = require(Shared.Cards)
local Career = require(Shared.Career)
local StarXI = require(Shared.StarXI)
local Util = require(Shared.Util)

local Client = script.Parent.Parent
local Net = require(Client.Net)
local State = require(Client.State)
local Theme = require(Client.Theme)
local UI = require(Client.UI)

local C = Theme.colors
local Squad = {}

Squad.sections = { "starXI", "cup", "transferSaga", "squadLock", "career", "core" }

local PAGE_SIZE = 48
local RATING_FILTERS = {
	{ id = "all", label = "Alle" }, { id = "67-78", label = "67–78" }, { id = "79-85", label = "79–85" },
	{ id = "86-89", label = "86–89" }, { id = "90-94", label = "90–94" }, { id = "95-100", label = "95–100" },
}

local selectedSlot: number? = nil
local selectedBench: number? = nil
local ratingFilter = "all"
local positionFilter = "all"
local search = ""
local page = 1
local showFormations = false
local currentCtx: any = nil

function Squad.signature(): string
	local starXI = State.features("starXI") or {}
	local cup = State.features("cup") or {}
	local saga = State.features("transferSaga") or {}
	return table.concat({
		table.concat(starXI.lineupIds or {}, ","), table.concat(starXI.benchIds or {}, ","), tostring(#(starXI.ownedIds or {})),
		tostring(starXI.formationId), tostring(starXI.fragments), tostring(cup.active), table.concat(cup.suspendedPlayerIds or {}, ","),
		tostring(#(saga.loans or {})), tostring(#(saga.vacancies or {})), tostring(State.core().seasons), tostring(selectedSlot), tostring(selectedBench),
		ratingFilter, positionFilter, search, tostring(page), tostring(showFormations), tostring(State.features("squadLock") ~= nil),
	}, "|")
end

local function unavailableSet(): { [string]: string }
	local cup = State.features("cup")
	local saga = State.features("transferSaga")
	local lock = State.features("squadLock")
	local set = {}
	for _, id in cup.suspendedPlayerIds do
		set[id] = "🟥 gesperrt"
	end
	for id, matches in cup.injuredPlayerIds do
		if matches > 0 then
			set[id] = ("🩹 %d Sp."):format(matches)
		end
	end
	for _, loan in saga.loans do
		set[loan.playerId] = "✈️ verliehen"
	end
	if lock then
		for _, id in State.features("starXI").ownedIds do
			if not table.find(lock.playerIds, id) then
				set[id] = "🧳 nicht im Reisekader"
			end
		end
	end
	return set
end

local function refresh()
	currentCtx.refresh()
end

local function playerChip(player: Cards.Player?, caption: string, selected: boolean, onClick: () -> (), extra: string?): TextButton
	local career = State.features("career")
	local bonus = 0
	if player and career then
		bonus = Career.card(career, player).bonus + Career.form(career, player.id).bonus
	end
	local button = UI.new("TextButton", {
		BackgroundColor3 = selected and C.accent or (player and C.card or C.cardAlt),
		AutoButtonColor = true,
		Text = "",
		Size = UDim2.fromOffset(92, 58),
		Activated = onClick,
	}, {
		UI.corner(10),
		UI.stroke(selected and C.accentDark or (player and Theme.tierColor(player.tier) or C.line), selected and 2 or 1),
		UI.padding(3, 4),
		UI.list(Enum.FillDirection.Vertical, 0, Enum.HorizontalAlignment.Center),
	})
	local textColor = selected and C.white or C.text
	UI.label(caption, { size = 10, font = Theme.fonts.bold, color = selected and C.white or C.muted, align = Enum.TextXAlignment.Center }).Parent = button
	UI.label(player and (tostring(player.rating) .. (bonus ~= 0 and (bonus > 0 and "+" or "") .. Util.formatDecimal(bonus, 1) or "")) or "+", { size = 15, font = Theme.fonts.black, color = player and (selected and C.white or Theme.readable(player.accent)) or C.faint, align = Enum.TextXAlignment.Center }).Parent = button
	UI.label(player and player.name or "frei", { size = 10, font = Theme.fonts.medium, color = textColor, align = Enum.TextXAlignment.Center, wrap = false }).Parent = button
	if extra then
		UI.label(extra, { size = 9, color = selected and C.white or C.red, align = Enum.TextXAlignment.Center }).Parent = button
	end
	return button
end

local function formationPicker(starXI: any, cup: any): Frame
	local core = State.core()
	local season = math.min(15, math.max(1, (core.seasons or 0) + 1))
	local current = Cards.formation(starXI.formationId)
	local children: { Instance? } = {
		UI.row({
			UI.label("Formation: " .. current.label, { size = 15, font = Theme.fonts.black, width = UDim.new(1, -300) }),
			UI.button(showFormations and "Schliessen" or "Formation wählen", { style = "secondary", width = UDim.new(0, 140), height = 34, size = 13, disabled = cup.active, onClick = function()
				showFormations = not showFormations
				refresh()
			end }),
			UI.button("Beste Elf", { style = "primary", width = UDim.new(0, 140), height = 34, size = 13, disabled = cup.active, onClick = function()
				Net.action("bestLineup")
			end }),
		}, 8, nil, true),
	}
	if showFormations then
		local grid = UI.box({ direction = Enum.FillDirection.Horizontal, gap = 6, wraps = true })
		for _, formation in Cards.FORMATIONS do
			local open = core.testMode or season >= (formation.unlockSeason or 1)
			local button = UI.button(open and formation.label or (formation.label .. " 🔒" .. formation.unlockSeason), {
				style = formation.id == starXI.formationId and "dark" or "secondary",
				width = UDim.new(0, 150), height = 32, size = 12, disabled = not open,
				onClick = function()
					showFormations = false
					Net.action("setFormation", { id = formation.id })
				end,
			})
			button.Parent = grid
		end
		table.insert(children, grid)
	end
	return UI.card(children, { gap = 8 })
end

local function pitch(starXI: any, unavailable: { [string]: string }, cup: any): Frame
	local formation = Cards.formation(starXI.formationId)
	local field = UI.new("Frame", { BackgroundColor3 = C.pitch, Size = UDim2.new(1, 0, 0, 470), ClipsDescendants = false }, { UI.corner(16) })
	UI.new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(110, 110), Parent = field }, { UI.corner(999), UI.stroke(Color3.new(1, 1, 1), 1.5, 0.55) })
	UI.new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.55, BorderSizePixel = 0, AnchorPoint = Vector2.new(0, 0.5), Position = UDim2.fromScale(0, 0.5), Size = UDim2.new(1, 0, 0, 2), Parent = field })
	for slot, formationSlot in formation.slots do
		local id = starXI.lineupIds[slot]
		local player = Cards.get(id)
		local chip = playerChip(player, formationSlot.position, selectedSlot == slot, function()
			if cup.active then
				currentCtx.toast("Wechsel während des Spiels in der Matchansicht.")
				return
			end
			if selectedBench then
				local bench = selectedBench
				selectedBench = nil
				Net.action("swapLineupBench", { slot = slot, index = bench })
				return
			end
			selectedSlot = selectedSlot ~= slot and slot or nil
			selectedBench = nil
			refresh()
		end, player and unavailable[player.id] or nil)
		chip.AnchorPoint = Vector2.new(0.5, 0.5)
		chip.Size = UDim2.new(0.185, 0, 0, 58)
		chip.Position = UDim2.fromScale(formationSlot.x / 100, 0.06 + formationSlot.y / 100 * 0.88)
		chip.Parent = field
	end
	return field
end

local function bench(starXI: any, unavailable: { [string]: string }, cup: any): Frame
	local grid = UI.box({ direction = Enum.FillDirection.Horizontal, gap = 6, wraps = true })
	for index = 1, Cards.BENCH_SIZE do
		local id = starXI.benchIds[index]
		local player = Cards.get(id)
		local chip = playerChip(player, "BANK " .. index, selectedBench == index, function()
			if cup.active then
				return
			end
			if selectedSlot and player then
				local slot = selectedSlot
				selectedSlot = nil
				Net.action("setStarter", { slot = slot, playerId = player.id })
				return
			end
			selectedBench = selectedBench ~= index and index or nil
			selectedSlot = nil
			refresh()
		end, player and unavailable[player.id] or nil)
		chip.Parent = grid
	end
	return UI.card({ UI.eyebrow(("Bank · %d / %d"):format(StarXI.filledCount(starXI.benchIds), Cards.BENCH_SIZE)), grid }, { padding = 12 })
end

local function reserve(starXI: any, unavailable: { [string]: string }, cup: any): Frame
	local assigned = {}
	for _, id in starXI.lineupIds do
		assigned[id] = true
	end
	for _, id in starXI.benchIds do
		assigned[id] = true
	end
	local positions = starXI.formationPositions
	local query = Util.lower(search)
	local list = {}
	for _, id in starXI.ownedIds do
		local player = Cards.get(id)
		if player and not assigned[id] then
			local inRating = true
			if ratingFilter ~= "all" then
				local low, high = string.match(ratingFilter, "(%d+)-(%d+)")
				inRating = player.rating >= tonumber(low) :: number and player.rating <= tonumber(high) :: number
			end
			local inPosition = positionFilter == "all" or table.find(Cards.positionsOf(player), positionFilter) ~= nil
			local text = Util.lower(player.name .. " " .. table.concat(Cards.positionsOf(player), " ") .. " " .. player.rating)
			if inRating and inPosition and (query == "" or string.find(text, query, 1, true)) then
				table.insert(list, player)
			end
		end
	end
	table.sort(list, function(a, b)
		if selectedSlot then
			local fa, fb = Cards.canFillSlot(a.id, selectedSlot, positions), Cards.canFillSlot(b.id, selectedSlot, positions)
			if fa ~= fb then
				return fa
			end
		end
		if a.rating ~= b.rating then
			return a.rating > b.rating
		end
		return a.name < b.name
	end)
	local pages = math.max(1, math.ceil(#list / PAGE_SIZE))
	page = math.clamp(page, 1, pages)
	local grid = UI.box({ direction = Enum.FillDirection.Horizontal, gap = 6, wraps = true })
	for index = (page - 1) * PAGE_SIZE + 1, math.min(#list, page * PAGE_SIZE) do
		local player = list[index]
		local fits = selectedSlot == nil or Cards.canFillSlot(player.id, selectedSlot, positions)
		local chip = playerChip(player, Cards.positionLabel(player, true), false, function()
			if cup.active then
				return
			end
			if selectedSlot then
				local slot = selectedSlot
				selectedSlot = nil
				Net.action("setStarter", { slot = slot, playerId = player.id })
			elseif selectedBench then
				local benchIndex = selectedBench
				selectedBench = nil
				Net.action("setBench", { index = benchIndex, playerId = player.id })
			else
				currentCtx.toast("Wähle zuerst einen Platz in der Startelf oder auf der Bank.")
			end
		end, unavailable[player.id])
		if not fits then
			chip.BackgroundTransparency = 0.6
		end
		chip.Parent = grid
	end
	local positionOptions = { { id = "all", label = "Alle" } }
	local search_box = UI.input("Suche nach Name, Position oder Rating", search)
	search_box.FocusLost:Connect(function()
		search = search_box.Text
		page = 1
		refresh()
	end)
	local positionRow = UI.box({ direction = Enum.FillDirection.Horizontal, gap = 4, wraps = true })
	for _, position in Util.concat(positionOptions, Util.map(Cards.POSITIONS, function(position)
		return { id = position, label = position }
	end)) do
		UI.button(position.label, { style = positionFilter == position.id and "dark" or "secondary", width = UDim.new(0, 52), height = 28, size = 11, onClick = function()
			positionFilter = position.id
			page = 1
			refresh()
		end }).Parent = positionRow
	end
	return UI.card({
		UI.eyebrow(("Kader / Reserve · %d Spieler"):format(#list)),
		search_box,
		UI.segmented(RATING_FILTERS, ratingFilter, function(id)
			ratingFilter = id
			page = 1
			refresh()
		end, 11),
		positionRow,
		grid,
		pages > 1 and UI.columns({
			UI.button("← Zurück", { style = "secondary", height = 32, disabled = page <= 1, onClick = function()
				page -= 1
				refresh()
			end }),
			UI.label(("Seite %d / %d"):format(page, pages), { size = 13, align = Enum.TextXAlignment.Center }),
			UI.button("Weiter →", { style = "secondary", height = 32, disabled = page >= pages, onClick = function()
				page += 1
				refresh()
			end }),
		}, 6) or nil,
	}, { gap = 8 })
end

function Squad.render(container: Frame, ctx: any)
	currentCtx = ctx
	local starXI = State.features("starXI")
	local cup = State.features("cup")
	if not starXI or not cup then
		return
	end
	local unavailable = unavailableSet()
	local rating = StarXI.rating(starXI.ownedIds, starXI.lineupIds)
	local summary = UI.card({
		UI.eyebrow("Star XI"),
		UI.row({
			UI.label(("%d OVR"):format(rating), { size = 28, font = Theme.fonts.black, inline = true }),
			UI.pill(("%d / 11 Startelf"):format(StarXI.filledCount(starXI.lineupIds)), C.cardAlt),
			UI.pill(("%d Karten"):format(#starXI.ownedIds), C.cardAlt),
			UI.pill(("%s Fragmente"):format(Util.formatNumber(starXI.fragments)), C.purple, C.white),
		}, 8, nil, true),
		cup.active and UI.label("Ein Spiel läuft: Wechsel und Taktik findest du im Bereich Spiele.", { size = 13, color = C.accent }) or nil,
		State.features("squadLock") and UI.label("🧳 Die Mannschaft ist auf Reise. Nur Spieler aus dem Reisekader sind einsetzbar.", { size = 13, color = C.gold }) or nil,
		(selectedSlot or selectedBench) and UI.label(selectedSlot and ("Platz %s gewählt: Tippe einen Spieler von Bank oder Reserve."):format(starXI.formationPositions[selectedSlot]) or "Bankplatz gewählt: Tippe einen Reservespieler oder einen Startelfplatz zum Tauschen.", { size = 13, color = C.accent, font = Theme.fonts.bold }) or nil,
	})
	summary.Parent = container
	for _, vacancy in (State.features("transferSaga") or { vacancies = {} }).vacancies do
		if StarXI.filledCount(starXI.lineupIds) + StarXI.filledCount(starXI.benchIds) < vacancy.requiredPlayers then
			UI.label(("Kaderlücke %s nach einem Transfer: Besetze den freien Platz, bevor du spielst."):format(vacancy.area == "lineup" and "in der Startelf" or "auf der Bank"), { size = 13, color = C.red, font = Theme.fonts.bold }).Parent = container
			break
		end
	end
	formationPicker(starXI, cup).Parent = container
	local phone = ctx.isPhone()
	local left = UI.box({ gap = 12, width = phone and UDim.new(1, 0) or UDim.new(0.55, -6) }, { UI.card({ pitch(starXI, unavailable, cup) }, { padding = 8 }), bench(starXI, unavailable, cup) })
	local right = UI.box({ gap = 12, width = phone and UDim.new(1, 0) or UDim.new(0.45, -6) }, { reserve(starXI, unavailable, cup) })
	UI.box({ direction = Enum.FillDirection.Horizontal, gap = 12, wraps = true }, { left, right }).Parent = container
end

return Squad
