--!nonstrict
-- Shop: game passes and developer products for Robux. Packs, cards and icons are never sold
-- here; they stay a goal purchase.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Economy = require(Shared.Economy)
local Monetization = require(Shared.Monetization)
local Util = require(Shared.Util)

local Client = script.Parent.Parent
local Net = require(Client.Net)
local Robux = require(Client.Robux)
local State = require(Client.State)
local Theme = require(Client.Theme)
local UI = require(Client.UI)

local C = Theme.colors
local Shop = {}

Shop.sections = { "shop", "core" }

-- The tab only appears once at least one pass or product has a Roblox ID.
function Shop.visible(): boolean
	return Monetization.anyEnabled()
end

function Shop.signature(): string
	local shop = Robux.shop()
	local parts = { tostring(shop.restricted) }
	for _, pass in Monetization.PASSES do
		table.insert(parts, ("%s:%s:%s"):format(pass.key, tostring(shop.owned[pass.key]), tostring(shop.active[pass.key])))
	end
	for key, count in State.core().shopCredits or {} do
		table.insert(parts, key .. "=" .. tostring(count))
	end
	table.sort(parts)
	return table.concat(parts, "|")
end

-- Production per second without temporary boosts (what goal packs are based on).
local function steadyProduction(): number
	local boost = Economy.goalBoostMultiplier({ goalBoost = State.features("goalBoost") }, State.now())
	return (State.core().passivePower or 0) / math.max(1, boost)
end

local PICTURE_SIZE = 64

local function itemRow(icon: string, name: string, description: string, detail: GuiObject?, action: GuiObject?, highlight: boolean?, image: string?): Frame
	-- With a picture the emoji would only repeat it.
	local title = UI.label(image and name or (icon .. "  " .. name), { size = 15, font = Theme.fonts.black })
	local info = UI.label(description, { size = 12, color = C.muted })
	-- Fixed order: the parts are created in different orders by the callers.
	title.LayoutOrder, info.LayoutOrder = 1, 2
	if detail then
		detail.LayoutOrder = 3
	end
	local picture = image and UI.new("ImageLabel", {
		Image = image,
		BackgroundTransparency = 1,
		Size = UDim2.fromOffset(PICTURE_SIZE, PICTURE_SIZE),
		LayoutOrder = 2,
	}, { UI.corner(10) }) or nil
	local used = (action and 128 or 0) + (picture and PICTURE_SIZE + 8 or 0)
	local text = UI.box({ gap = 2, width = UDim.new(1, -used) }, { title, info, detail })
	text.LayoutOrder = 3
	if action then
		-- Button on the left like the upgrade rows on the home screen.
		action.Size = UDim2.fromOffset(120, 38)
		action.LayoutOrder = 1
	end
	return UI.box({ color = C.cardAlt, padding = 12, radius = 12, stroke = highlight, strokeColor = C.gold }, {
		UI.row({ text, picture, action }, 8),
	})
end

local function passRow(pass: Monetization.Pass): Frame
	local owned = Robux.ownsPass(pass.key)
	local active = Robux.passActive(pass.key)
	local action: GuiObject
	if owned then
		action = UI.pill("✓ Gekauft", C.green, C.white)
	elseif active then
		action = UI.pill("Aktiv in der Welt", C.accent, C.white)
	else
		action = UI.button(Robux.price(pass.price), { style = "gold", size = 14, onClick = function()
			Robux.promptPass(pass.key)
		end })
	end
	local detail = (active and not owned) and UI.label("Ein Mitspieler hat diesen Pass. Er gilt in dieser Koop Welt für alle.", { size = 11, color = C.accent }) or nil
	return itemRow(pass.icon, pass.name, pass.description, detail, action, owned, pass.image)
end

local function productRow(product: Monetization.Product): Frame
	local detail: GuiObject? = nil
	if product.minutes then
		local amount = UI.label("", { size = 12, font = Theme.fonts.bold, color = C.green })
		detail = amount
		UI.bind(amount, "Text", function()
			return "Aktuell: +" .. Util.formatNumber(Monetization.packGoals(product, steadyProduction())) .. " Tore"
		end)
	elseif Monetization.CREDIT_PRODUCTS[product.key] and Robux.credits(product.key) > 0 then
		detail = UI.label(("Gutschrift vorhanden: %d"):format(Robux.credits(product.key)), { size = 12, font = Theme.fonts.bold, color = C.green })
	end
	local action = UI.button(Robux.price(product.price), { style = "gold", size = 14, onClick = function()
		Robux.promptProduct(product.key)
	end })
	return itemRow(product.icon, product.name, product.description, detail, action, nil, product.image)
end

local function creditsCard(): Frame?
	local rows: { Instance? } = {}
	for key in Monetization.CREDIT_PRODUCTS do
		local count = Robux.credits(key)
		local product = Monetization.product(key)
		if count > 0 and product then
			table.insert(rows, itemRow(product.icon, ("%s · %dx"):format(product.name, count), "Schon bezahlt. Einlösen, sobald es passt.", nil, UI.button("Einlösen", { style = "success", size = 14, onClick = function()
				Net.action("useShopCredit", { key = key })
			end }), nil, product.image))
		end
	end
	if #rows == 0 then
		return nil
	end
	local heading = UI.eyebrow("Deine Gutschriften")
	heading.LayoutOrder = -1
	table.insert(rows, 1, heading)
	return UI.card(rows, { gap = 8 })
end

function Shop.render(container: Frame, ctx: any)
	UI.card({
		UI.eyebrow("Shop / Robux"),
		UI.title("Mehr Tempo für deinen Club", 22),
		UI.label("Pässe gelten für immer, Produkte kannst du beliebig oft kaufen. Packs, Karten und Icons gibt es nur für Tore, nie für Robux. Gekaufte Tore landen im Guthaben, zählen aber nicht für Rang und Rangliste.", { size = 13, color = C.muted }),
		ctx.isCoop() and UI.label("Koop: Deine Pässe gelten in dieser Welt für alle. Produkte wirken auf die Welt, in der du gerade spielst.", { size = 12, color = C.accent }) or nil,
	}, { gap = 8 }).Parent = container
	local credits = creditsCard()
	if credits then
		credits.Parent = container
	end
	local passes: { Instance? } = { UI.eyebrow("Pässe / einmal kaufen") }
	for _, pass in Monetization.PASSES do
		if Robux.offered(pass) then
			table.insert(passes, passRow(pass))
		end
	end
	local products: { Instance? } = { UI.eyebrow("Produkte / beliebig oft") }
	for _, product in Monetization.PRODUCTS do
		if Robux.offered(product) then
			table.insert(products, productRow(product))
		end
	end
	local phone = ctx.isPhone()
	local columns = UI.box({ direction = Enum.FillDirection.Horizontal, gap = 12, wraps = true })
	for _, list in { passes, products } do
		if #list > 1 then
			UI.card(list, { gap = 8, width = phone and UDim.new(1, 0) or UDim.new(0.5, -6) }).Parent = columns
		end
	end
	columns.Parent = container
	if #passes == 1 and #products == 1 then
		UI.label("Der Shop wird gerade eingerichtet. Schau bald wieder vorbei.", { size = 14, color = C.muted }).Parent = container
	end
end

return Shop
