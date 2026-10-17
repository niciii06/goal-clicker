--!nonstrict
-- Toasts, full screen announcements (events, Fabrizio, Gazette, red cards, standings),
-- the pack walkout and short sound effects.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")

local Cards = require(ReplicatedStorage.Shared.Cards)
local Season = require(ReplicatedStorage.Shared.Season)
local State = require(script.Parent.State)
local Theme = require(script.Parent.Theme)
local UI = require(script.Parent.UI)
local Util = require(ReplicatedStorage.Shared.Util)

local C = Theme.colors
local Overlays = {}

local root: ScreenGui
local toastStack: Frame
local layer: Frame
local queue: { () -> () } = {}
local showing = false
local appCtx: any = nil

local SOUNDS = {
	click = { id = "rbxasset://sounds/clickfast.wav", volume = 0.25 },
	critical = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.45 },
	buy = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.35 },
	reward = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.5 },
	goal = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.6 },
	whistle = { id = "rbxasset://sounds/button.wav", volume = 0.6 },
	reveal = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.6 },
}

function Overlays.sound(name: string, pitch: number?)
	local core = State.core()
	if core.sound == false then
		return
	end
	local entry = SOUNDS[name]
	if not entry then
		return
	end
	local sound = Instance.new("Sound")
	sound.SoundId = entry.id
	sound.Volume = entry.volume
	sound.PlaybackSpeed = pitch or 1
	sound.Parent = SoundService
	SoundService:PlayLocalSound(sound)
	task.delay(3, function()
		sound:Destroy()
	end)
end

function Overlays.toast(text: string, success: boolean?)
	if not toastStack then
		return
	end
	local item = UI.new("TextLabel", {
		BackgroundColor3 = success == false and C.red or C.text,
		TextColor3 = C.white,
		Font = Theme.fonts.bold,
		TextSize = 15,
		TextWrapped = true,
		Text = text,
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, 0),
		BackgroundTransparency = 1,
		TextTransparency = 1,
		Parent = toastStack,
	}, { UI.corner(12), UI.padding(10, 14) })
	UI.tween(item, 0.2, { BackgroundTransparency = 0.05, TextTransparency = 0 })
	task.delay(2.4, function()
		UI.tween(item, 0.3, { BackgroundTransparency = 1, TextTransparency = 1 })
		task.delay(0.35, function()
			item:Destroy()
		end)
	end)
end

-- Queue so announcements never cover each other.
local function present(build: (close: () -> ()) -> ())
	table.insert(queue, function()
		showing = true
		local closed = false
		local function close()
			if closed then
				return
			end
			closed = true
			UI.clear(layer)
			layer.Visible = false
			showing = false
			local nextItem = table.remove(queue, 1)
			if nextItem then
				nextItem()
			end
		end
		UI.clear(layer)
		layer.Visible = true
		build(close)
	end)
	if not showing then
		local item = table.remove(queue, 1)
		if item then
			item()
		end
	end
end

local function sheet(children: { Instance? }, accent: Color3?, close: () -> (), dark: boolean?): Frame
	local frame = UI.card(children, { color = dark and C.darkCard or C.card, padding = 22, gap = 12, width = UDim.new(1, 0) })
	frame.AnchorPoint = Vector2.new(0.5, 0.5)
	frame.Position = UDim2.fromScale(0.5, 0.5)
	UI.new("UISizeConstraint", { MaxSize = Vector2.new(520, 760), Parent = frame })
	if accent then
		UI.new("Frame", { BackgroundColor3 = accent, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 5), LayoutOrder = -100, Parent = frame }, { UI.corner(999) })
	end
	local scale = UI.new("UIScale", { Scale = 0.85, Parent = frame })
	UI.tween(scale, 0.25, { Scale = 1 }, Enum.EasingStyle.Back)
	frame.Parent = layer
	return frame
end

local function closeButton(text: string, close: () -> ()): TextButton
	return UI.button(text, { style = "dark", onClick = close })
end

function Overlays.event(event: any)
	present(function(close)
		local tone = Theme.tone[event.tone] or C.muted
		sheet({
			UI.eyebrow(event.id == "var" and "VAR / VIDEOBEWEIS" or event.id == "elefantino" and "SKANDAL" or "CLUB EREIGNIS", tone),
			UI.title(event.title, 26),
			UI.label(event.message, { size = 16, color = C.muted }),
			UI.label((event.amount >= 0 and "+" or "-") .. Util.formatNumber(math.abs(event.amount)) .. " Tore", { size = 28, font = Theme.fonts.black, color = tone }),
			closeButton("Weiter", close),
		}, tone, close)
		Overlays.sound(event.tone == "negative" and "whistle" or "reward")
	end)
end

function Overlays.transfer(event: any)
	if State.now() - event.createdAt > 30000 then
		return
	end
	present(function(close)
		local tone = event.outcome == "sale" and C.red or event.outcome == "loan" and C.accent or event.outcome == "return" and C.green or C.muted
		sheet({
			UI.eyebrow("FABRIZIO ROMARIO / BREAKING", tone),
			UI.title(event.headline, 28),
			UI.label(event.message, { size = 16, color = C.muted }),
			event.fee > 0 and UI.pill("+" .. Util.formatNumber(event.fee) .. " Tore Ablöse", C.green, C.white) or nil,
			UI.label("Grund: " .. (event.reason ~= "" and event.reason or "-"), { size = 13, color = C.faint }),
			closeButton("Here we go", close),
		}, tone, close)
	end)
end

function Overlays.gazette(issue: any)
	present(function(close)
		local champion = issue.tone == "champion"
		local club = State.features("club")
		sheet({
			UI.row({ UI.label("GOAL GAZETTE", { size = 13, font = Theme.fonts.black, inline = true }), UI.pill("SONDERAUSGABE", champion and C.gold or C.text, C.white) }, 10),
			UI.label(("%s %d:%d %s"):format(club and club.name or "Dein Club", issue.homeScore, issue.awayScore, issue.opponent), { size = 14, color = C.muted, font = Theme.fonts.bold }),
			UI.label(issue.headline, { size = 30, font = Theme.fonts.black }),
			UI.label(issue.strapline, { size = 17, font = Theme.fonts.bold }),
			UI.label(issue.body, { size = 15, color = C.muted }),
			UI.label(issue.tieBreak and "ENTSCHEIDUNG IM ELFMETERSCHIESSEN" or "", { size = 11, color = C.faint, font = Theme.fonts.bold }),
			closeButton("Zeitung schliessen", close),
		}, champion and C.gold or C.red, close)
	end)
end

function Overlays.redCard(event: any)
	present(function(close)
		sheet({
			UI.label("🟥", { size = 54, align = Enum.TextXAlignment.Center }),
			UI.title(("Rote Karte · %d′"):format(event.minute), 26),
			UI.label(("%s · %s"):format(event.player, event.reason), { size = 16, color = C.muted }),
			UI.label(event.side == "home" and "Dein Team spielt in Unterzahl. Der Spieler ist für die nächste Partie gesperrt." or "Der Gegner spielt in Unterzahl.", { size = 14 }),
			closeButton("Weiter", close),
		}, C.red, close)
		task.delay(5, close)
	end)
end

function Overlays.achievement(achievement: any)
	Overlays.toast(("Erfolg: %s · %s"):format(achievement.name, achievement.description), true)
	Overlays.sound("reward", 1.2)
end

function Overlays.standings(entry: any, tableRows: { any })
	present(function(close)
		local outcome = entry.seasonOutcome == "promoted" and "AUFSTIEG" or entry.seasonOutcome == "relegated" and "ABSTIEG" or entry.seasonOutcome == "hall-of-fame" and "HALL OF FAME"
			or entry.seasonOutcome == "stayed" and "KLASSENERHALT" or entry.outcome == "win" and "SIEG" or entry.outcome == "loss" and "NIEDERLAGE" or "REMIS"
		local color = (entry.outcome == "win" or entry.seasonOutcome == "promoted" or entry.seasonOutcome == "hall-of-fame") and C.green or (entry.outcome == "loss" or entry.seasonOutcome == "relegated") and C.red or C.muted
		local sorted = Season.sortTable(tableRows)
		local position = Util.findIndex(sorted, function(team)
			return team.id == "club"
		end)
		local rows = {}
		for index, team in sorted do
			local diff = team.goalsFor - team.goalsAgainst
			table.insert(rows, UI.row({
				UI.label(tostring(index), { size = 13, font = Theme.fonts.bold, width = UDim.new(0, 22) }),
				UI.label(team.name, { size = 13, font = team.id == "club" and Theme.fonts.black or Theme.fonts.medium, width = UDim.new(1, -170) }),
				UI.label(("%d SP · %d-%d-%d"):format(team.played, team.wins, team.draws, team.losses), { size = 12, color = C.muted, width = UDim.new(0, 90) }),
				UI.label((diff > 0 and "+" or "") .. diff, { size = 12, color = diff > 0 and C.green or diff < 0 and C.red or C.muted, width = UDim.new(0, 26) }),
				UI.label(tostring(team.points), { size = 13, font = Theme.fonts.black, width = UDim.new(0, 26), align = Enum.TextXAlignment.Right }),
			}, 4))
		end
		local children = {
			UI.eyebrow(("Saison / Spieltag %d · %s"):format(entry.matchday, Season.divisionLabel(entry.division)), color),
			UI.row({ UI.label(("%d:%d"):format(entry.clubScore, entry.opponentScore), { size = 40, font = Theme.fonts.black, inline = true }), UI.pill(outcome, color, C.white) }, 12),
			UI.label("gegen " .. entry.opponent, { size = 14, color = C.muted }),
			UI.label(("%d. PLATZ · %s"):format(position, entry.completedSeason and "SAISON BEENDET" or "TABELLE AKTUALISIERT"), { size = 12, font = Theme.fonts.bold, color = C.muted }),
		}
		for _, item in rows do
			table.insert(children, item)
		end
		table.insert(children, closeButton("Weiter", close))
		sheet(children, color, close)
		task.delay(8.5, close)
	end)
end

------------------------------------------------------------------------------------------
-- Pack walkout

local FLAG_FALLBACK = { EN = "🏴", SC = "🏴", WA = "🏴", NI = "🇬🇧" }

local function flag(code: string?): string
	if not code then
		return "🏳️"
	end
	if FLAG_FALLBACK[code] then
		return FLAG_FALLBACK[code]
	end
	local first, second = string.byte(code, 1, 2)
	if not first or not second then
		return "🏳️"
	end
	return utf8.char(0x1F1E6 + first - 65, 0x1F1E6 + second - 65)
end
Overlays.flag = flag

local function figure(look: any, parent: Instance): Frame
	local holder = UI.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(120, 230), AnchorPoint = Vector2.new(0.5, 1), Parent = parent })
	local scale = look.height or 1
	local build = look.build or 1
	local skin = Theme.color(look.skin)
	local function shape(name: string, size: UDim2, position: UDim2, color: Color3, radius: number?)
		return UI.new("Frame", { Name = name, BackgroundColor3 = color, BorderSizePixel = 0, Size = size, Position = position, AnchorPoint = Vector2.new(0.5, 0), Parent = holder }, { UI.corner(radius or 6) })
	end
	local width = math.floor(54 * build)
	shape("Head", UDim2.fromOffset(38, 42), UDim2.new(0.5, 0, 0, 14 / scale), skin, 19)
	if look.hair ~= "bald" then
		shape("Hair", UDim2.fromOffset(40, look.hair == "afro" and 22 or 12), UDim2.new(0.5, 0, 0, (look.hair == "afro" and 4 or 10) / scale), Theme.color(look.hairColor), 12)
	end
	shape("Shirt", UDim2.fromOffset(width, 70), UDim2.new(0.5, 0, 0, 58), Theme.color(look.kitPrimary), 12)
	shape("ArmLeft", UDim2.fromOffset(14, 62), UDim2.new(0.5, -width / 2 - 8, 0, 62), skin, 7)
	shape("ArmRight", UDim2.fromOffset(14, 62), UDim2.new(0.5, width / 2 + 8, 0, 62), skin, 7)
	shape("Shorts", UDim2.fromOffset(width - 4, 30), UDim2.new(0.5, 0, 0, 126), Theme.color(look.kitSecondary), 6)
	shape("LegLeft", UDim2.fromOffset(16, 58), UDim2.new(0.5, -11, 0, 154), skin, 6)
	shape("LegRight", UDim2.fromOffset(16, 58), UDim2.new(0.5, 11, 0, 154), skin, 6)
	shape("BootLeft", UDim2.fromOffset(22, 12), UDim2.new(0.5, -13, 0, 210), Theme.color(look.boots), 5)
	shape("BootRight", UDim2.fromOffset(22, 12), UDim2.new(0.5, 13, 0, 210), Theme.color(look.boots), 5)
	return holder
end

function Overlays.playerCard(player: Cards.Player, compact: boolean?): Frame
	local accent = Theme.color(player.accent)
	local tierColor = Theme.tierColor(player.tier)
	local card = UI.box({ color = C.card, padding = compact and 10 or 16, gap = compact and 4 or 8, width = UDim.new(1, 0), stroke = true, strokeColor = tierColor, radius = 16 }, {
		UI.row({
			UI.label(tostring(player.rating), { size = compact and 26 or 44, font = Theme.fonts.black, color = Theme.readable(player.accent), inline = true }),
			UI.box({ width = UDim.new(1, compact and -50 or -70) }, {
				UI.label(player.name, { size = compact and 15 or 22, font = Theme.fonts.black }),
				UI.label(flag(player.countryCode) .. "  " .. Cards.positionLabel(player), { size = compact and 12 or 14, color = C.muted }),
			}),
		}, 10),
		not compact and UI.row({
			UI.pill(string.upper(player.tier == "standard" and "Basis" or player.tier), tierColor, C.white),
			player.isCustom and UI.pill("CUSTOM", C.purple, C.white) or nil,
			player.cardType == "icon" and UI.pill("ICON", C.text, C.white) or nil,
		}, 6) or nil,
	})
	UI.new("Frame", { BackgroundColor3 = accent, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 4), LayoutOrder = -1, Parent = card }, { UI.corner(999) })
	return card
end

local function confetti(parent: Instance, colors: { Color3 })
	for index = 1, 46 do
		local piece = UI.new("Frame", {
			BackgroundColor3 = colors[(index % #colors) + 1],
			BorderSizePixel = 0,
			Size = UDim2.fromOffset(8, 14),
			Position = UDim2.new(((index * 37) % 101) / 100, 0, -0.05, 0),
			Rotation = index * 23,
			Parent = parent,
		})
		task.delay((index % 12) * 0.045, function()
			UI.tween(piece, 2.3 + (index % 7) * 0.18, { Position = UDim2.new(piece.Position.X.Scale, 0, 1.05, 0), Rotation = piece.Rotation + 360 }, Enum.EasingStyle.Linear)
		end)
	end
end

-- Pack opening: quick card for standard picks, a sweep for rare cards and the full walkout
-- (flag, position, rating, then the player) for walkouts, icons and legendary cards.
function Overlays.reveal(reveal: any)
	local player = Cards.get(reveal.playerId)
	if not player then
		return
	end
	present(function(close)
		local tier = player.tier
		local walkout = tier == "walkout" or tier == "icon" or tier == "legendary"
		local stage = UI.new("Frame", { BackgroundColor3 = C.dark, Size = UDim2.fromScale(1, 1), Parent = layer, ClipsDescendants = true })
		local glow = UI.new("Frame", {
			BackgroundColor3 = Theme.tierColor(tier), BackgroundTransparency = 0.75, AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.5, 0.55), Size = UDim2.fromOffset(40, 40), Parent = stage,
		}, { UI.corner(999) })
		local headline = UI.label(("%s / %s"):format(reveal.source == "custom-draw" and "ZUFALLSZUG" or "PACK GEÖFFNET", string.upper(reveal.packName or "")), { size = 13, color = C.faint, font = Theme.fonts.bold, align = Enum.TextXAlignment.Center })
		headline.Position = UDim2.fromOffset(0, 70)
		headline.Parent = stage
		local center = UI.label("", { size = 64, font = Theme.fonts.black, color = C.white, align = Enum.TextXAlignment.Center })
		center.AnchorPoint = Vector2.new(0, 0.5)
		center.Position = UDim2.fromScale(0, 0.32)
		center.Parent = stage
		local cardHolder = UI.box({ width = UDim.new(1, -40) })
		cardHolder.AnchorPoint = Vector2.new(0.5, 0)
		cardHolder.Position = UDim2.new(0.5, 0, 0.6, 0)
		UI.new("UISizeConstraint", { MaxSize = Vector2.new(420, math.huge), Parent = cardHolder })
		cardHolder.Parent = stage
		local function showCard()
			UI.clear(cardHolder)
			local card = Overlays.playerCard(player)
			card.Parent = cardHolder
			local result = reveal.duplicate and ("Doppelt · +%s Fragmente"):format(Util.formatNumber(reveal.fragmentCompensation)) or "Neu im Kader"
			UI.label(result, { size = 15, font = Theme.fonts.bold, color = reveal.duplicate and C.goldLight or C.greenLight, align = Enum.TextXAlignment.Center }).Parent = cardHolder
			UI.button("Weiter", { style = "primary", onClick = close }).Parent = cardHolder
			Overlays.sound("reveal", walkout and 1.3 or 1)
		end
		UI.button("Überspringen", { style = "secondary", width = UDim.new(0, 140), height = 32, size = 13, onClick = close }).Parent = UI.new("Frame", {
			BackgroundTransparency = 1, Position = UDim2.new(1, -160, 0, 60), Size = UDim2.fromOffset(150, 40), Parent = stage,
		})
		if not walkout then
			UI.tween(glow, tier == "rare" and 1.4 or 0.5, { Size = UDim2.fromOffset(900, 900), BackgroundTransparency = 0.9 })
			task.delay(tier == "rare" and 1.4 or 0.4, showCard)
			return
		end
		local steps = {}
		if reveal.troll then
			table.insert(steps, function()
				center.Text = "🫣 47"
				center.TextColor3 = C.faint
			end)
		end
		table.insert(steps, function()
			center.TextColor3 = C.white
			center.Text = flag(player.countryCode)
			UI.tween(glow, 1.2, { Size = UDim2.fromOffset(500, 500) })
		end)
		table.insert(steps, function()
			center.Text = Cards.positionLabel(player, true)
		end)
		table.insert(steps, function()
			center.Text = tostring(player.rating)
			center.TextColor3 = Theme.tierColor(tier)
			UI.tween(glow, 1, { Size = UDim2.fromOffset(1100, 1100), BackgroundTransparency = 0.85 })
		end)
		table.insert(steps, function()
			center.Text = ""
			local body = figure(player.look or {}, stage)
			body.Position = UDim2.new(-0.2, 0, 0.58, 0)
			UI.tween(body, 1.4, { Position = UDim2.new(0.5, 0, 0.58, 0) }, Enum.EasingStyle.Quint)
			if tier == "legendary" or player.rating >= 90 then
				confetti(stage, { Color3.fromHex("#ffe28d"), Color3.fromHex("#f6c94c"), Color3.fromHex("#fff4bd"), Color3.fromHex("#d49b19") })
			elseif tier == "icon" then
				confetti(stage, { Color3.fromHex("#ffffff"), Color3.fromHex("#dfe5ec"), Color3.fromHex("#aeb7c2") })
			end
			task.delay(1.6, function()
				body:Destroy()
				showCard()
			end)
		end)
		local delayEach = player.rating >= 90 and 2.2 or 1.6
		for index, step in steps do
			task.delay((index - 1) * delayEach + 0.4, function()
				if stage.Parent then
					step()
				end
			end)
		end
	end)
end

------------------------------------------------------------------------------------------

function Overlays.handle(notice: any)
	local kind = notice.kind
	if kind == "toast" then
		Overlays.toast(notice.text, true)
	elseif kind == "event" then
		Overlays.event(notice.event)
	elseif kind == "transfer" then
		Overlays.transfer(notice.event)
	elseif kind == "gazette" then
		Overlays.gazette(notice.issue)
	elseif kind == "redCard" then
		Overlays.redCard(notice.event)
	elseif kind == "achievement" then
		Overlays.achievement(notice.achievement)
	elseif kind == "standings" then
		Overlays.standings(notice.entry, notice.table)
	elseif kind == "reveal" then
		Overlays.reveal(notice.reveal)
	elseif kind == "sound" then
		Overlays.sound(notice.name)
	elseif kind == "matchGoal" then
		local goal = notice.goal
		Overlays.toast(("⚽ %s trifft in der %d. Minute"):format(goal.scorer, goal.minute), goal.side == "home")
		Overlays.sound("goal", goal.side == "home" and 1.2 or 0.8)
	elseif kind == "matchStart" then
		Overlays.sound("whistle")
		if appCtx then
			appCtx.navigate("matches")
		end
	elseif kind == "matchEnd" then
		Overlays.sound("whistle", 0.9)
	elseif kind == "feed" then
		-- The feed is shown on the home screen through the history; nothing to present.
		return
	end
end

function Overlays.mount(gui: ScreenGui, ctx: any)
	root = gui
	appCtx = ctx
	layer = UI.new("Frame", { Name = "Overlay", BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.35, Size = UDim2.fromScale(1, 1), Visible = false, ZIndex = 50, Parent = root }, { UI.padding(16) })
	toastStack = UI.new("Frame", {
		Name = "Toasts", BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -18),
		Size = UDim2.new(1, -32, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, ZIndex = 60, Parent = root,
	}, { UI.list(Enum.FillDirection.Vertical, 6, Enum.HorizontalAlignment.Center, Enum.VerticalAlignment.Bottom), UI.new("UISizeConstraint", { MaxSize = Vector2.new(480, math.huge) }) })
end

return Overlays
