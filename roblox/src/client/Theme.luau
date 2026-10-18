--!nonstrict
-- Colours, fonts and sizes of the light "football idle club" look of the web version.
local Theme = {}

local function hex(value: string): Color3
	return Color3.fromHex(value)
end

Theme.colors = {
	background = hex("#f5f5f7"),
	card = hex("#ffffff"),
	cardAlt = hex("#f2f4f7"),
	text = hex("#1d1d1f"),
	muted = hex("#6e6e73"),
	faint = hex("#a1a1a6"),
	line = hex("#e3e5e8"),
	accent = hex("#0071e3"),
	accentDark = hex("#005bb8"),
	green = hex("#16845b"),
	greenLight = hex("#34c759"),
	red = hex("#d12c54"),
	redLight = hex("#ff375f"),
	gold = hex("#c69214"),
	goldLight = hex("#ffcc00"),
	purple = hex("#8b5cf6"),
	orange = hex("#e85d04"),
	dark = hex("#111216"),
	darkCard = hex("#1c1d22"),
	pitch = hex("#2f8f4e"),
	pitchDark = hex("#267a42"),
	white = hex("#ffffff"),
}

Theme.tone = {
	positive = Theme.colors.green,
	negative = Theme.colors.red,
	neutral = Theme.colors.muted,
}

-- Builder Sans for text, Fredoka One for titles and numbers (the playful game look).
Theme.fonts = {
	regular = Enum.Font.BuilderSans,
	medium = Enum.Font.BuilderSansMedium,
	bold = Enum.Font.BuilderSansBold,
	black = Enum.Font.FredokaOne,
	mono = Enum.Font.RobotoMono,
}

Theme.radius = 14
Theme.gap = 10

Theme.icons = {
	ball = "⚽", boot = "👟", worker = "🧒", striker = "🎯", board = "📋", light = "💡", screen = "📺", crown = "👑",
	number = "💯", flame = "🔥", stadium = "🏟️", diamond = "💎", rookie = "🌱", starter = "🎽", scorer = "🥅", star = "⭐",
	rocket = "🚀", sound = "🔊", mute = "🔇", broadcast = "📡",
}

function Theme.color(value: string?): Color3
	if value and string.match(value, "^#%x%x%x%x%x%x$") then
		return hex(value)
	end
	return Theme.colors.accent
end

-- Light card accents are darkened for text on white cards (like readableAccent on the web).
function Theme.readable(value: string?): Color3
	local color = Theme.color(value)
	local luminance = 0.2126 * color.R + 0.7152 * color.G + 0.0722 * color.B
	if luminance > 0.6 then
		return Color3.new(color.R * 0.55, color.G * 0.55, color.B * 0.55)
	end
	return color
end

function Theme.tierColor(tier: string?): Color3
	if tier == "legendary" then
		return Theme.colors.gold
	elseif tier == "icon" then
		return hex("#9aa6b5")
	elseif tier == "walkout" then
		return Theme.colors.purple
	elseif tier == "rare" then
		return Theme.colors.accent
	end
	return Theme.colors.muted
end

return Theme
