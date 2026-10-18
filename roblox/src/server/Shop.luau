--!nonstrict
-- Robux shop on the server: game pass ownership (cached), ProcessReceipt, passes bought in
-- game and the paid random item policy. The client only opens Roblox purchase prompts.
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local PolicyService = game:GetService("PolicyService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local ServerStorage = game:GetService("ServerStorage")

local Clubs = require(script.Parent.Clubs)
local Monetization = require(ReplicatedStorage.Shared.Monetization)
local Purchases = require(script.Parent.Purchases)

local Shop = {}

local VIP_CACHE_SECONDS = 600

-- Pass ownership of players on this server (by user id).
local owned: { [number]: { [string]: boolean } } = {}
-- VIP status of ranked players who are not on this server.
local vipCache: { [number]: { value: boolean, at: number } } = {}

local options: { flush: (Player?) -> (), toast: (Player, string) -> () } = nil :: any

local function userOwns(userId: number, pass: Monetization.Pass): boolean
	if pass.id == 0 then
		return false
	end
	local ok, result = pcall(function()
		return MarketplaceService:UserOwnsGamePassAsync(userId, pass.id)
	end)
	if not ok then
		warn("[Shop] Pass Prüfung fehlgeschlagen:", pass.key, result)
	end
	return ok and result == true
end

-- Checks every pass once when the player joins and applies them to their clubs.
function Shop.loadPlayer(player: Player)
	local viewer = Clubs.viewer(player)
	if not viewer then
		return
	end
	local passes = owned[player.UserId] or {}
	for _, pass in Monetization.PASSES do
		if not passes[pass.key] and userOwns(player.UserId, pass) then
			passes[pass.key] = true
		end
	end
	owned[player.UserId] = passes
	local okPolicy, policy = pcall(function()
		return PolicyService:GetPolicyInfoForPlayerAsync(player)
	end)
	viewer.restricted = okPolicy and type(policy) == "table" and policy.ArePaidRandomItemsRestricted == true or false
	if Clubs.viewer(player) == viewer then
		Clubs.setPasses(viewer, passes)
	end
end

function Shop.removePlayer(player: Player)
	owned[player.UserId] = nil
end

-- Golden names in the ranking: VIP status, cached for players on other servers.
function Shop.isVip(userId: number): boolean
	local pass = Monetization.pass("vip")
	if not pass or pass.id == 0 then
		return false
	end
	if owned[userId] then
		return owned[userId].vip == true
	end
	local cached = vipCache[userId]
	if cached and os.clock() - cached.at < VIP_CACHE_SECONDS then
		return cached.value
	end
	local value = userOwns(userId, pass)
	vipCache[userId] = { value = value, at = os.clock() }
	return value
end

local function grantPass(player: Player, pass: Monetization.Pass)
	local viewer = Clubs.viewer(player)
	local passes = owned[player.UserId] or {}
	passes[pass.key] = true
	owned[player.UserId] = passes
	if viewer then
		Clubs.setPasses(viewer, passes)
		options.toast(player, ("Danke! %s ist jetzt aktiv."):format(pass.name))
		options.flush(player)
	end
end

local receiptContext = {
	viewerFor = function(userId: number)
		local player = Players:GetPlayerByUserId(userId)
		return player and Clubs.viewer(player)
	end,
	sessionFor = function(viewer)
		return Clubs.session(viewer)
	end,
	save = function(viewer): boolean
		return Clubs.savePurchase(viewer)
	end,
	now = function(): number
		return Clubs.now()
	end,
	nameOf = function(viewer): string
		return viewer.player.DisplayName
	end,
	announce = function(viewer, text: string)
		options.toast(viewer.player, text)
	end,
}

local function processReceipt(receipt: any, product: Monetization.Product?): Enum.ProductPurchaseDecision
	local result = Purchases.processReceipt(receiptContext, receipt, product)
	if result == Purchases.GRANTED then
		options.flush()
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end
	return Enum.ProductPurchaseDecision.NotProcessedYet
end

-- Studio only: test purchases without Roblox IDs, called from the command bar or Studio MCP.
local function studioTestHook()
	local hook = Instance.new("BindableFunction")
	hook.Name = "GoalClickerShopTest"
	hook.OnInvoke = function(kind: string, userId: number, key: string, purchaseId: string?)
		local player = Players:GetPlayerByUserId(userId)
		if not player then
			return "Spieler nicht gefunden"
		end
		if kind == "pass" then
			local pass = Monetization.pass(key)
			if not pass then
				return "Pass unbekannt"
			end
			grantPass(player, pass)
			return "granted"
		end
		local decision = processReceipt({ PlayerId = userId, ProductId = 0, PurchaseId = purchaseId or tostring(os.clock()) }, Monetization.product(key))
		return decision.Name
	end
	hook.Parent = ServerStorage
end

function Shop.start(startOptions: { flush: (Player?) -> (), toast: (Player, string) -> () })
	options = startOptions
	MarketplaceService.ProcessReceipt = function(receipt)
		return processReceipt(receipt, Monetization.productById(receipt.ProductId))
	end
	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player: Player, passId: number, purchased: boolean)
		local pass = Monetization.passById(passId)
		if purchased and pass then
			grantPass(player, pass)
		end
	end)
	if RunService:IsStudio() then
		local ok, problem = pcall(studioTestHook)
		if not ok then
			warn("[Shop] Studio Testzugang nicht verfügbar:", problem)
		end
	end
end

return Shop
