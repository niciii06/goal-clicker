--!strict
-- Press conference after each match: one question, three answers that change the fan mood.
local Texts = require(script.Parent.Data.Texts) :: any
local Util = require(script.Parent.Util)

local Press = {}

Press.DEFAULT_FAN_MOOD = 60
Press.QUESTIONS = Texts.pressQuestions :: { any }
local RECENT_LIMIT = 24

function Press.initial(): any
	return { fanMood = Press.DEFAULT_FAN_MOOD, answered = {}, recentQuestions = {} }
end

function Press.contexts(cup: any): { [string]: boolean }
	local diff = cup.homeScore - cup.awayScore
	local shootout = #cup.penaltyEvents > 0
	local won = diff > 0 or (shootout and cup.penaltyHomeScore > cup.penaltyAwayScore)
	local lost = diff < 0 or (shootout and cup.penaltyHomeScore < cup.penaltyAwayScore)
	local set = { any = true }
	set[cup.mode == "season" and "saison" or "turnier"] = true
	set[(cup.fixture and cup.fixture.away) and "auswaerts" or "heim"] = true
	if won then
		set.sieg = true
	end
	if diff >= 3 then
		set["hoher-sieg"] = true
	end
	if not won and not lost then
		set.remis = true
	end
	if lost then
		set.niederlage = true
	end
	if diff <= -3 then
		set["hohe-niederlage"] = true
	end
	if cup.awayScore == 0 and not lost then
		set["zu-null"] = true
	end
	if shootout then
		set.elfmeter = true
	end
	if Util.some(cup.matchEvents, function(event)
		return event.side == "home" and event.scorer ~= nil
	end) then
		set.torschuetze = true
	end
	return set
end

local function topScorer(cup: any): string
	local counts, order = {}, {}
	for _, event in cup.matchEvents do
		if event.side == "home" and event.scorer then
			if not counts[event.scorer] then
				table.insert(order, event.scorer)
			end
			counts[event.scorer] = (counts[event.scorer] or 0) + 1
		end
	end
	local best, bestCount = "", 0
	for _, name in order do
		if counts[name] > bestCount then
			best, bestCount = name, counts[name]
		end
	end
	return best
end

local function fill(text: string, cup: any, clubName: string): string
	text = Util.replaceAll(text, "{gegner}", cup.opponent ~= "" and cup.opponent or "den Gegner")
	text = Util.replaceAll(text, "{club}", clubName)
	text = Util.replaceAll(text, "{torschuetze}", topScorer(cup))
	return Util.replaceAll(text, "{resultat}", ("%d:%d"):format(cup.homeScore, cup.awayScore))
end

-- Deterministic per match; recently used questions are skipped.
function Press.conference(press: any, cup: any, clubName: string): any?
	local matchId = cup.careerMatchId
	if not matchId or cup.active or cup.matchStartedAt == 0 then
		return nil
	end
	local state = press or Press.initial()
	if table.find(state.answered, matchId) then
		return nil
	end
	local contexts = Press.contexts(cup)
	local seed = Util.fnv(matchId)
	local matching = Util.filter(Press.QUESTIONS, function(question)
		return Util.every(question.contexts, function(context)
			return context == "any" or contexts[context] == true
		end)
	end)
	local specific = Util.filter(matching, function(question)
		return not table.find(question.contexts, "any")
	end)
	local function fresh(list: { any }): { any }
		return Util.filter(list, function(question)
			return not table.find(state.recentQuestions, question.id)
		end)
	end
	local pool
	if seed % 4 ~= 0 and #fresh(specific) > 0 then
		pool = fresh(specific)
	elseif #fresh(matching) > 0 then
		pool = fresh(matching)
	else
		pool = matching
	end
	local question = pool[(seed % #pool) + 1]
	local order = { 1, 2, 3 }
	for i = 3, 2, -1 do
		local j = (bit32.rshift(seed, (i - 1) * 3) % i) + 1
		order[i], order[j] = order[j], order[i]
	end
	return {
		matchId = matchId,
		questionId = question.id,
		text = fill(question.text, cup, clubName),
		answers = Util.map(order, function(index)
			return { index = index, text = fill(question.answers[index].text, cup, clubName), mood = question.answers[index].mood }
		end),
	}
end

function Press.answer(press: any, cup: any, clubName: string, matchId: string, questionId: string, answerIndex: number, now: number): any?
	local conference = Press.conference(press, cup, clubName)
	if not conference or conference.matchId ~= matchId or conference.questionId ~= questionId then
		return nil
	end
	local question = Util.find(Press.QUESTIONS, function(item)
		return item.id == questionId
	end)
	local answer = question and question.answers[answerIndex]
	if not answer then
		return nil
	end
	local state = press or Press.initial()
	local fanMood = math.max(0, math.min(100, state.fanMood + answer.mood))
	local answered = table.clone(state.answered)
	table.insert(answered, matchId)
	local recent = Util.filter(state.recentQuestions, function(id)
		return id ~= questionId
	end)
	table.insert(recent, questionId)
	local text = fill(answer.text, cup, clubName)
	return {
		press = { fanMood = fanMood, answered = Util.tail(answered, 40), recentQuestions = Util.tail(recent, RECENT_LIMIT), last = { matchId = matchId, questionId = questionId, answer = text, mood = answer.mood, at = now } },
		answer = text,
		mood = answer.mood,
		fanMood = fanMood,
	}
end

function Press.reward(passivePerSecond: number, clickPower: number): number
	return math.max(250, math.floor(math.max(passivePerSecond * 90, clickPower * 60)))
end

function Press.moodLabel(mood: number): string
	return mood >= 85 and "Euphorisch" or mood >= 70 and "Begeistert" or mood >= 50 and "Zufrieden" or mood >= 30 and "Skeptisch" or "Gereizt"
end

return Press
