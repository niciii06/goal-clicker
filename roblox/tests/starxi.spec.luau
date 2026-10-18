local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage.Shared
local Cards = require(Shared.Cards)
local StarXI = require(Shared.StarXI)
local Util = require(Shared.Util)

return {
	{ name = "card pool loads", run = function()
		expectEqual(#Cards.ALL, 3104, "card count")
		expectEqual(#Cards.ACTIVE, 3007, "active card count")
		expectTrue(Cards.get("star-di-certo") ~= nil, "di certo")
		expectEqual(#Cards.FORMATIONS, 29, "formations")
	end },
	{ name = "fc 27 slot equivalents", run = function()
		local fullBack = Util.find(Cards.ALL, function(player)
			return #player.positions == 1 and player.positions[1] == "LV"
		end)
		local striker = Util.find(Cards.ALL, function(player)
			return #player.positions == 1 and player.positions[1] == "ST"
		end)
		expectTrue(Cards.canPlay(fullBack, "LAV"), "LV covers LAV")
		expectTrue(not Cards.canPlay(fullBack, "RAV"), "LV does not cover RAV")
		expectTrue(Cards.canPlay(striker, "MS"), "ST covers MS")
	end },
	{ name = "best eleven fills all slots", run = function()
		local owned = {}
		for index = 1, 400 do
			table.insert(owned, Cards.ALL[index].id)
		end
		local state = StarXI.setBest(StarXI.normalize({ ownedIds = owned }))
		expectEqual(StarXI.filledCount(state.lineupIds), 11, "lineup")
		expectEqual(StarXI.filledCount(state.benchIds), 12, "bench")
		for slot, id in state.lineupIds do
			expectTrue(Cards.canFillSlot(id, slot, state.formationPositions), "slot " .. slot)
		end
	end },
	{ name = "formatting", run = function()
		expectEqual(Util.formatNumber(999), "999")
		expectEqual(Util.formatNumber(1234), "1.2K")
		expectEqual(Util.formatNumber(35000000), "35M")
		expectEqual(Util.formatInteger(1234567), "1'234'567")
	end },
	{ name = "fnv matches web", run = function()
		-- Values computed with the TypeScript hash.
		expectEqual(Util.fnv("abc"), 440920331)
	end },
}
