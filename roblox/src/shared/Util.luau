--!strict
-- Small helpers shared by the game logic: numbers, tables, hashing and formatting.
local Util = {}

function Util.clamp(value: number, minimum: number, maximum: number): number
	return math.max(minimum, math.min(maximum, value))
end

-- Mirrors Math.max(0, Math.min(0.999999, random())) of the web version.
function Util.bounded(random: () -> number): number
	local value = random()
	if value ~= value then
		return 0
	end
	return math.max(0, math.min(0.999999, value))
end

function Util.round(value: number): number
	return math.floor(value + 0.5)
end

function Util.round1(value: number): number
	return math.floor(value * 10 + 0.5) / 10
end

-- 32 bit unsigned multiplication like Math.imul followed by >>> 0.
function Util.imul(a: number, b: number): number
	a = bit32.band(a, 0xffffffff)
	b = bit32.band(b, 0xffffffff)
	local aHigh, aLow = bit32.rshift(a, 16), bit32.band(a, 0xffff)
	local bHigh, bLow = bit32.rshift(b, 16), bit32.band(b, 0xffff)
	local high = bit32.band(aHigh * bLow + aLow * bHigh, 0xffff)
	return bit32.band(aLow * bLow + bit32.lshift(high, 16), 0xffffffff)
end

-- FNV-1a over the UTF-16 code units of a string, as the web version hashes with charCodeAt.
local function codeUnits(text: string): { number }
	local units = {}
	for _, code in utf8.codes(text) do
		if code >= 0x10000 then
			local value = code - 0x10000
			table.insert(units, 0xd800 + bit32.rshift(value, 10))
			table.insert(units, 0xdc00 + bit32.band(value, 0x3ff))
		else
			table.insert(units, code)
		end
	end
	return units
end

function Util.fnv(text: string): number
	local hash = 2166136261
	for _, unit in codeUnits(text) do
		hash = Util.imul(bit32.bxor(hash, unit), 16777619)
	end
	return hash
end

-- Deterministic value in [0, 1) used for broadcast scenes and goal patterns.
function Util.seed(text: string): number
	local hash = Util.fnv(text)
	hash = Util.imul(bit32.bxor(hash, bit32.rshift(hash, 16)), 0x85ebca6b)
	hash = Util.imul(bit32.bxor(hash, bit32.rshift(hash, 13)), 0xc2b2ae35)
	return bit32.bxor(hash, bit32.rshift(hash, 16)) / 4294967296
end

-- Seeded random generator (mulberry32) for reproducible schedules.
function Util.seededRandom(seed: string): () -> number
	local state = Util.fnv(seed)
	return function()
		state = bit32.band(state + 0x6D2B79F5, 0xffffffff)
		local t = Util.imul(bit32.bxor(state, bit32.rshift(state, 15)), bit32.bor(1, state))
		t = bit32.bxor(t, bit32.band(t + Util.imul(bit32.bxor(t, bit32.rshift(t, 7)), bit32.bor(61, t)), 0xffffffff))
		return bit32.bxor(t, bit32.rshift(t, 14)) / 4294967296
	end
end

function Util.deepCopy<T>(value: T): T
	if type(value) ~= "table" then
		return value
	end
	local copy = {}
	for key, item in value :: any do
		copy[key] = Util.deepCopy(item)
	end
	return copy :: any
end

function Util.includes(list: { any }, value: any): boolean
	return table.find(list, value) ~= nil
end

function Util.indexOf(list: { any }, value: any): number
	return table.find(list, value) or 0
end

function Util.filter<T>(list: { T }, predicate: (T, number) -> boolean): { T }
	local result = {}
	for index, item in list do
		if predicate(item, index) then
			table.insert(result, item)
		end
	end
	return result
end

function Util.map<T, U>(list: { T }, transform: (T, number) -> U): { U }
	local result = {}
	for index, item in list do
		result[index] = transform(item, index)
	end
	return result
end

function Util.find<T>(list: { T }, predicate: (T) -> boolean): T?
	for _, item in list do
		if predicate(item) then
			return item
		end
	end
	return nil
end

function Util.findIndex<T>(list: { T }, predicate: (T, number) -> boolean): number
	for index, item in list do
		if predicate(item, index) then
			return index
		end
	end
	return 0
end

function Util.some<T>(list: { T }, predicate: (T) -> boolean): boolean
	for _, item in list do
		if predicate(item) then
			return true
		end
	end
	return false
end

function Util.every<T>(list: { T }, predicate: (T) -> boolean): boolean
	for _, item in list do
		if not predicate(item) then
			return false
		end
	end
	return true
end

function Util.sum<T>(list: { T }, value: (T) -> number): number
	local total = 0
	for _, item in list do
		total += value(item)
	end
	return total
end

function Util.unique<T>(list: { T }): { T }
	local seen, result = {}, {}
	for _, item in list do
		if not seen[item] then
			seen[item] = true
			table.insert(result, item)
		end
	end
	return result
end

function Util.concat<T>(...: { T }): { T }
	local result = {}
	for _, list in { ... } do
		for _, item in list do
			table.insert(result, item)
		end
	end
	return result
end

function Util.slice<T>(list: { T }, first: number, last: number?): { T }
	local result = {}
	local stop = last or #list
	for index = math.max(1, first), math.min(#list, stop) do
		table.insert(result, list[index])
	end
	return result
end

-- Keeps the newest entries, like array.slice(-limit).
function Util.tail<T>(list: { T }, limit: number): { T }
	return Util.slice(list, #list - limit + 1)
end

function Util.keys(map: { [string]: any }): { string }
	local result = {}
	for key in map do
		table.insert(result, key)
	end
	table.sort(result)
	return result
end

function Util.count(map: { [any]: any }): number
	local total = 0
	for _ in map do
		total += 1
	end
	return total
end

function Util.last<T>(list: { T }): T?
	return list[#list]
end

-- Stable sort: Luau's table.sort is not stable, so ties keep their original order.
function Util.stableSort<T>(list: { T }, less: (T, T) -> boolean): { T }
	local indexed = {}
	for index, item in list do
		indexed[index] = { item = item, index = index }
	end
	table.sort(indexed, function(a, b)
		if less(a.item, b.item) then
			return true
		end
		if less(b.item, a.item) then
			return false
		end
		return a.index < b.index
	end)
	for index, entry in indexed do
		list[index] = entry.item
	end
	return list
end

function Util.replaceAll(text: string, search: string, replacement: string): string
	local result, start = {}, 1
	while true do
		local first, last = string.find(text, search, start, true)
		if not first then
			break
		end
		table.insert(result, string.sub(text, start, first - 1))
		table.insert(result, replacement)
		start = (last :: number) + 1
	end
	table.insert(result, string.sub(text, start))
	return table.concat(result)
end

-- Swiss formatting with apostrophes: 1'234'567.
function Util.formatInteger(value: number): string
	local digits = tostring(math.max(0, math.floor(value)))
	if value >= 1e21 then
		return string.format("%.3g", value)
	end
	local result = string.reverse((string.gsub(string.reverse(digits), "(%d%d%d)", "%1'")))
	return (string.gsub(result, "^'", ""))
end

local UNITS = { "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Ud" }

-- Compact numbers exactly like the web HUD: 999, 1.2K, 35M, MAX.
function Util.formatNumber(value: number): string
	if value ~= value then
		return "0"
	end
	if value == math.huge then
		return "MAX"
	end
	if value <= 0 then
		return "0"
	end
	if value < 1000 then
		return Util.formatInteger(value)
	end
	local group = math.floor(math.log10(value) / 3) - 1
	if group >= #UNITS then
		return (string.gsub(string.format("%.2e", value), "e%+?0*", "e"))
	end
	local scaled = value / 1000 ^ (group + 1)
	return string.format(scaled < 10 and "%.1f" or "%.0f", scaled) .. UNITS[group + 1]
end

function Util.formatDecimal(value: number, decimals: number): string
	return (string.gsub(string.format("%." .. decimals .. "f", value), "%.", ","))
end

function Util.formatCountdown(untilMs: number, now: number): string
	local seconds = math.max(0, math.ceil((untilMs - now) / 1000))
	return string.format("%02d:%02d", seconds // 60, seconds % 60)
end

function Util.formatSigned(value: number, decimals: number?): string
	local text = decimals and Util.formatDecimal(value, decimals) or tostring(value)
	return (value >= 0 and "+" or "") .. text
end

-- Short random id like Math.random().toString(36).slice(2, 7).
function Util.randomId(random: (() -> number)?): string
	local alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
	local roll = random or math.random
	local parts = {}
	for _ = 1, 5 do
		local index = math.floor(roll() * 36) + 1
		table.insert(parts, string.sub(alphabet, index, index))
	end
	return table.concat(parts)
end

function Util.lower(text: string): string
	return string.lower(text)
end

function Util.hexColor(hex: string): (number, number, number)
	local r, g, b = string.match(hex, "#?(%x%x)(%x%x)(%x%x)")
	if not r then
		return 128, 128, 128
	end
	return tonumber(r, 16) :: number, tonumber(g, 16) :: number, tonumber(b, 16) :: number
end

return Util
