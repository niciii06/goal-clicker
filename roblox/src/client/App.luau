--!nonstrict
-- The app shell: top bar with the goal counter, mode switch, navigation and the active screen.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Net = require(script.Parent.Net)
local Overlays = require(script.Parent.Overlays)
local State = require(script.Parent.State)
local Theme = require(script.Parent.Theme)
local UI = require(script.Parent.UI)
local Util = require(game:GetService("ReplicatedStorage").Shared.Util)
local Economy = require(game:GetService("ReplicatedStorage").Shared.Economy)

local Screens = script.Parent.Screens
local SCREEN_MODULES = {
	home = require(Screens.Home),
	matches = require(Screens.Matches),
	squad = require(Screens.Squad),
	career = require(Screens.Career),
	packs = require(Screens.Packs),
	club = require(Screens.Club),
	coop = require(Screens.Coop),
}

local TABS = {
	{ id = "home", label = "Home" },
	{ id = "matches", label = "Spiele" },
	{ id = "squad", label = "Kader" },
	{ id = "career", label = "Karriere" },
	{ id = "packs", label = "Packs & Album" },
	{ id = "club", label = "Club & Mehr" },
}

local C = Theme.colors
local App = {}

local player = Players.LocalPlayer
local gui: ScreenGui
local panel: Frame
local content: ScrollingFrame
local navFrame: Frame
local modeFrame: Frame
local current = "home"
local mode = "single"
local panelHidden = false
local renderQueued = false
local subTabs: { [string]: string } = {}
local lastSignature: string? = nil

local ctx = {}

local function isPhone(): boolean
	local camera = Workspace.CurrentCamera
	return camera ~= nil and camera.ViewportSize.X < 760
end

function ctx.navigate(tab: string, sub: string?)
	if sub then
		subTabs[tab] = sub
	end
	if current ~= tab then
		current = tab
		content.CanvasPosition = Vector2.zero
	end
	App.renderNav()
	App.render()
end

function ctx.subTab(tab: string, fallback: string): string
	return subTabs[tab] or fallback
end

function ctx.setSubTab(tab: string, sub: string)
	subTabs[tab] = sub
	App.render()
end

function ctx.refresh()
	App.render()
end

function ctx.toast(text: string)
	Overlays.toast(text, true)
end

function ctx.isPhone(): boolean
	return isPhone()
end

function ctx.isCoop(): boolean
	return State.features("coop") ~= nil
end

function ctx.hidePanel(hidden: boolean)
	panelHidden = hidden
	panel.Visible = not hidden
	App.renderToggle()
end

local toggleButton: TextButton

function App.renderToggle()
	toggleButton.Text = panelHidden and "☰  Menü" or "🏟️  Stadion"
end

local function buildTopBar(parent: Instance)
	local bar = UI.new("Frame", {
		Name = "TopBar",
		BackgroundColor3 = C.card,
		Size = UDim2.new(1, 0, 0, 64),
		LayoutOrder = 1,
		Parent = parent,
	}, { UI.corner(16), UI.stroke(C.line), UI.padding(8, 14) })
	UI.new("TextLabel", {
		BackgroundTransparency = 1,
		Size = UDim2.new(0.45, -10, 1, 0),
		Font = Theme.fonts.black,
		TextScaled = true,
		TextSize = 22,
		TextXAlignment = Enum.TextXAlignment.Left,
		RichText = true,
		Text = '⚽ GOAL <font color="#0071e3">CLICKER</font>',
		TextColor3 = C.text,
		Parent = bar,
	})
	local goals = UI.new("Frame", {
		BackgroundColor3 = C.text,
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -96, 0.5, 0),
		Size = UDim2.new(0.55, -96, 1, 0),
		Parent = bar,
	}, { UI.corner(12), UI.padding(4, 12), UI.new("UISizeConstraint", { MaxSize = Vector2.new(230, math.huge) }) })
	local caption = UI.new("TextLabel", {
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0.35, 0),
		Font = Theme.fonts.bold,
		TextSize = 10,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = C.faint,
		Text = "AKTUELLER STAND",
		Parent = goals,
	})
	local value = UI.new("TextLabel", {
		BackgroundTransparency = 1,
		Position = UDim2.fromScale(0, 0.35),
		Size = UDim2.new(1, 0, 0.65, 0),
		Font = Theme.fonts.black,
		TextScaled = true,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextColor3 = C.white,
		Text = "0",
		Parent = goals,
	})
	UI.bind(value, "Text", function()
		return Util.formatNumber(State.liveGoals()) .. " Tore"
	end)
	UI.bind(caption, "Text", function()
		local core = State.core()
		local boost = Economy.goalBoostMultiplier({ goalBoost = State.features("goalBoost") }, State.now())
		if boost > 1 then
			local boostState = State.features("goalBoost")
			return ("⚡ %s× GOALBOOST · %s"):format(Util.formatDecimal(boost, boost % 1 == 0 and 0 or 1), Util.formatCountdown(boostState.endsAt, State.now()))
		end
		return (ctx.isCoop() and "GEMEINSAME TORE" or "AKTUELLER STAND") .. (core.testMode and " · TESTMODUS" or "")
	end)
	UI.new("TextButton", {
		Name = "Sound",
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -46, 0.5, 0),
		Size = UDim2.fromOffset(40, 40),
		BackgroundColor3 = C.cardAlt,
		Font = Theme.fonts.bold,
		TextSize = 18,
		Text = "🔊",
		Parent = bar,
		Activated = function()
			Net.action("toggleSound")
		end,
	}, { UI.corner(10) })
	UI.new("TextButton", {
		Name = "History",
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, 0, 0.5, 0),
		Size = UDim2.fromOffset(40, 40),
		BackgroundColor3 = C.cardAlt,
		Font = Theme.fonts.bold,
		TextSize = 18,
		Text = "🔔",
		Parent = bar,
		Activated = function()
			ctx.navigate("club", "history")
		end,
	}, { UI.corner(10) })
	local soundButton = bar:FindFirstChild("Sound") :: TextButton
	UI.bind(soundButton, "Text", function()
		return State.core().sound == false and "🔇" or "🔊"
	end)
	return bar
end

function App.renderNav()
	UI.clear(navFrame)
	if mode == "coop" and not ctx.isCoop() then
		return
	end
	for _, tab in TABS do
		local label = tab.label
		if tab.id == "matches" and State.features("cup") and State.features("cup").active then
			label = "Spiele · LIVE"
		end
		local button = UI.button(label, {
			style = current == tab.id and "dark" or "secondary",
			height = 36,
			size = 14,
			width = UDim.new(0, 0),
			onClick = function()
				ctx.navigate(tab.id)
			end,
		})
		button.AutomaticSize = Enum.AutomaticSize.X
		button.Parent = navFrame
	end
end

local function renderMode()
	UI.clear(modeFrame)
	local inCoop = ctx.isCoop()
	if inCoop then
		mode = "coop"
	end
	local options = {
		UI.button("Singleplayer", { style = mode == "single" and "primary" or "secondary", height = 34, size = 13, onClick = function()
			if ctx.isCoop() then
				Net.action("leaveCoop")
			end
			mode = "single"
			current = "home"
			renderMode()
			App.renderNav()
			App.render()
		end }),
		UI.button("Koop Multiplayer", { style = mode == "coop" and "primary" or "secondary", height = 34, size = 13, onClick = function()
			mode = "coop"
			if not ctx.isCoop() then
				current = "coop"
			end
			renderMode()
			App.renderNav()
			App.render()
		end }),
	}
	UI.columns(options, 6).Parent = modeFrame
end

function App.render()
	if renderQueued then
		return
	end
	renderQueued = true
	task.defer(function()
		renderQueued = false
		if not State.ready then
			UI.clear(content)
			UI.label("⚽ Dein Club wird geladen …", { size = 18, font = Theme.fonts.bold, align = Enum.TextXAlignment.Center }).Parent = content
			return
		end
		local screenId = current
		if mode == "coop" and not ctx.isCoop() then
			screenId = "coop"
		elseif screenId == "coop" then
			screenId = "home"
			current = "home"
		end
		local screen = SCREEN_MODULES[screenId]
		if screen.signature then
			local signatureOk, signature = pcall(screen.signature, ctx)
			lastSignature = signatureOk and signature or nil
		else
			lastSignature = nil
		end
		local scroll = content.CanvasPosition
		UI.clear(content)
		local ok, problem = pcall(screen.render, content, ctx)
		if not ok then
			warn("[App] Screen failed:", problem)
			UI.label("Dieser Bereich konnte nicht geladen werden: " .. tostring(problem), { color = C.red }).Parent = content
		end
		content.CanvasPosition = scroll
	end)
end

local function sectionsOf(screenId: string): { string }
	local screen = SCREEN_MODULES[screenId]
	return screen and screen.sections or {}
end

function App.start()
	gui = UI.new("ScreenGui", {
		Name = "GoalClicker",
		ResetOnSpawn = false,
		IgnoreGuiInset = true,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		Parent = player:WaitForChild("PlayerGui"),
	})
	panel = UI.new("Frame", {
		Name = "Panel",
		BackgroundColor3 = C.background,
		BackgroundTransparency = 0.04,
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 60),
		Size = UDim2.new(1, -16, 1, -68),
		Parent = gui,
	}, {
		UI.corner(20),
		UI.new("UISizeConstraint", { MaxSize = Vector2.new(1180, math.huge) }),
		UI.padding(10),
		UI.list(Enum.FillDirection.Vertical, 8),
	})
	buildTopBar(panel)
	modeFrame = UI.box({ name = "Mode" })
	modeFrame.LayoutOrder = 2
	modeFrame.Parent = panel
	navFrame = UI.new("ScrollingFrame", {
		Name = "Nav",
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, 40),
		CanvasSize = UDim2.new(0, 0, 0, 0),
		AutomaticCanvasSize = Enum.AutomaticSize.X,
		ScrollingDirection = Enum.ScrollingDirection.X,
		ScrollBarThickness = 0,
		LayoutOrder = 3,
		Parent = panel,
	}, { UI.list(Enum.FillDirection.Horizontal, 6) })
	content = UI.new("ScrollingFrame", {
		Name = "Content",
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		Size = UDim2.new(1, 0, 1, -170),
		CanvasSize = UDim2.new(0, 0, 0, 0),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 6,
		ScrollBarImageColor3 = C.faint,
		LayoutOrder = 4,
		Parent = panel,
	}, { UI.list(Enum.FillDirection.Vertical, 12), UI.padding(2, 8, 24, 2) })

	toggleButton = UI.new("TextButton", {
		Name = "PanelToggle",
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 14),
		Size = UDim2.fromOffset(150, 34),
		BackgroundColor3 = C.text,
		TextColor3 = C.white,
		Font = Theme.fonts.bold,
		TextSize = 14,
		Text = "🏟️  Stadion",
		Parent = gui,
		Activated = function()
			ctx.hidePanel(not panelHidden)
		end,
	}, { UI.corner(999) })

	Overlays.mount(gui, ctx)
	Net.setToast(function(text, success)
		Overlays.toast(text, success)
	end)

	State.onChange(function(changed)
		if changed.coop then
			renderMode()
			App.renderNav()
		end
		if changed.cup then
			App.renderNav()
		end
		local screenId = (mode == "coop" and not ctx.isCoop()) and "coop" or current
		for _, key in sectionsOf(screenId) do
			if changed[key] then
				-- Screens with a signature only re-render when their structure changed;
				-- live numbers update through bindings in between.
				local screen = SCREEN_MODULES[screenId]
				if screen.signature then
					local ok, signature = pcall(screen.signature, ctx)
					if ok and signature == lastSignature then
						break
					end
				end
				App.render()
				break
			end
		end
	end)

	renderMode()
	App.renderNav()
	App.render()

	local elapsed = 0
	RunService.RenderStepped:Connect(function(dt)
		elapsed += dt
		if elapsed >= 0.1 then
			elapsed = 0
			UI.refreshBindings()
		end
	end)
	local camera = Workspace.CurrentCamera
	if camera then
		camera:GetPropertyChangedSignal("ViewportSize"):Connect(function()
			App.render()
		end)
	end
end

return App
