--!nonstrict
-- Talks to the server: actions (with a toast for the answer), clicks and queries.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Net = {}

local remotes = ReplicatedStorage:WaitForChild("Remotes")
local actionRemote = remotes:WaitForChild("Action") :: RemoteFunction
local clickRemote = remotes:WaitForChild("Click") :: RemoteEvent
local queryRemote = remotes:WaitForChild("Query") :: RemoteFunction

Net.stateEvent = remotes:WaitForChild("State") :: RemoteEvent
Net.noticeEvent = remotes:WaitForChild("Notice") :: RemoteEvent
Net.clickResult = remotes:WaitForChild("ClickResult") :: RemoteEvent

local toastHandler: ((string, boolean) -> ())? = nil
local pending: { [string]: boolean } = {}

function Net.setToast(handler: (string, boolean) -> ())
	toastHandler = handler
end

-- Runs an action on the server. The answer text is shown as a toast unless quiet.
function Net.action(name: string, payload: any?, quiet: boolean?): (boolean, string)
	if pending[name] then
		return false, ""
	end
	pending[name] = true
	local ok, success, message = pcall(function()
		return actionRemote:InvokeServer(name, payload or {})
	end)
	pending[name] = nil
	if not ok then
		if toastHandler then
			toastHandler("Keine Verbindung zum Server. Bitte erneut versuchen.", false)
		end
		return false, ""
	end
	if toastHandler and type(message) == "string" and message ~= "" and not quiet then
		toastHandler(message, success == true)
	end
	return success == true, message or ""
end

function Net.isPending(name: string): boolean
	return pending[name] == true
end

function Net.click()
	clickRemote:FireServer()
end

function Net.query(name: string): any
	local ok, result = pcall(function()
		return queryRemote:InvokeServer(name)
	end)
	return ok and result or nil
end

return Net
