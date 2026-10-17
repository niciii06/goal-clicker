--!nonstrict
-- Renders the live match: positions are interpolated between the actions the server sends.
-- Two views: a 2D pitch inside the menu and a 3D broadcast on the stadium pitch.
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local MatchRatings = require(ReplicatedStorage.Shared.MatchRatings)
local State = require(script.Parent.State)
local Theme = require(script.Parent.Theme)
local UI = require(script.Parent.UI)

local C = Theme.colors
local MatchView = {}

local CELEBRATION_SHARE = 0.62

local function clamp(value: number, minimum: number, maximum: number): number
	return math.max(minimum, math.min(maximum, value))
end

local function ease(n: number): number
	local v = clamp(n, 0, 1)
	return v * v * (3 - 2 * v)
end

-- Player tuple from the server: { id, x, y, active, club, role, number, name }.
local function unpackPlayers(list: { any }): ({ any }, { [string]: any })
	local players, byId = {}, {}
	for _, tuple in list do
		local p = { id = tuple[1], x = tuple[2], y = tuple[3], active = tuple[4] == 1, club = tuple[5] == 1, role = tuple[6], number = tuple[7], name = tuple[8] }
		table.insert(players, p)
		byId[p.id] = p
	end
	return players, byId
end

-- Game time (0 to 7200 seconds) of the current view.
function MatchView.gameTime(): number
	local cup = State.features("cup")
	local match = State.features("match")
	if not cup or not match then
		return 0
	end
	local regular = MatchRatings.regularDurationMs(cup)
	local scale = 5400 / regular
	local actions = match.actions
	local earliest = actions[1] and actions[1].start or match.time
	local latest = (cup.matchPaused or not cup.active) and match.time or (actions[#actions] and actions[#actions].finish or match.time)
	return clamp((State.now() - cup.matchStartedAt) * scale, earliest, latest)
end

function MatchView.frame(): any?
	local match = State.features("match")
	if not match then
		return nil
	end
	local time = MatchView.gameTime()
	local actions = match.actions
	local action = nil
	for _, candidate in actions do
		if candidate.start <= time and candidate.finish >= time then
			action = candidate
			break
		end
	end
	if not action then
		local players = unpackPlayers(match.committed.players)
		return { players = players, ball = match.committed.ball, time = time }
	end
	local t = action.finish > action.start and clamp((time - action.start) / (action.finish - action.start), 0, 1) or 1
	local before = unpackPlayers(action.before)
	local _, after = unpackPlayers(action.after)
	local goal = nil
	if action.kind == "restart" then
		for _, candidate in actions do
			if candidate.finish == action.start and candidate.kind == "shot" and candidate.outcome == "goal" then
				goal = candidate
			end
		end
	end
	local players = {}
	if goal then
		local scorer = nil
		for _, p in before do
			if p.id == goal.actor then
				scorer = p
			end
		end
		local goalRight = goal.to.x > 52.5
		local corner = { x = goalRight and 101.2 or 3.8, y = ((scorer and scorer.y or 34) < 34) and 3.8 or 64.2 }
		local mateIndex = 0
		local back = ease((t - CELEBRATION_SHARE) / (1 - CELEBRATION_SHARE))
		local goalClub = goal.side == "club"
		for _, p in before do
			if p.active then
				local finish = after[p.id] or p
				local x, y
				if p.club ~= goalClub or p.role == "TW" then
					x, y = p.x + (finish.x - p.x) * ease(t), p.y + (finish.y - p.y) * ease(t)
				else
					local function party(u: number): (number, number)
						if p.id == goal.actor then
							local run = ease(u / 0.38)
							return p.x + (corner.x - p.x) * run, p.y + (corner.y - p.y) * run
						end
						local angle, radius = mateIndex * 2.4 + 0.6, 2.4 + (mateIndex % 3) * 1.3
						local sx = clamp(corner.x + math.cos(angle) * radius * (goalRight and -1 or 1), 1.5, 103.5)
						local sy = clamp(corner.y + math.abs(math.sin(angle)) * radius * (corner.y < 34 and 1 or -1), 1.5, 66.5)
						local run = ease(u / 0.5)
						return p.x + (sx - p.x) * run, p.y + (sy - p.y) * run
					end
					if p.id ~= goal.actor then
						mateIndex += 1
					end
					if t < CELEBRATION_SHARE then
						x, y = party(t)
					else
						local px, py = party(CELEBRATION_SHARE)
						x, y = px + (finish.x - px) * back, py + (finish.y - py) * back
					end
				end
				table.insert(players, { id = p.id, club = p.club, role = p.role, number = p.number, name = p.name, x = x, y = y })
			end
		end
		local ball = { x = action.from.x + (action.to.x - action.from.x) * back, y = action.from.y + (action.to.y - action.from.y) * back }
		return { players = players, ball = ball, action = action, time = time, celebration = { club = goalClub, scorer = goal.actor, progress = t } }
	end
	for _, p in before do
		if p.active then
			local finish = after[p.id] or p
			table.insert(players, { id = p.id, club = p.club, role = p.role, number = p.number, name = p.name, x = p.x + (finish.x - p.x) * t, y = p.y + (finish.y - p.y) * t })
		end
	end
	local ball = { x = action.from.x + (action.to.x - action.from.x) * t, y = action.from.y + (action.to.y - action.from.y) * t }
	return { players = players, ball = ball, action = action, time = time }
end

local ACTION_LABELS = {
	pass = "Pass", carry = "Dribbling", cross = "Flanke", interception = "Abgefangen", tackle = "Zweikampf", shot = "Schuss",
	restart = "Anstoss", red = "Rote Karte", yellow = "Gelbe Karte", injury = "Verletzung",
}

-- 2D pitch that animates itself until it is removed from the screen.
function MatchView.pitch(clubColor: Color3): Frame
	local holder = UI.new("Frame", { Name = "Pitch", BackgroundColor3 = C.pitch, Size = UDim2.new(1, 0, 0, 2000), ClipsDescendants = true }, {
		UI.corner(14),
		UI.new("UIAspectRatioConstraint", { AspectRatio = 105 / 68, DominantAxis = Enum.DominantAxis.Width }),
	})
	local lines = { { 0.5, 0, 0.003, 1 }, { 0, 0.21, 0.157, 0.58 }, { 0.843, 0.21, 0.157, 0.58 } }
	for _, line in lines do
		UI.new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromScale(line[1], line[2]), Size = UDim2.fromScale(line[3], line[4]), Parent = holder }, { UI.stroke(Color3.new(1, 1, 1), 1.5, 0.45) })
	end
	UI.new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromScale(0.17, 0.27), Parent = holder }, { UI.corner(999), UI.stroke(Color3.new(1, 1, 1), 1.5, 0.45) })
	local dots: { [string]: TextLabel } = {}
	local ball = UI.new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(9, 9), ZIndex = 4, Parent = holder }, { UI.corner(999), UI.stroke(Color3.new(0, 0, 0), 1) })
	local caption = UI.new("TextLabel", { BackgroundTransparency = 1, Position = UDim2.fromOffset(8, 4), Size = UDim2.new(1, -16, 0, 18), Font = Theme.fonts.bold, TextSize = 12, TextColor3 = Color3.new(1, 1, 1), TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 5, Text = "", Parent = holder })
	local celebrate = UI.new("TextLabel", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromScale(1, 0.3), Font = Theme.fonts.black, TextScaled = true, TextColor3 = C.goldLight, TextStrokeTransparency = 0.3, ZIndex = 6, Text = "", Parent = holder })
	local opponentColor = Color3.fromRGB(225, 60, 70)
	local connection: RBXScriptConnection? = nil
	connection = RunService.RenderStepped:Connect(function()
		if not holder.Parent then
			if connection then
				connection:Disconnect()
			end
			return
		end
		local frame = MatchView.frame()
		if not frame then
			return
		end
		local seen = {}
		for _, p in frame.players do
			seen[p.id] = true
			local dot = dots[p.id]
			if not dot then
				dot = UI.new("TextLabel", {
					BackgroundColor3 = p.club and clubColor or opponentColor, AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(18, 18),
					Font = Theme.fonts.black, TextSize = 10, TextColor3 = Color3.new(1, 1, 1), Text = tostring(p.number or ""), ZIndex = 3, Parent = holder,
				}, { UI.corner(999), UI.stroke(p.role == "TW" and C.goldLight or Color3.new(1, 1, 1), 1.5, 0.2) })
				dots[p.id] = dot
			end
			dot.Position = UDim2.fromScale(p.x / 105, p.y / 68)
		end
		for id, dot in dots do
			if not seen[id] then
				dot:Destroy()
				dots[id] = nil
			end
		end
		ball.Position = UDim2.fromScale(frame.ball.x / 105, frame.ball.y / 68)
		local action = frame.action
		if action then
			local actor = nil
			for _, p in frame.players do
				if p.id == action.actor then
					actor = p
				end
			end
			caption.Text = (ACTION_LABELS[action.kind] or action.kind) .. (actor and (" · " .. actor.name) or "")
		end
		if frame.celebration and frame.celebration.progress < CELEBRATION_SHARE then
			celebrate.Text = "TOR!"
			celebrate.TextColor3 = frame.celebration.club and C.goldLight or Color3.fromRGB(255, 120, 120)
		else
			celebrate.Text = ""
		end
	end)
	return holder
end

------------------------------------------------------------------------------------------
-- 3D broadcast on the stadium pitch (client only, other players do not see it).

local world: Folder? = nil
local worldConnection: RBXScriptConnection? = nil
local previousCamera: { cameraType: Enum.CameraType, cframe: CFrame }? = nil

local function toWorld(x: number, y: number, height: number): Vector3
	return Vector3.new(x - 52.5, 0.5 + height, y - 34)
end

local function body(color: Color3, number: number?): Model
	local model = Instance.new("Model")
	local torso = Instance.new("Part")
	torso.Name = "Torso"
	torso.Anchored = true
	torso.CanCollide = false
	torso.Size = Vector3.new(1, 1.6, 0.6)
	torso.Color = color
	torso.Material = Enum.Material.SmoothPlastic
	torso.Parent = model
	local head = Instance.new("Part")
	head.Name = "Head"
	head.Shape = Enum.PartType.Ball
	head.Anchored = true
	head.CanCollide = false
	head.Size = Vector3.new(0.8, 0.8, 0.8)
	head.Color = Color3.fromRGB(230, 190, 160)
	head.Parent = model
	local legs = Instance.new("Part")
	legs.Name = "Legs"
	legs.Anchored = true
	legs.CanCollide = false
	legs.Size = Vector3.new(0.9, 1.1, 0.5)
	legs.Color = Color3.fromRGB(30, 30, 35)
	legs.Parent = model
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(30, 18)
	gui.StudsOffset = Vector3.new(0, 1.4, 0)
	gui.AlwaysOnTop = true
	gui.Parent = head
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.fromScale(1, 1)
	label.Font = Enum.Font.GothamBlack
	label.TextScaled = true
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0.3
	label.Text = number and tostring(number) or ""
	label.Parent = gui
	model.PrimaryPart = torso
	return model
end

function MatchView.is3D(): boolean
	return world ~= nil
end

function MatchView.stop3D()
	if worldConnection then
		worldConnection:Disconnect()
		worldConnection = nil
	end
	if world then
		world:Destroy()
		world = nil
	end
	local camera = Workspace.CurrentCamera
	if camera and previousCamera then
		camera.CameraType = previousCamera.cameraType
	end
	previousCamera = nil
	local stadiumBall = Workspace:FindFirstChild("Stadium") and (Workspace :: any).Stadium:FindFirstChild("GoalBall")
	if stadiumBall then
		stadiumBall.LocalTransparencyModifier = 0
	end
end

function MatchView.start3D(clubColor: Color3)
	MatchView.stop3D()
	local camera = Workspace.CurrentCamera
	if not camera then
		return
	end
	previousCamera = { cameraType = camera.CameraType, cframe = camera.CFrame }
	camera.CameraType = Enum.CameraType.Scriptable
	local folder = Instance.new("Folder")
	folder.Name = "LiveMatch"
	folder.Parent = Workspace
	world = folder
	local models: { [string]: Model } = {}
	local ball = Instance.new("Part")
	ball.Shape = Enum.PartType.Ball
	ball.Anchored = true
	ball.CanCollide = false
	ball.Size = Vector3.new(0.7, 0.7, 0.7)
	ball.Color = Color3.new(1, 1, 1)
	ball.Parent = folder
	local stadiumBall = Workspace:FindFirstChild("Stadium") and (Workspace :: any).Stadium:FindFirstChild("GoalBall")
	if stadiumBall then
		stadiumBall.LocalTransparencyModifier = 1
	end
	local opponentColor = Color3.fromRGB(225, 60, 70)
	local smoothBall = Vector3.zero
	worldConnection = RunService.RenderStepped:Connect(function(dt)
		local frame = MatchView.frame()
		local cup = State.features("cup")
		if not frame or not cup or not cup.active then
			return
		end
		local seen = {}
		for _, p in frame.players do
			seen[p.id] = true
			local model = models[p.id]
			if not model then
				model = body(p.club and clubColor or opponentColor, p.number)
				if p.role == "TW" then
					(model :: any).Torso.Color = p.club and C.goldLight or Color3.fromRGB(40, 200, 120)
				end
				model.Parent = folder
				models[p.id] = model
			end
			local position = toWorld(p.x, p.y, 1.35)
			local torso = (model :: any).Torso :: Part
			local facing = torso.CFrame.Position + (position - torso.CFrame.Position) * 2
			local look = (facing - position).Magnitude > 0.05 and CFrame.lookAt(position, Vector3.new(facing.X, position.Y, facing.Z)) or CFrame.new(position) * (torso.CFrame - torso.CFrame.Position)
			torso.CFrame = look
			;(model :: any).Head.CFrame = look * CFrame.new(0, 1.2, 0)
			;(model :: any).Legs.CFrame = look * CFrame.new(0, -1.3, 0)
		end
		for id, model in models do
			if not seen[id] then
				model:Destroy()
				models[id] = nil
			end
		end
		local target = toWorld(frame.ball.x, frame.ball.y, 0.35)
		smoothBall = smoothBall:Lerp(target, math.min(1, dt * 12))
		ball.CFrame = CFrame.new(smoothBall)
		local focus = Vector3.new(smoothBall.X * 0.75, 0, smoothBall.Z * 0.3)
		camera.CFrame = camera.CFrame:Lerp(CFrame.lookAt(focus + Vector3.new(0, 34, 58), focus), math.min(1, dt * 2.5))
	end)
end

return MatchView
