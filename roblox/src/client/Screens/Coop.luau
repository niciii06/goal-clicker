--!nonstrict
-- Coop lobby: create a shared world, join with a code or reopen a saved world.
local Client = script.Parent.Parent
local Net = require(Client.Net)
local Theme = require(Client.Theme)
local UI = require(Client.UI)

local C = Theme.colors
local Coop = {}

Coop.sections = { "coop" }

local roomName = "Meine Welt"
local code = ""
local saved: { any }? = nil
local loading = false

function Coop.render(container: Frame, ctx: any)
	local nameBox = UI.input("Name der Welt", roomName, function(text)
		roomName = text
	end)
	local codeBox = UI.input("Code (6 Zeichen)", code, function(text)
		code = string.upper(text)
	end)
	UI.card({
		UI.eyebrow("Koop Multiplayer"),
		UI.title("Ein gemeinsamer Club für bis zu vier Spieler.", 22),
		UI.label("Alle teilen Tore, Kader, Saison und Turniere. Deine Freunde müssen auf demselben Roblox Server sein: Tretet über die Freundesliste dem gleichen Spiel bei. Gespielt wird ab zwei Mitgliedern.", { size = 13, color = C.muted }),
	}, { gap = 8 }).Parent = container
	UI.card({
		UI.eyebrow("Neue Welt"),
		nameBox,
		UI.button("Welt erstellen", { style = "primary", onClick = function()
			Net.action("createCoop", { roomName = roomName })
		end }),
	}, { gap = 8 }).Parent = container
	UI.card({
		UI.eyebrow("Beitreten"),
		codeBox,
		UI.button("Mit Code beitreten", { style = "dark", onClick = function()
			Net.action("joinCoop", { code = code })
		end }),
	}, { gap = 8 }).Parent = container
	local list: { Instance? } = { UI.eyebrow("Deine Welten") }
	if saved then
		for _, world in saved do
			table.insert(list, UI.button(("%s · %s · %d / 4 Spieler%s"):format(world.roomName, world.code, world.players, world.open and " · auf diesem Server offen" or ""), { style = "ghost", height = 42, size = 13, onClick = function()
				Net.action("joinCoop", { code = world.code })
			end }))
		end
		if #saved == 0 then
			table.insert(list, UI.label("Noch keine Koop-Welten.", { size = 13, color = C.muted }))
		end
	end
	table.insert(list, UI.button(loading and "Lädt …" or "Welten laden", { style = "secondary", disabled = loading, onClick = function()
		loading = true
		ctx.refresh()
		saved = Net.query("savedWorlds") or {}
		loading = false
		ctx.refresh()
	end }))
	UI.card(list, { gap = 6 }).Parent = container
end

return Coop
