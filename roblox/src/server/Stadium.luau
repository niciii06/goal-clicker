--!strict
-- Builds the stadium the players walk around in: a 105 x 68 stud pitch (1 stud = 1 metre),
-- goals, stands, floodlights, a scoreboard and the big clickable ball at kick-off.
local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")

local Stadium = {}

Stadium.PITCH_LENGTH = 105
Stadium.PITCH_WIDTH = 68
Stadium.GROUND_Y = 0

local function part(parent: Instance, name: string, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material?, shape: Enum.PartType?): Part
	local item = Instance.new("Part")
	item.Name = name
	item.Anchored = true
	item.Size = size
	item.CFrame = cframe
	item.Color = color
	item.Material = material or Enum.Material.SmoothPlastic
	item.TopSurface = Enum.SurfaceType.Smooth
	item.BottomSurface = Enum.SurfaceType.Smooth
	if shape then
		item.Shape = shape
	end
	item.Parent = parent
	return item
end

local LINE = Color3.fromRGB(245, 245, 240)
local LINE_W = 0.15
local LINE_Y = 0.52

local function line(parent: Instance, from: Vector3, to: Vector3)
	local length = (to - from).Magnitude
	local middle = (from + to) / 2
	local item = part(parent, "Line", Vector3.new(LINE_W, 0.05, length + LINE_W), CFrame.lookAt(Vector3.new(middle.X, LINE_Y, middle.Z), Vector3.new(to.X, LINE_Y, to.Z)), LINE)
	item.CanCollide = false
end

local function arc(parent: Instance, center: Vector3, radius: number, fromAngle: number, toAngle: number, segments: number)
	local previous = nil
	for index = 0, segments do
		local angle = fromAngle + (toAngle - fromAngle) * index / segments
		local point = center + Vector3.new(math.cos(angle) * radius, 0, math.sin(angle) * radius)
		if previous then
			line(parent, previous, point)
		end
		previous = point
	end
end

local function rect(parent: Instance, x1: number, z1: number, x2: number, z2: number)
	line(parent, Vector3.new(x1, 0, z1), Vector3.new(x2, 0, z1))
	line(parent, Vector3.new(x2, 0, z1), Vector3.new(x2, 0, z2))
	line(parent, Vector3.new(x2, 0, z2), Vector3.new(x1, 0, z2))
	line(parent, Vector3.new(x1, 0, z2), Vector3.new(x1, 0, z1))
end

local function goal(parent: Instance, x: number, facing: number)
	local model = Instance.new("Model")
	model.Name = "Goal"
	local white = Color3.fromRGB(250, 250, 250)
	local width, height, depth = 7.32, 2.44, 2
	for _, z in { -width / 2, width / 2 } do
		part(model, "Post", Vector3.new(0.15, height, 0.15), CFrame.new(x, 0.5 + height / 2, z), white, Enum.Material.Metal)
		part(model, "BackPost", Vector3.new(0.1, height, 0.1), CFrame.new(x + facing * depth, 0.5 + height / 2, z), white, Enum.Material.Metal)
	end
	part(model, "Crossbar", Vector3.new(0.15, 0.15, width + 0.15), CFrame.new(x, 0.5 + height, 0), white, Enum.Material.Metal)
	local net = part(model, "Net", Vector3.new(0.05, height, width), CFrame.new(x + facing * depth, 0.5 + height / 2, 0), white, Enum.Material.ForceField)
	net.Transparency = 0.55
	local roof = part(model, "NetRoof", Vector3.new(depth, 0.05, width), CFrame.new(x + facing * depth / 2, 0.5 + height, 0), white, Enum.Material.ForceField)
	roof.Transparency = 0.55
	for _, z in { -width / 2, width / 2 } do
		local side = part(model, "NetSide", Vector3.new(depth, height, 0.05), CFrame.new(x + facing * depth / 2, 0.5 + height / 2, z), white, Enum.Material.ForceField)
		side.Transparency = 0.55
	end
	model.Parent = parent
end

local function stand(parent: Instance, center: Vector3, length: number, rows: number, outward: Vector3, color: Color3, seatColor: Color3)
	local model = Instance.new("Model")
	model.Name = "Stand"
	local alongX = math.abs(outward.Z) > 0.5
	local function sized(depth: number, height: number): Vector3
		return alongX and Vector3.new(length, height, depth) or Vector3.new(depth, height, length)
	end
	for row = 0, rows - 1 do
		local height = 1.3 + row * 1.1
		local position = center + outward * (row * 1.6)
		part(model, "Step", sized(1.6, height), CFrame.new(position.X, height / 2, position.Z), color, Enum.Material.Concrete)
		local seats = part(model, "Seats", sized(0.7, 0.5), CFrame.new(position.X - outward.X * 0.3, height + 0.25, position.Z - outward.Z * 0.3), seatColor)
		seats.CanCollide = false
	end
	local depth = rows * 1.6
	local roofCenter = center + outward * (depth / 2)
	local roof = part(model, "Roof", sized(depth + 6, 0.6), CFrame.new(roofCenter.X, rows * 1.1 + 7, roofCenter.Z), Color3.fromRGB(225, 228, 232), Enum.Material.Metal)
	roof.Transparency = 0.15
	local back = center + outward * depth
	part(model, "BackWall", sized(0.8, rows * 1.1 + 7), CFrame.new(back.X, (rows * 1.1 + 7) / 2, back.Z), color, Enum.Material.Concrete)
	model.Parent = parent
end

local function floodlight(parent: Instance, position: Vector3)
	local model = Instance.new("Model")
	model.Name = "Floodlight"
	part(model, "Mast", Vector3.new(1, 34, 1), CFrame.new(position + Vector3.new(0, 17, 0)), Color3.fromRGB(150, 155, 160), Enum.Material.Metal)
	local head = part(model, "Lamps", Vector3.new(5, 3, 1), CFrame.lookAt(position + Vector3.new(0, 34, 0), Vector3.new(0, 0, 0)), Color3.fromRGB(255, 252, 230), Enum.Material.Neon)
	local light = Instance.new("SpotLight")
	light.Range = 60
	light.Angle = 70
	light.Brightness = 2
	light.Face = Enum.NormalId.Front
	light.Parent = head
	model.Parent = parent
end

local function scoreboard(parent: Instance, position: Vector3)
	local board = part(parent, "Scoreboard", Vector3.new(24, 9, 1), CFrame.lookAt(position, Vector3.new(0, position.Y, 0)), Color3.fromRGB(18, 20, 24))
	local gui = Instance.new("SurfaceGui")
	gui.Name = "Display"
	gui.Face = Enum.NormalId.Front
	gui.PixelsPerStud = 40
	gui.Parent = board
	local title = Instance.new("TextLabel")
	title.Name = "Title"
	title.BackgroundTransparency = 1
	title.Size = UDim2.fromScale(1, 0.45)
	title.Font = Enum.Font.GothamBlack
	title.TextScaled = true
	title.TextColor3 = Color3.fromRGB(255, 255, 255)
	title.Text = "GOAL CLICKER"
	title.Parent = gui
	local subtitle = Instance.new("TextLabel")
	subtitle.Name = "Subtitle"
	subtitle.BackgroundTransparency = 1
	subtitle.Position = UDim2.fromScale(0, 0.5)
	subtitle.Size = UDim2.fromScale(1, 0.35)
	subtitle.Font = Enum.Font.GothamBold
	subtitle.TextScaled = true
	subtitle.TextColor3 = Color3.fromRGB(255, 204, 0)
	subtitle.Text = "Klick den Ball. Werde Legende."
	subtitle.Parent = gui
end

local AD_TEXTS = { "GOAL CLICKER", "FABRIZIO ROMARIO", "GOAL GAZETTE", "BÜMPLIZSTRASSE 45", "AZB EXPRESS", "STAR XI" }

local function adBoards(parent: Instance)
	local index = 0
	local function board(cframe: CFrame, length: number)
		index += 1
		local item = part(parent, "AdBoard", Vector3.new(length, 1, 0.3), cframe, Color3.fromRGB(0, 113, 227))
		local gui = Instance.new("SurfaceGui")
		gui.Face = Enum.NormalId.Front
		gui.PixelsPerStud = 30
		gui.Parent = item
		local text = Instance.new("TextLabel")
		text.BackgroundTransparency = 1
		text.Size = UDim2.fromScale(1, 1)
		text.Font = Enum.Font.GothamBlack
		text.TextScaled = true
		text.TextColor3 = Color3.new(1, 1, 1)
		text.Text = AD_TEXTS[(index - 1) % #AD_TEXTS + 1]
		text.Parent = gui
	end
	for i = -2, 2 do
		board(CFrame.lookAt(Vector3.new(i * 20, 1, -38.5), Vector3.new(i * 20, 1, 0)), 18)
		board(CFrame.lookAt(Vector3.new(i * 20, 1, 38.5), Vector3.new(i * 20, 1, 0)), 18)
	end
	for _, x in { -56.5, 56.5 } do
		for _, z in { -20, 20 } do
			board(CFrame.lookAt(Vector3.new(x, 1, z), Vector3.new(0, 1, z)), 18)
		end
	end
end

function Stadium.build()
	local existing = Workspace:FindFirstChild("Stadium")
	if existing then
		existing:Destroy()
	end
	local stadium = Instance.new("Folder")
	stadium.Name = "Stadium"
	stadium.Parent = Workspace

	-- Ground and striped grass.
	part(stadium, "Ground", Vector3.new(220, 1, 170), CFrame.new(0, -0.5, 0), Color3.fromRGB(70, 110, 60), Enum.Material.Grass)
	for stripe = 0, 13 do
		local x = -Stadium.PITCH_LENGTH / 2 - 4 + stripe * 8.07 + 4
		local color = stripe % 2 == 0 and Color3.fromRGB(58, 142, 64) or Color3.fromRGB(66, 156, 72)
		local grass = part(stadium, "Grass", Vector3.new(8.07, 0.5, Stadium.PITCH_WIDTH + 8), CFrame.new(x, 0.25, 0), color, Enum.Material.Grass)
		grass.Name = "Pitch"
	end

	local lines = Instance.new("Folder")
	lines.Name = "Lines"
	lines.Parent = stadium
	local halfL, halfW = Stadium.PITCH_LENGTH / 2, Stadium.PITCH_WIDTH / 2
	rect(lines, -halfL, -halfW, halfL, halfW)
	line(lines, Vector3.new(0, 0, -halfW), Vector3.new(0, 0, halfW))
	arc(lines, Vector3.zero, 9.15, 0, math.pi * 2, 36)
	for _, side in { -1, 1 } do
		local goalX = side * halfL
		rect(lines, goalX, -20.16, goalX - side * 16.5, 20.16)
		rect(lines, goalX, -9.16, goalX - side * 5.5, 9.16)
		local spot = part(lines, "PenaltySpot", Vector3.new(0.4, 0.05, 0.4), CFrame.new(goalX - side * 11, LINE_Y, 0), LINE)
		spot.CanCollide = false
		local base = side > 0 and math.pi or 0
		arc(lines, Vector3.new(goalX - side * 11, 0, 0), 9.15, base - 0.93, base + 0.93, 12)
		goal(stadium, goalX, side)
	end

	-- Stands on all four sides in the club colours of the home team.
	local blue, white = Color3.fromRGB(0, 113, 227), Color3.fromRGB(235, 238, 242)
	stand(stadium, Vector3.new(0, 0, -45), 120, 14, Vector3.new(0, 0, -1), Color3.fromRGB(70, 74, 82), blue)
	stand(stadium, Vector3.new(0, 0, 45), 120, 14, Vector3.new(0, 0, 1), Color3.fromRGB(70, 74, 82), white)
	stand(stadium, Vector3.new(-63, 0, 0), 80, 12, Vector3.new(-1, 0, 0), Color3.fromRGB(70, 74, 82), Color3.fromRGB(255, 204, 0))
	stand(stadium, Vector3.new(63, 0, 0), 80, 12, Vector3.new(1, 0, 0), Color3.fromRGB(70, 74, 82), blue)
	for _, x in { -70, 70 } do
		for _, z in { -55, 55 } do
			floodlight(stadium, Vector3.new(x, 0, z))
		end
	end
	scoreboard(stadium, Vector3.new(-80, 26, 0))
	adBoards(stadium)

	-- The big ball at kick-off: clicking it scores like the ball in the menu.
	local ball = part(stadium, "GoalBall", Vector3.new(6, 6, 6), CFrame.new(0, 3.6, 0), Color3.fromRGB(250, 250, 250), Enum.Material.SmoothPlastic, Enum.PartType.Ball)
	local detector = Instance.new("ClickDetector")
	detector.MaxActivationDistance = 60
	detector.Parent = ball
	local highlight = Instance.new("Highlight")
	highlight.FillTransparency = 1
	highlight.OutlineColor = Color3.fromRGB(20, 20, 20)
	highlight.Parent = ball

	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "Spawn"
	spawn.Anchored = true
	spawn.Size = Vector3.new(10, 1, 6)
	spawn.CFrame = CFrame.new(0, 0.5, 30)
	spawn.Transparency = 1
	spawn.CanCollide = false
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Parent = stadium

	Lighting.ClockTime = 17.2
	Lighting.Brightness = 2.2
	Lighting.OutdoorAmbient = Color3.fromRGB(140, 140, 150)
	return stadium
end

-- Converts web pitch coordinates (x 0 to 105, y 0 to 68) to a world position on the pitch.
function Stadium.toWorld(x: number, y: number, height: number?): Vector3
	return Vector3.new(x - Stadium.PITCH_LENGTH / 2, 0.5 + (height or 0), y - Stadium.PITCH_WIDTH / 2)
end

return Stadium
