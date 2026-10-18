--!nonstrict
-- Invites Roblox friends into the current coop world. The invite carries the world code as
-- launch data; the server reads it on join and puts the friend straight into the world.
local Players = game:GetService("Players")
local SocialService = game:GetService("SocialService")

local Invite = {}

function Invite.friends(code: string, roomName: string): (boolean, string?)
	local player = Players.LocalPlayer
	local ok, canInvite = pcall(function()
		return SocialService:CanSendGameInviteAsync(player)
	end)
	if not ok or not canInvite then
		return false, "Einladungen sind hier nicht möglich. Teile stattdessen den Code " .. code .. "."
	end
	local options = Instance.new("ExperienceInviteOptions")
	options.PromptMessage = ("Spiel mit mir in der Koop-Welt %s!"):format(roomName)
	options.LaunchData = code
	local shown = pcall(function()
		SocialService:PromptGameInvite(player, options)
	end)
	if not shown then
		return false, "Die Einladung konnte nicht geöffnet werden. Teile stattdessen den Code " .. code .. "."
	end
	return true, nil
end

return Invite
