--!nonstrict
-- Tiny declarative UI toolkit: instances from tables, cards, buttons, labels and live bindings.
local TweenService = game:GetService("TweenService")

local Theme = require(script.Parent.Theme)
local Util = require(game:GetService("ReplicatedStorage").Shared.Util)

local UI = {}

local C = Theme.colors

-- Creates an instance; functions for event names are connected, Children are parented.
function UI.new(className: string, props: { [string]: any }?, children: { any }?): any
	local instance = Instance.new(className)
	local parent = nil
	for key, value in (props or {}) :: any do
		if key == "Parent" then
			parent = value
		elseif type(value) == "function" then
			local ok, signal = pcall(function()
				return (instance :: any)[key]
			end)
			if ok and typeof(signal) == "RBXScriptSignal" then
				signal:Connect(value)
			else
				error(("%s has no event %s"):format(className, key))
			end
		else
			(instance :: any)[key] = value
		end
	end
	for _, child in (children or {}) :: any do
		if child then
			child.Parent = instance
		end
	end
	if parent then
		instance.Parent = parent
	end
	return instance
end

function UI.corner(radius: number?): UICorner
	return UI.new("UICorner", { CornerRadius = UDim.new(0, radius or Theme.radius) })
end

function UI.padding(top: number, right: number?, bottom: number?, left: number?): UIPadding
	return UI.new("UIPadding", {
		PaddingTop = UDim.new(0, top),
		PaddingRight = UDim.new(0, right or top),
		PaddingBottom = UDim.new(0, bottom or top),
		PaddingLeft = UDim.new(0, left or right or top),
	})
end

function UI.stroke(color: Color3?, thickness: number?, transparency: number?): UIStroke
	return UI.new("UIStroke", { Color = color or C.line, Thickness = thickness or 1, Transparency = transparency or 0, ApplyStrokeMode = Enum.ApplyStrokeMode.Border })
end

function UI.list(direction: Enum.FillDirection?, gap: number?, horizontal: Enum.HorizontalAlignment?, vertical: Enum.VerticalAlignment?, wraps: boolean?): UIListLayout
	return UI.new("UIListLayout", {
		FillDirection = direction or Enum.FillDirection.Vertical,
		Padding = UDim.new(0, gap or Theme.gap),
		SortOrder = Enum.SortOrder.LayoutOrder,
		HorizontalAlignment = horizontal or Enum.HorizontalAlignment.Left,
		VerticalAlignment = vertical or Enum.VerticalAlignment.Top,
		Wraps = wraps or false,
	})
end

local order = 0
local function nextOrder(): number
	order += 1
	return order
end

export type LabelOptions = {
	size: number?,
	color: Color3?,
	font: Enum.Font?,
	align: Enum.TextXAlignment?,
	wrap: boolean?,
	width: UDim?,
	height: number?,
	transparency: number?,
	rich: boolean?,
	name: string?,
	inline: boolean?,
}

function UI.label(text: string, options: LabelOptions?): TextLabel
	local o = options or {}
	local fixedHeight = o.height
	return UI.new("TextLabel", {
		Name = o.name or "Label",
		BackgroundTransparency = 1,
		Text = text,
		TextColor3 = o.color or C.text,
		Font = o.font or Theme.fonts.regular,
		TextSize = o.size or 15,
		TextXAlignment = o.align or Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Center,
		TextWrapped = o.wrap ~= false and not o.inline,
		RichText = o.rich or false,
		TextTransparency = o.transparency or 0,
		Size = o.inline and UDim2.fromOffset(0, fixedHeight or 0) or UDim2.new(o.width or UDim.new(1, 0), UDim.new(0, fixedHeight or 0)),
		AutomaticSize = o.inline and (fixedHeight and Enum.AutomaticSize.X or Enum.AutomaticSize.XY) or (fixedHeight and Enum.AutomaticSize.None or Enum.AutomaticSize.Y),
		LayoutOrder = nextOrder(),
	})
end

function UI.eyebrow(text: string, color: Color3?): TextLabel
	return UI.label(Util.upper(text), { size = 11, color = color or C.muted, font = Theme.fonts.bold })
end

function UI.title(text: string, size: number?): TextLabel
	return UI.label(text, { size = size or 22, font = Theme.fonts.black })
end

export type ButtonOptions = {
	style: string?,
	onClick: (() -> ())?,
	disabled: boolean?,
	width: UDim?,
	height: number?,
	size: number?,
	color: Color3?,
	name: string?,
}

local STYLES = {
	primary = { background = C.accent, text = C.white },
	secondary = { background = C.cardAlt, text = C.text },
	dark = { background = C.text, text = C.white },
	danger = { background = C.red, text = C.white },
	success = { background = C.green, text = C.white },
	gold = { background = C.gold, text = C.white },
	ghost = { background = C.card, text = C.accent },
}

function UI.button(text: string, options: ButtonOptions?): TextButton
	local o = options or {}
	local style = STYLES[o.style or "primary"] or STYLES.primary
	local background = o.color or style.background
	local button = UI.new("TextButton", {
		Name = o.name or "Button",
		AutoButtonColor = not o.disabled,
		BackgroundColor3 = background,
		BackgroundTransparency = o.disabled and 0.55 or 0,
		Text = text,
		TextColor3 = style.text,
		Font = Theme.fonts.bold,
		TextSize = o.size or 15,
		TextWrapped = true,
		Size = UDim2.new(o.width or UDim.new(1, 0), UDim.new(0, o.height or 40)),
		LayoutOrder = nextOrder(),
	}, {
		UI.corner(10),
		UI.padding(4, 10),
		(o.style == "ghost" or o.style == "secondary") and UI.stroke(C.line) or nil,
		-- Light from above: full colour at the top, a little darker at the bottom.
		UI.new("UIGradient", {
			Rotation = 90,
			Color = ColorSequence.new(Color3.new(1, 1, 1), (o.style == "ghost" or o.style == "secondary") and Color3.fromRGB(236, 238, 242) or Color3.fromRGB(205, 205, 205)),
		}),
	})
	if o.onClick and not o.disabled then
		local scale = UI.new("UIScale", { Parent = button })
		local hovered = false
		local function settle()
			TweenService:Create(scale, TweenInfo.new(0.12), { Scale = hovered and 1.03 or 1 }):Play()
		end
		button.MouseEnter:Connect(function()
			hovered = true
			settle()
		end)
		button.MouseLeave:Connect(function()
			hovered = false
			settle()
		end)
		local busy = false
		button.Activated:Connect(function()
			if busy then
				return
			end
			busy = true
			scale.Scale = 0.95
			settle()
			local ok, problem = pcall(o.onClick :: () -> ())
			if not ok then
				warn("[UI] Button failed:", problem)
			end
			busy = false
		end)
	end
	return button
end

export type BoxOptions = {
	color: Color3?,
	transparency: number?,
	padding: number?,
	gap: number?,
	direction: Enum.FillDirection?,
	width: UDim?,
	height: number?,
	radius: number?,
	stroke: boolean?,
	strokeColor: Color3?,
	align: Enum.HorizontalAlignment?,
	valign: Enum.VerticalAlignment?,
	wraps: boolean?,
	name: string?,
	clip: boolean?,
}

-- Frame with list layout that grows with its content.
function UI.box(options: BoxOptions?, children: { any }?): Frame
	local o = options or {}
	local frame = UI.new("Frame", {
		Name = o.name or "Box",
		BackgroundColor3 = o.color or C.card,
		BackgroundTransparency = o.transparency or (o.color and 0 or 1),
		BorderSizePixel = 0,
		Size = UDim2.new(o.width or UDim.new(1, 0), UDim.new(0, o.height or 0)),
		AutomaticSize = o.height and Enum.AutomaticSize.None or Enum.AutomaticSize.Y,
		ClipsDescendants = o.clip or false,
		LayoutOrder = nextOrder(),
	}, {
		UI.list(o.direction, o.gap, o.align, o.valign, o.wraps),
		o.padding and o.padding > 0 and UI.padding(o.padding) or nil,
		o.radius ~= 0 and (o.color or o.stroke) and UI.corner(o.radius) or nil,
		o.stroke and UI.stroke(o.strokeColor) or nil,
	})
	for _, child in (children or {}) :: any do
		if child then
			child.Parent = frame
		end
	end
	return frame
end

function UI.card(children: { any }, options: BoxOptions?): Frame
	local o = table.clone(options or {})
	o.color = o.color or C.card
	o.padding = o.padding or 16
	o.stroke = o.stroke ~= false
	return UI.box(o, children)
end

function UI.row(children: { any }, gap: number?, valign: Enum.VerticalAlignment?, wraps: boolean?): Frame
	return UI.box({ direction = Enum.FillDirection.Horizontal, gap = gap or 8, valign = valign or Enum.VerticalAlignment.Center, wraps = wraps }, children)
end

-- Equal width columns in a row (for stat tiles and button groups).
function UI.columns(children: { any }, gap: number?, minWidth: number?): Frame
	local g = gap or 8
	local count = #children
	local frame = UI.box({ direction = Enum.FillDirection.Horizontal, gap = g, wraps = minWidth ~= nil })
	for _, child in children do
		if child:IsA("GuiObject") then
			child.Size = UDim2.new(1 / count, -math.floor(g * (count - 1) / count), child.Size.Y.Scale, child.Size.Y.Offset)
			if minWidth then
				UI.new("UISizeConstraint", { MinSize = Vector2.new(minWidth, 0), Parent = child })
			end
		end
		child.Parent = frame
	end
	return frame
end

function UI.pill(text: string, color: Color3?, textColor: Color3?): TextLabel
	return UI.new("TextLabel", {
		BackgroundColor3 = color or C.cardAlt,
		Text = text,
		TextColor3 = textColor or C.text,
		Font = Theme.fonts.bold,
		TextSize = 12,
		AutomaticSize = Enum.AutomaticSize.XY,
		Size = UDim2.fromOffset(0, 0),
		LayoutOrder = nextOrder(),
	}, { UI.corner(999), UI.padding(4, 9) })
end

function UI.progress(value: number, color: Color3?, height: number?): Frame
	local bar = UI.new("Frame", {
		BackgroundColor3 = C.line,
		BorderSizePixel = 0,
		Size = UDim2.new(1, 0, 0, height or 8),
		LayoutOrder = nextOrder(),
	}, { UI.corner(999) })
	UI.new("Frame", {
		Name = "Fill",
		BackgroundColor3 = color or C.accent,
		BorderSizePixel = 0,
		Size = UDim2.new(math.clamp(value, 0, 1), 0, 1, 0),
		Parent = bar,
	}, { UI.corner(999) })
	return bar
end

function UI.spacer(height: number): Frame
	return UI.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, height), LayoutOrder = nextOrder() })
end

function UI.divider(): Frame
	return UI.new("Frame", { BackgroundColor3 = C.line, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 1), LayoutOrder = nextOrder() })
end

function UI.input(placeholder: string, text: string?, onChanged: ((string) -> ())?, height: number?): TextBox
	local box = UI.new("TextBox", {
		BackgroundColor3 = C.cardAlt,
		PlaceholderText = placeholder,
		Text = text or "",
		ClearTextOnFocus = false,
		TextColor3 = C.text,
		PlaceholderColor3 = C.faint,
		Font = Theme.fonts.medium,
		TextSize = 15,
		TextXAlignment = Enum.TextXAlignment.Left,
		Size = UDim2.new(1, 0, 0, height or 40),
		LayoutOrder = nextOrder(),
	}, { UI.corner(10), UI.padding(4, 12), UI.stroke(C.line) })
	if onChanged then
		box:GetPropertyChangedSignal("Text"):Connect(function()
			onChanged(box.Text)
		end)
	end
	return box
end

-- Small segmented control; returns the frame.
function UI.segmented(options: { { id: string, label: string } }, active: string, onSelect: (string) -> (), size: number?): Frame
	local buttons = {}
	for _, option in options do
		table.insert(buttons, UI.button(option.label, {
			style = option.id == active and "dark" or "secondary",
			height = 34,
			size = size or 13,
			onClick = function()
				onSelect(option.id)
			end,
		}))
	end
	return UI.columns(buttons, 6)
end

-- Removes rendered children but keeps layouts and paddings.
function UI.clear(frame: Instance)
	for _, child in frame:GetChildren() do
		if child:IsA("GuiObject") then
			child:Destroy()
		end
	end
end

-- Live bindings: refreshed about ten times per second while the instance exists.
local bindings: { { instance: Instance, property: string, compute: () -> any } } = {}

function UI.bind(instance: Instance, property: string, compute: () -> any)
	table.insert(bindings, { instance = instance, property = property, compute = compute })
	local ok, value = pcall(compute)
	if ok then
		(instance :: any)[property] = value
	end
end

function UI.refreshBindings()
	local index = 1
	while index <= #bindings do
		local binding = bindings[index]
		if not binding.instance.Parent then
			table.remove(bindings, index)
		else
			local ok, value = pcall(binding.compute)
			if ok and (binding.instance :: any)[binding.property] ~= value then
				(binding.instance :: any)[binding.property] = value
			end
			index += 1
		end
	end
end

function UI.tween(instance: Instance, time: number, goals: { [string]: any }, style: Enum.EasingStyle?, direction: Enum.EasingDirection?)
	local tween = TweenService:Create(instance, TweenInfo.new(time, style or Enum.EasingStyle.Quad, direction or Enum.EasingDirection.Out), goals)
	tween:Play()
	return tween
end

return UI
