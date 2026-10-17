--!nonstrict
-- Client copy of the club state as sent by the server, plus the server clock.
local State = {}

State.data = {} :: { [string]: any }
State.ready = false

local listeners: { (changed: { [string]: boolean }) -> () } = {}
local serverOffset = 0
local coreReceivedAt = 0

function State.onChange(callback: (changed: { [string]: boolean }) -> ()): () -> ()
	table.insert(listeners, callback)
	return function()
		local index = table.find(listeners, callback)
		if index then
			table.remove(listeners, index)
		end
	end
end

local function localMs(): number
	return DateTime.now().UnixTimestampMillis
end

-- Server time in milliseconds (the server's DateTime clock, corrected for drift).
function State.now(): number
	return localMs() + serverOffset
end

function State.apply(changed: { [string]: any })
	local keys = {}
	for key, value in changed do
		if key == "serverNow" then
			serverOffset = value - localMs()
		else
			State.data[key] = value
			keys[key] = true
		end
	end
	if keys.core then
		coreReceivedAt = State.now()
	end
	State.ready = State.data.core ~= nil
	for _, listener in table.clone(listeners) do
		local ok, problem = pcall(listener, keys)
		if not ok then
			warn("[State] Listener failed:", problem)
		end
	end
end

function State.core(): any
	return State.data.core or {}
end

function State.features(key: string): any
	local value = State.data[key]
	if value == false then
		return nil
	end
	return value
end

-- Goals shown in the HUD: last server value plus the passive income since then.
function State.liveGoals(): number
	local core = State.core()
	local goals = core.goals or 0
	local passive = core.passivePower or 0
	local elapsed = math.clamp(State.now() - coreReceivedAt, 0, 3000)
	return goals + passive * elapsed / 1000
end

function State.addLocalGoals(amount: number)
	local core = State.data.core
	if core then
		core.goals += amount
		core.totalGoals += amount
		core.clicks += 1
	end
end

return State
