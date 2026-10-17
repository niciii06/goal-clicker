--!strict
-- Daily reward with a seven day cycle. Days change at midnight in Zurich.
local Progression = require(script.Parent.Data.Progression) :: any

local Daily = {}

Daily.DAYS = Progression.dailyRewardDays :: { any }

-- Pure calendar arithmetic (no host time zone involved).
local function daysFromCivil(y: number, m: number, d: number): number
	y -= m <= 2 and 1 or 0
	local era = (y >= 0 and y or y - 399) // 400
	local yoe = y - era * 400
	local doy = (153 * (m + (m > 2 and -3 or 9)) + 2) // 5 + d - 1
	local doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
	return era * 146097 + doe - 719468
end

local function civilFromDays(z: number): (number, number, number)
	z += 719468
	local era = (z >= 0 and z or z - 146096) // 146097
	local doe = z - era * 146097
	local yoe = (doe - doe // 1460 + doe // 36524 - doe // 146096) // 365
	local y = yoe + era * 400
	local doy = doe - (365 * yoe + yoe // 4 - yoe // 100)
	local mp = (5 * doy + 2) // 153
	local d = doy - (153 * mp + 2) // 5 + 1
	local m = mp + (mp < 10 and 3 or -9)
	return y + (m <= 2 and 1 or 0), m, d
end

local function lastSundayDays(year: number, month: number): number
	local last = daysFromCivil(year, month + 1, 1) - 1
	local weekday = (last + 4) % 7 -- 0 = Sunday (1970-01-01 was a Thursday)
	return last - weekday
end

-- Offset of Europe/Zurich in hours at a UTC timestamp (EU summer time rules).
local function zurichOffset(seconds: number): number
	local year = civilFromDays(seconds // 86400)
	local startAt = lastSundayDays(year, 3) * 86400 + 3600
	local endAt = lastSundayDays(year, 10) * 86400 + 3600
	return (seconds >= startAt and seconds < endAt) and 2 or 1
end

local function zurichParts(now: number): any
	local seconds = math.floor(now / 1000)
	local localSeconds = seconds + zurichOffset(seconds) * 3600
	local year, month, day = civilFromDays(localSeconds // 86400)
	local rest = localSeconds % 86400
	return { year = year, month = month, day = day, hour = rest // 3600, min = (rest % 3600) // 60, sec = rest % 60 }
end

function Daily.day(now: number): string
	local parts = zurichParts(now)
	return ("%04d-%02d-%02d"):format(parts.year, parts.month, parts.day)
end

function Daily.previousDay(day: string): string
	local year, month, date = string.match(day, "(%d+)-(%d+)-(%d+)")
	local y, m, d = civilFromDays(daysFromCivil(tonumber(year) :: number, tonumber(month) :: number, tonumber(date) :: number) - 1)
	return ("%04d-%02d-%02d"):format(y, m, d)
end

function Daily.msUntilNext(now: number): number
	local parts = zurichParts(now)
	return math.max(1000, (24 * 3600 - (parts.hour * 3600 + parts.min * 60 + parts.sec)) * 1000 - (now % 1000))
end

function Daily.status(state: any, key: string, now: number): any
	local today = Daily.day(now)
	local entry = state and state[key]
	local claimedToday = entry ~= nil and entry.day == today
	local continues = entry ~= nil and entry.day == Daily.previousDay(today)
	local streak = claimedToday and entry.streak or continues and entry.streak + 1 or 1
	local dayIndex = ((streak - 1) % #Daily.DAYS) + 1
	return {
		today = today, available = not claimedToday, claimedToday = claimedToday, streak = streak, dayIndex = dayIndex,
		reward = Daily.DAYS[dayIndex], broken = entry ~= nil and not claimedToday and not continues, msUntilNext = Daily.msUntilNext(now),
	}
end

function Daily.amount(day: any, passivePerSecond: number, clickPower: number): number
	local passive = math.max(0, passivePerSecond) * day.minutes * 60
	local clicks = math.max(0, clickPower) * day.minutes * 40
	return math.max(day.floor, math.floor(math.max(passive, clicks)))
end

-- Returns the claim or nil when today's reward was already collected.
function Daily.claim(state: any, key: string, passivePerSecond: number, clickPower: number, now: number): any?
	local status = Daily.status(state, key, now)
	if not status.available then
		return nil
	end
	local amount = Daily.amount(status.reward, passivePerSecond, clickPower)
	local pack = status.reward.pack and { id = ("daily-%s-%s"):format(key, status.today), packId = status.reward.pack, earnedAt = now } or nil
	local nextState = table.clone(state or {})
	nextState[key] = { day = status.today, streak = status.streak }
	return { amount = amount, dayIndex = status.dayIndex, streak = status.streak, reward = status.reward, pack = pack, state = nextState }
end

return Daily
