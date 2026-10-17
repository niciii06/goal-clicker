--!nonstrict
-- Client entry: wires the server events to the state, the overlays and the UI.
local App = require(script.Parent.App)
local Net = require(script.Parent.Net)
local Overlays = require(script.Parent.Overlays)
local State = require(script.Parent.State)
local Home = require(script.Parent.Screens.Home)

Net.stateEvent.OnClientEvent:Connect(function(changed)
	State.apply(changed)
end)

Net.noticeEvent.OnClientEvent:Connect(function(notices)
	for _, notice in notices do
		local ok, problem = pcall(Overlays.handle, notice)
		if not ok then
			warn("[Notice]", notice.kind, problem)
		end
	end
end)

Net.clickResult.OnClientEvent:Connect(function(amount, critical, combo)
	Home.onClickResult(amount, critical, combo)
end)

App.start()
-- Ask for the complete state once the listeners are connected (the first push may have been sent earlier).
task.spawn(function()
	while not State.ready do
		Net.query("fullSync")
		task.wait(2)
	end
end)
