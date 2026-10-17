--!strict
-- Four mini games with cooldowns. The server keeps the running game so results cannot be faked.
local Util = require(script.Parent.Util)

local MiniGames = {}

MiniGames.IDS = { "penalty", "dribble", "crossbar", "prediction" }
MiniGames.COOLDOWN_SECONDS = { penalty = 60, dribble = 75, crossbar = 90, prediction = 120 }
MiniGames.NAMES = { penalty = "Penalty Challenge", dribble = "Dribble Run", crossbar = "Latten Challenge", prediction = "Matchday Tipp" }
MiniGames.CHOICES = {
	penalty = { "links", "mitte", "rechts" },
	dribble = { "links", "mitte", "rechts" },
	crossbar = { "hoch", "mitte", "tief" },
	prediction = { "heim", "remis", "auswärts" },
}

local function pick(list: { string }, random: () -> number): string
	return list[math.floor(Util.bounded(random) * #list) + 1]
end

local function capitalized(text: string): string
	return string.upper(string.sub(text, 1, 1)) .. string.sub(text, 2)
end

local function predictionLabel(value: string): string
	return value == "heim" and "Heimsieg" or value == "auswärts" and "Auswärtssieg" or "Remis"
end

function MiniGames.initialCooldowns(): { [string]: number }
	return { penalty = 0, dribble = 0, crossbar = 0, prediction = 0 }
end

function MiniGames.start(id: string, random: () -> number): any
	if id == "penalty" then
		return { id = id, shots = 0, goals = 0, message = "Such dir eine Ecke aus.", finished = false, reward = 0 }
	elseif id == "dribble" then
		local sequence = {}
		for index = 1, 6 do
			sequence[index] = pick(MiniGames.CHOICES.dribble, random)
		end
		return { id = id, sequence = sequence, step = 0, attempts = 0, misses = 0, message = "Erster Move: " .. capitalized(sequence[1]) .. ".", finished = false, reward = 0 }
	elseif id == "crossbar" then
		return { id = id, shots = 0, hits = 0, message = "Zielhöhe wählen und die Latte treffen.", finished = false, reward = 0 }
	end
	return { id = "prediction", round = 0, wins = 0, message = "Wer gewinnt das nächste Match?", finished = false, reward = 0 }
end

-- Applies one choice; when finished the reward is set and the game is over.
function MiniGames.play(game: any, choice: string, random: () -> number): any
	if game.finished or not table.find(MiniGames.CHOICES[game.id], choice) then
		return game
	end
	local nextGame = table.clone(game)
	if game.id == "penalty" then
		local keeper = pick(MiniGames.CHOICES.penalty, random)
		local scored = choice ~= keeper
		nextGame.shots += 1
		nextGame.goals += scored and 1 or 0
		nextGame.lastOutcome = scored and "goal" or "save"
		nextGame.keeper = keeper
		if nextGame.shots >= 5 then
			nextGame.reward = 250 + nextGame.goals * 150
			nextGame.finished = true
			nextGame.title = ("Penalty Challenge %d/5"):format(nextGame.goals)
			nextGame.message = ("%d von 5 Elfmetern drin. %s Tore Prämie."):format(nextGame.goals, Util.formatNumber(nextGame.reward))
		else
			nextGame.message = scored and "Tor. Der Goalie war in der falschen Ecke." or ("Gehalten. Der Goalie war %s."):format(keeper)
		end
	elseif game.id == "dribble" then
		local expected = game.sequence[game.step + 1]
		local correct = choice == expected
		nextGame.step = correct and game.step + 1 or 0
		nextGame.attempts += 1
		nextGame.misses += correct and 0 or 1
		nextGame.lastOutcome = correct and "success" or "lost"
		if correct and nextGame.step >= #game.sequence then
			nextGame.reward = 220 + math.max(0, 3 - nextGame.misses) * 45
			nextGame.finished = true
			nextGame.title = "Dribble Run"
			nextGame.message = ("Perfekte Ballführung in %d Moves."):format(nextGame.attempts)
		elseif not correct and nextGame.misses >= 3 then
			nextGame.reward = 60 + game.step * 15
			nextGame.finished = true
			nextGame.title = "Dribble Run"
			nextGame.message = ("Dreimal den Ball verloren. %s Tore Trostpreis."):format(Util.formatNumber(nextGame.reward))
		else
			nextGame.message = correct and ("Sauber. Als Nächstes: %s."):format(capitalized(game.sequence[nextGame.step + 1])) or "Ball verloren. Wieder von vorne."
		end
	elseif game.id == "crossbar" then
		local target = pick(MiniGames.CHOICES.crossbar, random)
		local hit = choice == target
		nextGame.shots += 1
		nextGame.hits += hit and 1 or 0
		nextGame.lastOutcome = hit and "hit" or "miss"
		if nextGame.shots >= 5 then
			nextGame.reward = 50 + nextGame.hits * 45
			nextGame.finished = true
			nextGame.title = ("Latten Challenge %d/5"):format(nextGame.hits)
			nextGame.message = ("%d von 5 Latten getroffen. %s Tore Prämie."):format(nextGame.hits, Util.formatNumber(nextGame.reward))
		else
			nextGame.message = hit and "Ping. Genau die richtige Höhe." or ("Daneben. Das Ziel war %s."):format(capitalized(target))
		end
	else
		local outcome = pick(MiniGames.CHOICES.prediction, random)
		local correct = choice == outcome
		nextGame.round += 1
		nextGame.wins += correct and 1 or 0
		nextGame.lastOutcome = correct and "right" or "wrong"
		if nextGame.round >= 3 then
			nextGame.reward = 70 + nextGame.wins * 55 + (nextGame.wins == 3 and 100 or 0)
			nextGame.finished = true
			nextGame.title = ("Matchday Tipp %d/3"):format(nextGame.wins)
			nextGame.message = ("%d von 3 Tipps richtig. %s Tore Prämie."):format(nextGame.wins, Util.formatNumber(nextGame.reward))
		else
			nextGame.message = correct and ("Richtig: %s. Nächster Tipp."):format(predictionLabel(outcome)) or ("Falsch: Es war %s. Nächster Tipp."):format(predictionLabel(outcome))
		end
	end
	return nextGame
end

return MiniGames
