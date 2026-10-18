--!nonstrict
-- Home: rank, the ball with combo and floating goals, production, daily reward,
-- mini games and the upgrade shop.
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Shared = ReplicatedStorage.Shared
local Daily = require(Shared.Daily)
local Economy = require(Shared.Economy)
local MiniGames = require(Shared.MiniGames)
local Util = require(Shared.Util)

local Client = script.Parent.Parent
local Invite = require(Client.Invite)
local Net = require(Client.Net)
local Overlays = require(Client.Overlays)
local Robux = require(Client.Robux)
local State = require(Client.State)
local Theme = require(Client.Theme)
local UI = require(Client.UI)

local C = Theme.colors
local Home = {}

Home.sections = { "core", "miniGame", "dailyRewards", "coop", "seasonMode", "shop" }

local shopTab = "all"
local purchaseMode: any = 1
local combo = { count = 0, last = 0 }
local stage: Frame? = nil
local ballButton: TextButton? = nil
local lastClickPosition = Vector2.new(0.5, 0.45)
local currentCtx: any = nil

local function miniGameState(): any
	return State.features("miniGame")
end

function Home.signature(): string
	local core = State.core()
	local daily = Daily.status(State.features("dailyRewards") or {}, "solo", State.now())
	return table.concat({
		tostring(core.seasons), tostring(core.stars), tostring(#(core.achievements or {})), tostring((State.features("seasonMode") or {}).lastMatchAt), tostring(core.testMode), daily.today, tostring(daily.available),
		HttpService:JSONEncode(miniGameState() or false), shopTab, tostring(purchaseMode),
		HttpService:JSONEncode(core.shopCredits or false), tostring((State.features("shop") or {}).restricted),
	}, "|")
end

local function comboLevel(): any
	if os.clock() * 1000 - combo.last > Economy.COMBO_WINDOW_MS + 50 then
		combo.count = 0
	end
	return Economy.comboLevel(combo.count)
end

-- Floating "+123" at the click position, shown when the server confirms the click.
function Home.onClickResult(amount: number, critical: boolean, multiplier: number)
	State.addLocalGoals(amount)
	if critical then
		Overlays.sound("critical", 1.3)
	end
	if not stage or not stage.Parent then
		return
	end
	local text = UI.new("TextLabel", {
		BackgroundTransparency = 1,
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(lastClickPosition.X, lastClickPosition.Y),
		Size = UDim2.fromOffset(200, 40),
		Font = Theme.fonts.black,
		TextSize = critical and 30 or 24,
		TextColor3 = critical and C.goldLight or multiplier >= 3 and C.redLight or multiplier == 2 and C.goldLight or C.white,
		TextStrokeTransparency = 0.4,
		Text = (critical and "CRIT! +" or "+") .. Util.formatNumber(amount),
		ZIndex = 5,
		Parent = stage,
	})
	UI.tween(text, 0.85, { Position = UDim2.fromScale(lastClickPosition.X, lastClickPosition.Y - 0.3), TextTransparency = 1, TextStrokeTransparency = 1 })
	task.delay(0.9, function()
		text:Destroy()
	end)
end

local function clickBall()
	local now = os.clock() * 1000
	local previous = Economy.comboLevel(combo.count)
	combo.count = (now - combo.last <= Economy.COMBO_WINDOW_MS) and combo.count + 1 or 1
	combo.last = now
	local level = Economy.comboLevel(combo.count)
	if level.multiplier > previous.multiplier then
		Overlays.toast("COMBO x" .. level.multiplier, true)
		Overlays.sound("critical", level.multiplier == 3 and 1.5 or 1.2)
	end
	Overlays.sound("click", 0.9 + math.random() * 0.2)
	Net.click()
	if ballButton then
		local scale = ballButton:FindFirstChildOfClass("UIScale") or UI.new("UIScale", { Parent = ballButton })
		scale.Scale = 0.9
		UI.tween(scale, 0.18, { Scale = 1 }, Enum.EasingStyle.Back)
	end
	if stage then
		local mouse = UserInputService:GetMouseLocation()
		local position, size = stage.AbsolutePosition, stage.AbsoluteSize
		if size.X > 0 then
			lastClickPosition = Vector2.new(math.clamp((mouse.X - position.X) / size.X, 0.1, 0.9), math.clamp((mouse.Y - 58 - position.Y) / size.Y, 0.1, 0.9))
		end
	end
end

local function heroCard(ctx: any): Frame
	local core = State.core()
	local coop = ctx.isCoop()
	local rankLabel = UI.label("", { size = 15, font = Theme.fonts.black })
	UI.bind(rankLabel, "Text", function()
		local rank = Economy.rank(State.core().totalGoals or 0)
		return (Theme.icons[rank.icon] or "⭐") .. "  " .. rank.name
	end)
	local progress = UI.progress(0, C.accent)
	local fill = progress:FindFirstChild("Fill") :: Frame
	UI.bind(fill, "Size", function()
		local total = State.core().totalGoals or 0
		local rank, nextRank = Economy.rank(total)
		if not nextRank then
			return UDim2.fromScale(1, 1)
		end
		return UDim2.fromScale(math.clamp((total - rank.minimum) / (nextRank.minimum - rank.minimum), 0, 1), 1)
	end)
	local nextLabel = UI.label("", { size = 12, color = C.muted })
	UI.bind(nextLabel, "Text", function()
		local total = State.core().totalGoals or 0
		local _, nextRank = Economy.rank(total)
		return nextRank and ("Nächster Rang: %s bei %s Toren insgesamt"):format(nextRank.name, Util.formatNumber(nextRank.minimum)) or "Höchster Rang erreicht"
	end)
	local score = UI.label("0", { size = 48, font = Theme.fonts.black })
	UI.bind(score, "Text", function()
		return core.testMode and "∞" or Util.formatNumber(State.liveGoals())
	end)
	local perClick = UI.label("", { size = 14, color = C.accent, font = Theme.fonts.bold })
	UI.bind(perClick, "Text", function()
		return ("+%s %s"):format(Util.formatNumber(State.core().clickPower or 1), coop and "pro Team-Klick" or "pro Klick")
	end)
	return UI.card({
		UI.eyebrow(coop and "Co-op Career / Live Match" or "Career Mode / 01"),
		UI.title(coop and "Gemeinsam zum Sieg." or "Build your football empire.", 26),
		UI.label(coop and "Bis zu vier Spieler. Ein gemeinsamer Club." or "Ein Klick. Ein Tor. Eine völlig übertriebene Karriere.", { size = 14, color = C.muted }),
		UI.box({ color = C.cardAlt, padding = 12, gap = 6 }, { UI.eyebrow(coop and "Team Rang" or "Dein Rang"), rankLabel, progress, nextLabel }),
		UI.eyebrow(coop and "Gemeinsame Tore" or "Deine Tore"),
		score,
		perClick,
	})
end

local function ballStage(): Frame
	local frame = UI.new("Frame", {
		Name = "BallStage",
		BackgroundColor3 = C.pitch,
		Size = UDim2.new(1, 0, 0, 320),
		ClipsDescendants = true,
	}, { UI.corner(18) })
	-- Pitch markings.
	UI.new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(190, 190), Parent = frame }, { UI.corner(999), UI.stroke(Color3.new(1, 1, 1), 2, 0.6) })
	UI.new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.6, BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0), Size = UDim2.new(0, 2, 1, 0), Parent = frame })
	UI.new("TextLabel", { BackgroundTransparency = 1, Position = UDim2.fromOffset(14, 10), Size = UDim2.fromOffset(260, 20), Font = Theme.fonts.bold, TextSize = 11, TextColor3 = Color3.new(1, 1, 1), TextTransparency = 0.3, TextXAlignment = Enum.TextXAlignment.Left, Text = "GOAL CLICKER ARENA", Parent = frame })
	local button = UI.new("TextButton", {
		Name = "Ball",
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.47),
		Size = UDim2.fromOffset(170, 170),
		BackgroundColor3 = Color3.new(1, 1, 1),
		Text = "⚽",
		TextScaled = true,
		Font = Theme.fonts.black,
		AutoButtonColor = false,
		Parent = frame,
		Activated = clickBall,
	}, { UI.corner(999), UI.stroke(Color3.fromRGB(20, 20, 20), 3, 0.2), UI.padding(6) })
	ballButton = button
	local hint = UI.new("TextLabel", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -54), Size = UDim2.new(1, 0, 0, 20), Font = Theme.fonts.bold, TextSize = 14, TextColor3 = Color3.new(1, 1, 1), Text = "CLICK den Ball für Tore", Parent = frame })
	hint.TextTransparency = 0.1
	local meter = UI.new("Frame", { BackgroundColor3 = C.dark, BackgroundTransparency = 0.25, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -10), Size = UDim2.new(0.8, 0, 0, 36), Parent = frame }, { UI.corner(10), UI.padding(5, 10) })
	local meterLabel = UI.new("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(0.5, 0, 1, 0), Font = Theme.fonts.bold, TextSize = 13, TextColor3 = Color3.new(1, 1, 1), TextXAlignment = Enum.TextXAlignment.Left, Text = "Schnell klicken für Combo", Parent = meter })
	local track = UI.new("Frame", { BackgroundColor3 = Color3.fromRGB(70, 70, 75), BorderSizePixel = 0, AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, 0, 0.5, 0), Size = UDim2.new(0.45, 0, 0, 8), Parent = meter }, { UI.corner(999) })
	local trackFill = UI.new("Frame", { BackgroundColor3 = C.goldLight, BorderSizePixel = 0, Size = UDim2.fromScale(0, 1), Parent = track }, { UI.corner(999) })
	UI.bind(meterLabel, "Text", function()
		local level = comboLevel()
		if level.multiplier > 1 then
			return "COMBO x" .. level.multiplier
		end
		return combo.count > 1 and (combo.count .. " Klicks") or "Schnell klicken für Combo"
	end)
	UI.bind(trackFill, "Size", function()
		local level = comboLevel()
		local nextLevel = nil
		for _, item in Economy.COMBO_LEVELS do
			if item.clicks > combo.count then
				nextLevel = item
				break
			end
		end
		if not nextLevel then
			return UDim2.fromScale(1, 1)
		end
		return UDim2.fromScale((combo.count - level.clicks) / (nextLevel.clicks - level.clicks), 1)
	end)
	UI.bind(button, "BackgroundColor3", function()
		local level = comboLevel()
		return level.multiplier == 3 and Color3.fromRGB(255, 220, 220) or level.multiplier == 2 and Color3.fromRGB(255, 245, 205) or Color3.new(1, 1, 1)
	end)
	stage = frame
	return frame
end

local function stat(caption: string, compute: () -> string): Frame
	local value = UI.label("", { size = 18, font = Theme.fonts.black })
	UI.bind(value, "Text", compute)
	return UI.box({ color = C.cardAlt, padding = 10, gap = 2 }, { UI.eyebrow(caption), value })
end

local function productionStrip(): Frame
	return UI.columns({
		stat("Pro Sekunde", function()
			return Util.formatNumber(State.core().passivePower or 0)
		end),
		stat("Pro Klick", function()
			return Util.formatNumber(State.core().clickPower or 1)
		end),
		stat("Klicks", function()
			return Util.formatNumber(State.core().clicks or 0)
		end),
	}, 8)
end

local function dailyCard(ctx: any): Frame
	local coop = State.features("coop")
	local key = "solo"
	if coop then
		for _, member in coop.players do
			if member.userId == game:GetService("Players").LocalPlayer.UserId then
				key = member.role
			end
		end
	end
	local status = Daily.status(State.features("dailyRewards") or {}, key, State.now())
	local days = {}
	for index, day in Daily.DAYS do
		local done = (status.claimedToday and index <= status.dayIndex) or (not status.claimedToday and index < status.dayIndex)
		local today = index == status.dayIndex
		table.insert(days, UI.box({ color = today and C.accent or done and C.green or C.cardAlt, padding = 6, gap = 0, radius = 8 }, {
			UI.label("Tag " .. index, { size = 11, font = Theme.fonts.bold, color = (today or done) and C.white or C.muted, align = Enum.TextXAlignment.Center }),
			UI.label(day.pack and "🎁" or "⚽", { size = 16, align = Enum.TextXAlignment.Center }),
		}))
	end
	local countdown = UI.label("", { size = 13, color = C.muted })
	UI.bind(countdown, "Text", function()
		local fresh = Daily.status(State.features("dailyRewards") or {}, key, State.now())
		if fresh.available then
			return ("Serie: %d %s · Belohnung: %s"):format(fresh.streak, fresh.streak == 1 and "Tag" or "Tage", fresh.reward.label)
		end
		local seconds = math.floor(fresh.msUntilNext / 1000)
		return ("Nächste Prämie in %02d:%02d:%02d"):format(seconds // 3600, (seconds % 3600) // 60, seconds % 60)
	end)
	return UI.card({
		UI.eyebrow("Tägliche Prämie" .. (ctx.isCoop() and " · pro Spieler" or "")),
		UI.title(status.available and ("Tag %d bereit"):format(status.dayIndex) or "Heute abgeholt", 20),
		countdown,
		UI.columns(days, 4),
		status.broken and UI.label("Die Serie wurde unterbrochen und beginnt wieder bei Tag 1.", { size = 12, color = C.red }) or nil,
		UI.button(status.available and "Prämie abholen" or "Morgen wieder", { style = status.available and "success" or "secondary", disabled = not status.available, onClick = function()
			Net.action("claimDaily")
		end }),
	})
end

local GAME_LABELS = {
	penalty = { icon = "🥅", info = "5 Schüsse · Präzision" },
	dribble = { icon = "👟", info = "Muster · Ballkontrolle" },
	crossbar = { icon = "🏟️", info = "5 Versuche · Timing" },
	prediction = { icon = "📡", info = "3 Tipps · Glück" },
}

local CHOICE_LABELS = {
	links = "← Links", mitte = "↑ Mitte", rechts = "Rechts →", hoch = "Hoch", tief = "Tief",
	heim = "Heimsieg", remis = "Remis", ["auswärts"] = "Auswärtssieg",
}

local function miniGameHub(): Frame
	local cards = {}
	for index, id in MiniGames.IDS do
		local info = GAME_LABELS[id]
		local label = UI.label("", { size = 12, color = C.muted })
		UI.bind(label, "Text", function()
			local untilAt = (State.core().miniGameCooldowns or {})[id] or 0
			return untilAt > State.now() and ("Bereit in " .. Util.formatCountdown(untilAt, State.now())) or info.info
		end)
		-- Only while this game cools down: the paid shortcut (or a stored credit).
		local ready = Robux.productButton("miniGameReady", "Sofort bereit", { height = 30, size = 12 })
		if ready then
			UI.bind(ready, "Visible", function()
				return ((State.core().miniGameCooldowns or {})[id] or 0) > State.now()
			end)
		end
		local card = UI.box({ color = C.cardAlt, padding = 12, gap = 4, radius = 12 }, {
			UI.label(info.icon .. "  MINIGAME / 0" .. index, { size = 11, font = Theme.fonts.bold, color = C.muted }),
			UI.label(MiniGames.NAMES[id], { size = 16, font = Theme.fonts.black }),
			label,
			UI.button("Starten", { height = 32, size = 13, onClick = function()
				Net.action("startMiniGame", { id = id })
			end }),
			ready,
		})
		table.insert(cards, card)
	end
	local grid = UI.box({ direction = Enum.FillDirection.Horizontal, gap = 8, wraps = true })
	for _, card in cards do
		card.Size = UDim2.new(0.5, -4, 0, 0)
		card.Parent = grid
	end
	return UI.card({ UI.eyebrow("Stadion / Arcade"), UI.title("Matchday Minigames", 20), grid })
end

local function miniGamePanel(game: any): Frame
	local id = game.id
	local progress, counter
	if id == "penalty" then
		progress, counter = game.shots / 5, ("%d / 5 Schüsse · %d Tore"):format(game.shots, game.goals)
	elseif id == "dribble" then
		progress, counter = game.step / #game.sequence, ("Schritt %d / %d · %d Fehler"):format(game.step, #game.sequence, game.misses)
	elseif id == "crossbar" then
		progress, counter = game.shots / 5, ("%d / 5 Schüsse · %d Treffer"):format(game.shots, game.hits)
	else
		progress, counter = game.round / 3, ("%d / 3 Tipps · %d richtig"):format(game.round, game.wins)
	end
	local children: { Instance? } = {
		UI.eyebrow("Minigame · " .. GAME_LABELS[id].info),
		UI.title(MiniGames.NAMES[id], 22),
		UI.label(counter, { size = 14, font = Theme.fonts.bold }),
		UI.progress(progress, C.green),
		UI.label(game.message, { size = 15, color = (game.lastOutcome == "save" or game.lastOutcome == "lost" or game.lastOutcome == "miss" or game.lastOutcome == "wrong") and C.red or C.text }),
	}
	if id == "dribble" then
		local steps = {}
		for index, direction in game.sequence do
			table.insert(steps, UI.pill(CHOICE_LABELS[direction] or direction, index <= game.step and C.green or index == game.step + 1 and C.accent or C.cardAlt, index <= game.step + 1 and C.white or C.text))
		end
		table.insert(children, UI.row(steps, 4, nil, true))
	end
	if not game.finished then
		local buttons = {}
		for _, choice in MiniGames.CHOICES[id] do
			table.insert(buttons, UI.button(CHOICE_LABELS[choice] or choice, { height = 46, onClick = function()
				Net.action("playMiniGame", { choice = choice }, true)
			end }))
		end
		table.insert(children, UI.columns(buttons, 8))
	else
		table.insert(children, UI.label(("+%s Tore Prämie"):format(Util.formatNumber(game.reward)), { size = 24, font = Theme.fonts.black, color = C.green }))
		table.insert(children, UI.button("Schliessen", { style = "dark", onClick = function()
			State.apply({ miniGame = false })
		end }))
	end
	return UI.card(children, { stroke = true, strokeColor = C.accent })
end

local function upgradeRow(upgrade: Economy.Upgrade): Frame
	local core = State.core()
	local unlockSeason = Economy.UNLOCK_SEASONS[upgrade.id] or 1
	local currentSeason = math.min(15, math.max(1, (core.seasons or 0) + 1))
	local locked = (core.upgrades[upgrade.id] or 0) == 0 and not core.testMode and currentSeason < unlockSeason
	local levelLabel = UI.label("", { size = 12, color = C.muted })
	UI.bind(levelLabel, "Text", function()
		local level = (State.core().upgrades or {})[upgrade.id] or 0
		return Economy.upgradeEffect(upgrade, level)
	end)
	local button = UI.button("", { width = UDim.new(0, 130), height = 46, size = 13, onClick = function()
		Net.action("buyUpgrade", { id = upgrade.id, mode = purchaseMode }, true)
	end })
	if locked then
		button.Text = "Saison " .. unlockSeason
		button.AutoButtonColor = false
		button.BackgroundColor3 = C.faint
	else
		UI.bind(button, "Text", function()
			local liveCore = State.core()
			local count, total = Economy.bulkPurchase(upgrade, liveCore.upgrades or {}, State.liveGoals(), purchaseMode, liveCore.testMode)
			if count == 0 then
				local cost = Economy.cost(upgrade, liveCore.upgrades or {})
				return cost == math.huge and "MAX" or Util.formatNumber(cost)
			end
			return (count > 1 and ("%dx · "):format(count) or "") .. Util.formatNumber(total)
		end)
		UI.bind(button, "BackgroundColor3", function()
			local liveCore = State.core()
			local count = Economy.bulkPurchase(upgrade, liveCore.upgrades or {}, State.liveGoals(), purchaseMode, liveCore.testMode)
			return count > 0 and C.accent or C.faint
		end)
	end
	local icon = UI.label(Theme.icons[upgrade.icon] or "⭐", { size = 24, width = UDim.new(0, 36), align = Enum.TextXAlignment.Center })
	return UI.box({ color = C.card, padding = 10, direction = Enum.FillDirection.Horizontal, gap = 10, valign = Enum.VerticalAlignment.Center, stroke = true, radius = 12 }, {
		icon,
		UI.box({ width = UDim.new(1, -190), gap = 2 }, {
			UI.label(upgrade.name .. (locked and "  🔒" or ""), { size = 15, font = Theme.fonts.bold }),
			UI.label(upgrade.description, { size = 12, color = C.accent }),
			levelLabel,
		}),
		button,
	})
end

local function shop(): Frame
	local tabs = UI.segmented({ { id = "all", label = "Alle" }, { id = "click", label = "Klick" }, { id = "auto", label = "Auto" }, { id = "multiplier", label = "Multi" } }, shopTab, function(id)
		shopTab = id
		currentCtx.refresh()
	end)
	local modes = UI.segmented({ { id = "1", label = "x1" }, { id = "10", label = "x10" }, { id = "100", label = "x100" }, { id = "max", label = "MAX" } }, tostring(purchaseMode), function(id)
		purchaseMode = id == "max" and "max" or tonumber(id)
		currentCtx.refresh()
	end)
	local children: { Instance? } = { UI.eyebrow("Verstärkungen / Shop"), UI.title("Upgrades", 22), tabs, modes }
	for _, upgrade in Economy.UPGRADES do
		if shopTab == "all" or upgrade.kind == shopTab then
			table.insert(children, upgradeRow(upgrade))
		end
	end
	return UI.card(children, { gap = 8 })
end

local Progression = require(Shared.Data.Progression) :: any
local Season = require(Shared.Season)

local function feedCard(): Frame
	local text = UI.label("", { size = 13 })
	UI.bind(text, "Text", function()
		local lines = {}
		for _, item in Overlays.feed do
			table.insert(lines, item.icon .. "  " .. item.text)
		end
		return table.concat(lines, "\n")
	end)
	return UI.card({ UI.eyebrow("Stadionfunk"), UI.title("Live aus dem Block", 18), text }, { gap = 6 })
end

local function seasonCard(): Frame
	local core = State.core()
	local seasonMode = State.features("seasonMode")
	local currentSeason = math.min(15, math.max(1, (core.seasons or 0) + 1))
	local milestone = Progression.seasonMilestones[currentSeason]
	local children = {
		UI.eyebrow(("Saisonmodus / %d von %d · ★ %d Vereinssterne"):format(currentSeason, #Progression.seasonMilestones, core.stars or 0)),
		UI.title(milestone.title, 18),
		UI.label(milestone.description .. " Jeder Vereinsstern gibt dauerhaft 2% auf alle Einnahmen.", { size = 12, color = C.muted }),
		UI.label("Aktiv: " .. table.concat(milestone.rewards, " · "), { size = 12, color = C.green, font = Theme.fonts.bold }),
		seasonMode and UI.label(("%s · %s"):format(Season.divisionLabel(seasonMode.division), seasonMode.lastResult), { size = 12 }) or nil,
		UI.eyebrow("Alle Saison Freischaltungen"),
	}
	for _, item in Progression.seasonMilestones do
		local done = item.season < currentSeason
		local now = item.season == currentSeason
		table.insert(children, UI.label(("%s %s · %s"):format(done and "✓" or now and "▶" or tostring(item.season), item.title, table.concat(item.rewards, " · ")), { size = 11, color = done and C.green or now and C.accent or C.muted, font = now and Theme.fonts.bold or Theme.fonts.regular }))
	end
	return UI.card(children, { gap = 4 })
end

local function achievementCard(): Frame
	local core = State.core()
	local unlocked = core.achievements or {}
	local children = { UI.eyebrow(("Erfolge · %d / %d"):format(#unlocked, #Economy.ACHIEVEMENTS)), UI.title("Pokalschrank", 18) }
	for _, achievement in Economy.ACHIEVEMENTS do
		local has = table.find(unlocked, achievement.id) ~= nil
		table.insert(children, UI.label(("%s %s · %s%s"):format(Theme.icons[achievement.icon] or "⭐", achievement.name, achievement.description, has and "  ✓" or ("  (" .. Util.formatNumber(achievement.threshold) .. ")")), { size = 12, color = has and C.text or C.faint, font = has and Theme.fonts.bold or Theme.fonts.regular }))
	end
	return UI.card(children, { gap = 4 })
end

local function coopBar(): Frame?
	local coop = State.features("coop")
	if not coop then
		return nil
	end
	local names = {}
	for _, member in coop.players do
		if member.occupied then
			table.insert(names, (member.online and "🟢 " or "⚪ ") .. Robux.name(member.name, member.vip))
		end
	end
	return UI.card({
		UI.eyebrow("Koop / " .. coop.roomName),
		UI.row({ UI.label(coop.code, { size = 24, font = Theme.fonts.black, inline = true }), UI.pill(("%d / %d SPIELER"):format(coop.playerCount, coop.maxPlayers), C.accent, C.white), UI.pill(coop.status == "live" and "LIVE" or "WARTET", coop.status == "live" and C.green or C.gold, C.white) }, 8),
		UI.label(table.concat(names, " · "), { size = 13, color = C.muted, rich = true }),
		coop.playerCount < coop.maxPlayers and UI.button("👥  Roblox Freunde einladen", { style = "primary", height = 38, size = 14, onClick = function()
			local ok, problem = Invite.friends(coop.code, coop.roomName)
			if not ok and problem then
				Overlays.toast(problem, false)
			end
		end }) or nil,
	}, { color = C.cardAlt })
end

function Home.render(container: Frame, ctx: any)
	currentCtx = ctx
	local bar = coopBar()
	if bar then
		bar.Parent = container
	end
	local phone = ctx.isPhone()
	local left = UI.box({ gap = 12, width = phone and UDim.new(1, 0) or UDim.new(0.5, -6) })
	local right = UI.box({ gap = 12, width = phone and UDim.new(1, 0) or UDim.new(0.5, -6) })
	heroCard(ctx).Parent = left
	ballStage().Parent = left
	productionStrip().Parent = left
	local boost = Robux.productButton("goalBoost", "⚡ Goalboost: 2x Tore für 15 Min", { height = 38, size = 14 })
	if boost then
		boost.Parent = left
	end
	dailyCard(ctx).Parent = left
	local game = miniGameState()
	if game then
		miniGamePanel(game).Parent = left
	else
		miniGameHub().Parent = left
	end
	shop().Parent = right
	feedCard().Parent = right
	seasonCard().Parent = right
	achievementCard().Parent = right
	local columns = UI.box({ direction = Enum.FillDirection.Horizontal, gap = 12, wraps = true }, { left, right })
	columns.Parent = container
end

return Home
