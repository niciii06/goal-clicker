--!strict
-- Club history feed (last 30 entries).
local Util = require(script.Parent.Util)

local History = {}

function History.add(features: any, title: string, detail: string, tone: string, now: number)
	table.insert(features.history, { id = ("%d-%s"):format(now, Util.randomId()), title = title, detail = detail, tone = tone, timestamp = now })
	features.history = Util.tail(features.history, 30)
end

return History
