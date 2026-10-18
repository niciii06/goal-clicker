--!nonstrict
-- Robux buttons: open the Roblox purchase prompt. Effects only ever come from the server
-- (ProcessReceipt and the pass check); the client just shows what the server reports.
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Monetization = require(ReplicatedStorage.Shared.Monetization)
local Util = require(ReplicatedStorage.Shared.Util)

local Net = require(script.Parent.Net)
local State = require(script.Parent.State)
local UI = require(script.Parent.UI)

local Robux = {}

-- Paid random items policy: goals and fragments lead to packs, so these are not offered
-- where the policy restricts paid random items.
Robux.RESTRICTED = { goalsSmall = true, goalsLarge = true, goalsHuge = true, fragments = true, vip = true }

function Robux.shop(): any
	return State.features("shop") or { owned = {}, active = {}, restricted = false }
end

function Robux.price(price: number): string
	return "R$ " .. Util.formatInteger(price)
end

function Robux.offered(item: any): boolean
	if not Monetization.enabled(item) then
		return false
	end
	return not (Robux.shop().restricted and Robux.RESTRICTED[item.key])
end

function Robux.ownsPass(key: string): boolean
	return Robux.shop().owned[key] == true
end

function Robux.passActive(key: string): boolean
	return Robux.shop().active[key] == true
end

function Robux.credits(key: string): number
	local credits = State.core().shopCredits or {}
	return credits[key] or 0
end

function Robux.promptPass(key: string)
	local pass = Monetization.pass(key)
	if not pass or pass.id == 0 or Robux.ownsPass(key) then
		return
	end
	pcall(function()
		MarketplaceService:PromptGamePassPurchase(Players.LocalPlayer, pass.id)
	end)
end

function Robux.promptProduct(key: string)
	local product = Monetization.product(key)
	if not product or product.id == 0 then
		return
	end
	pcall(function()
		MarketplaceService:PromptProductPurchase(Players.LocalPlayer, product.id)
	end)
end

-- Rich text name, golden for VIP players (labels need rich = true).
function Robux.name(name: string, vip: boolean?): string
	local escaped = string.gsub(string.gsub(string.gsub(name, "&", "&amp;"), "<", "&lt;"), ">", "&gt;")
	if vip then
		return ('<font color="%s"><b>👑 %s</b></font>'):format(Monetization.VIP_COLOR, escaped)
	end
	return escaped
end

-- Small inline buy button for a product. A stored credit is used first (free, already paid).
-- Returns nil when the product is not offered and there is no credit.
function Robux.productButton(key: string, text: string, options: any?): TextButton?
	local product = Monetization.product(key)
	local o = table.clone(options or {})
	if Robux.credits(key) > 0 then
		o.style = o.style or "success"
		o.onClick = function()
			Net.action("useShopCredit", { key = key })
		end
		return UI.button(text .. " · Gutschrift", o)
	end
	if not product or not Robux.offered(product) then
		return nil
	end
	o.style = o.style or "gold"
	o.onClick = function()
		Robux.promptProduct(key)
	end
	return UI.button(("%s · %s"):format(text, Robux.price(product.price)), o)
end

return Robux
