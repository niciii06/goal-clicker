--!nonstrict
-- Packs & album: pack shop with odds, earned reward packs, the special card draw and the album.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Cards = require(Shared.Cards)
local CareerLogic = require(Shared.Career)
local Packs = require(Shared.Packs)
local Util = require(Shared.Util)

local Client = script.Parent.Parent
local Net = require(Client.Net)
local Overlays = require(Client.Overlays)
local State = require(Client.State)
local Theme = require(Client.Theme)
local UI = require(Client.UI)

local C = Theme.colors
local PacksScreen = {}

PacksScreen.sections = { "earnedPacks", "starXI", "career", "core", "cup" }

local search = ""
local typeFilter = "all"
local ownership = "all"
local page = 1
local openOdds: string? = nil
local currentCtx: any = nil

function PacksScreen.signature(ctx: any): string
	local starXI = State.features("starXI") or {}
	local earned = State.features("earnedPacks") or {}
	local career = State.features("career") or {}
	local opened = 0
	for _, pack in earned do
		if pack.opening then
			opened += 1
		end
	end
	return table.concat({ ctx.subTab("packs", "shop"), tostring(#(starXI.ownedIds or {})), tostring(starXI.fragments), tostring(#earned), tostring(opened), tostring(#(career.claimedAlbumRewards or {})), tostring(State.core().seasons), tostring(State.core().testMode), search, typeFilter, ownership, tostring(page), tostring(openOdds), tostring((State.features("cup") or {}).active) }, "|")
end

local function formatChance(chance: number): string
	local percentage = chance * 100
	local precision = percentage < 0.01 and 3 or percentage < 0.1 and 2 or percentage < 1 and 1 or 0
	return Util.formatDecimal(percentage, precision) .. "%"
end

local function packCard(pack: any): Frame
	local core = State.core()
	local season = math.min(15, math.max(1, (core.seasons or 0) + 1))
	local open = core.testMode or season >= (pack.unlockSeason or 1)
	local priceLabel = UI.label("", { size = 18, font = Theme.fonts.black })
	UI.bind(priceLabel, "Text", function()
		return Util.formatNumber(pack.price) .. " Tore"
	end)
	UI.bind(priceLabel, "TextColor3", function()
		return (State.core().testMode or State.liveGoals() >= pack.price) and C.green or C.red
	end)
	local children: { Instance? } = {
		UI.eyebrow(pack.id == "scrap" and "Einstieg" or pack.id == "legend" and "Endgame" or pack.id == "elite" and "Midgame" or "Scouting"),
		UI.title(pack.label, 20),
		UI.label(pack.description, { size = 13, color = C.muted }),
		priceLabel,
		UI.button(openOdds == pack.id and "Chancen ausblenden" or "Chancen anzeigen", { style = "secondary", height = 30, size = 12, onClick = function()
			openOdds = openOdds ~= pack.id and pack.id or nil
			currentCtx.refresh()
		end }),
	}
	if openOdds == pack.id then
		for _, odds in pack.odds do
			table.insert(children, UI.label(("%s · %s"):format(odds.label, formatChance(odds.chance)), { size = 12 }))
		end
	end
	table.insert(children, open and UI.button("Pack öffnen", { style = "primary", height = 44, onClick = function()
		Net.action("buyPack", { id = pack.id })
	end }) or UI.button(("Saison %d"):format(pack.unlockSeason), { style = "secondary", disabled = true }))
	return UI.card(children, { gap = 6 })
end

local function shop(container: Frame, ctx: any)
	local starXI = State.features("starXI")
	local earned = State.features("earnedPacks") or {}
	local unopened = Util.filter(earned, function(pack)
		return not pack.opening
	end)
	if #unopened > 0 then
		local children: { Instance? } = { UI.eyebrow("Prämien / Verdient"), UI.title(("%d Prämienpack%s bereit"):format(#unopened, #unopened == 1 and "" or "s"), 20) }
		for _, earnedPack in unopened do
			local definition = Packs.get(earnedPack.packId)
			table.insert(children, UI.button(("🎁 %s öffnen"):format(definition and definition.label or earnedPack.packId), { style = "gold", height = 44, onClick = function()
				Net.action("openRewardPack", { id = earnedPack.id })
			end }))
		end
		UI.card(children, { gap = 6, stroke = true, strokeColor = C.gold }).Parent = container
	end
	local grid = UI.box({ direction = Enum.FillDirection.Horizontal, gap = 12, wraps = true })
	local phone = ctx.isPhone()
	for _, pack in Packs.STAR_PACKS do
		local card = packCard(pack)
		card.Size = UDim2.new(phone and 1 or 0.5, phone and 0 or -6, 0, 0)
		card.Parent = grid
	end
	grid.Parent = container
	local cost = Cards.RANDOM_CUSTOM_CARD_COST
	local customNames = Util.map(Cards.CUSTOM, function(player)
		return player.name
	end)
	UI.card({
		UI.eyebrow("Fragmente / Spezialkarten"),
		UI.title(("%s Fragmente"):format(Util.formatNumber(starXI.fragments)), 22),
		UI.label(("Doppelte Karten geben Fragmente. Ein Zug kostet %s Fragmente und zieht zufällig eine von %d Spezialkarten: %s."):format(Util.formatNumber(cost), #Cards.CUSTOM, table.concat(customNames, ", ")), { size = 13, color = C.muted }),
		UI.progress(starXI.fragments / cost, C.purple),
		UI.button("Spezialkarte ziehen", { style = "primary", color = C.purple, disabled = starXI.fragments < cost and not State.core().testMode, onClick = function()
			Net.action("drawCustom")
		end }),
	}).Parent = container
end

local function album(container: Frame, ctx: any)
	local career = State.features("career")
	local starXI = State.features("starXI")
	local collected = {}
	for _, id in career.collectedIds do
		collected[id] = true
	end
	for _, id in starXI.ownedIds do
		collected[id] = true
	end
	local groups = CareerLogic.albumGroups({ collectedIds = Util.keys(collected), claimedAlbumRewards = career.claimedAlbumRewards })
	local count = Util.count(collected)
	local claimable, reward = 0, 0
	for _, group in groups do
		if not group.claimed and group.collected == group.total then
			claimable += 1
			reward += group.reward
		end
	end
	local groupRows: { Instance? } = {
		UI.eyebrow("Sammelalbum / Jede Karte zählt"),
		UI.title(("%s / %s Karten"):format(Util.formatInteger(count), Util.formatInteger(#Cards.ALL)), 22),
		UI.progress(count / #Cards.ALL, C.accent),
		UI.label("Einmal gesammelt, immer im Album. Verkäufe und Leihen entfernen keine Karte.", { size = 13, color = C.muted }),
		claimable > 0 and UI.button(("Alle %d Prämien abholen (+%s Fragmente)"):format(claimable, Util.formatNumber(reward)), { style = "success", onClick = function()
			Net.action("claimAlbum", { id = "all" })
		end }) or nil,
	}
	table.sort(groups, function(a, b)
		local readyA, readyB = a.collected == a.total and not a.claimed, b.collected == b.total and not b.claimed
		if readyA ~= readyB then
			return readyA
		end
		local nationA, nationB = string.sub(a.id, 1, 7) == "nation-", string.sub(b.id, 1, 7) == "nation-"
		if nationA ~= nationB then
			return not nationA
		end
		return a.collected / a.total > b.collected / b.total
	end)
	for index = 1, math.min(14, #groups) do
		local group = groups[index]
		local label = string.sub(group.id, 1, 7) == "nation-" and (Overlays.flag(string.sub(group.id, 8)) .. " " .. group.label) or group.label
		table.insert(groupRows, UI.box({ color = C.cardAlt, padding = 8, gap = 4, radius = 10 }, {
			UI.label(("%s · %d / %d · %s Fragmente%s"):format(label, group.collected, group.total, Util.formatNumber(group.reward), group.claimed and " · ✅ abgeholt" or ""), { size = 13, font = Theme.fonts.bold }),
			UI.progress(group.collected / group.total, group.claimed and C.green or C.accent, 6),
			(group.collected == group.total and not group.claimed) and UI.button("Prämie abholen", { style = "success", height = 30, size = 12, onClick = function()
				Net.action("claimAlbum", { id = group.id })
			end }) or nil,
		}))
	end
	UI.card(groupRows, { gap = 6 }).Parent = container

	local query = string.lower(search)
	local list = {}
	for _, player in Cards.ALL do
		local typeOk = typeFilter == "all" or (typeFilter == "custom" and player.isCustom) or (typeFilter == "icon" and player.cardType == "icon")
			or (typeFilter == "legendary" and player.cardType == "legendary") or (typeFilter == "base" and not player.isCustom and player.cardType ~= "icon" and player.cardType ~= "legendary")
		local ownOk = ownership == "all" or (ownership == "collected" and collected[player.id]) or (ownership == "missing" and not collected[player.id])
		if typeOk and ownOk and (query == "" or string.find(string.lower(player.name .. " " .. (player.countryCode or "")), query, 1, true)) then
			table.insert(list, player)
		end
	end
	table.sort(list, Cards.compareByRating)
	local pages = math.max(1, math.ceil(#list / 48))
	page = math.clamp(page, 1, pages)
	local searchBox = UI.input("Name oder Nation suchen", search)
	searchBox.FocusLost:Connect(function()
		search = searchBox.Text
		page = 1
		currentCtx.refresh()
	end)
	local grid = UI.box({ direction = Enum.FillDirection.Horizontal, gap = 6, wraps = true })
	for index = (page - 1) * 48 + 1, math.min(#list, page * 48) do
		local player = list[index]
		local has = collected[player.id]
		local tile = UI.box({ color = has and C.card or C.cardAlt, padding = 6, gap = 1, width = UDim.new(0, 116), stroke = true, strokeColor = has and Theme.tierColor(player.tier) or C.line, radius = 10 }, {
			UI.label(has and tostring(player.rating) or "?", { size = 16, font = Theme.fonts.black, color = has and Theme.readable(player.accent) or C.faint }),
			UI.label(has and player.name or "Noch nicht gesammelt", { size = 11, font = Theme.fonts.bold, color = has and C.text or C.faint }),
			UI.label(Overlays.flag(player.countryCode) .. " " .. Cards.positionLabel(player, true), { size = 10, color = C.muted }),
		})
		tile.Parent = grid
	end
	UI.card({
		UI.eyebrow(("Kartenübersicht · %d Treffer"):format(#list)),
		searchBox,
		UI.segmented({ { id = "all", label = "Alle" }, { id = "base", label = "Basis" }, { id = "icon", label = "Icons" }, { id = "legendary", label = "Legendär" }, { id = "custom", label = "Custom" } }, typeFilter, function(id)
			typeFilter = id
			page = 1
			currentCtx.refresh()
		end, 11),
		UI.segmented({ { id = "all", label = "Alle" }, { id = "collected", label = "Gesammelt" }, { id = "missing", label = "Fehlend" } }, ownership, function(id)
			ownership = id
			page = 1
			currentCtx.refresh()
		end, 12),
		grid,
		pages > 1 and UI.columns({
			UI.button("← Zurück", { style = "secondary", height = 32, disabled = page <= 1, onClick = function()
				page -= 1
				currentCtx.refresh()
			end }),
			UI.label(("Seite %d / %d"):format(page, pages), { size = 13, align = Enum.TextXAlignment.Center }),
			UI.button("Weiter →", { style = "secondary", height = 32, disabled = page >= pages, onClick = function()
				page += 1
				currentCtx.refresh()
			end }),
		}, 6) or nil,
	}, { gap = 8 }).Parent = container
end

function PacksScreen.render(container: Frame, ctx: any)
	currentCtx = ctx
	if not State.features("starXI") then
		return
	end
	local tab = ctx.subTab("packs", "shop")
	UI.segmented({ { id = "shop", label = "Packshop" }, { id = "album", label = "Sammelalbum" } }, tab, function(id)
		ctx.setSubTab("packs", id)
	end).Parent = container
	if (State.features("cup") or {}).active then
		UI.label("Während eines Spiels können keine Packs geöffnet werden.", { size = 13, color = C.red }).Parent = container
	end
	if tab == "album" then
		album(container, ctx)
	else
		shop(container, ctx)
	end
end

return PacksScreen
