--!nonstrict
-- DataStore access with session locking, so a club is never open on two servers at once.
-- Without DataStore access (Studio without API access) everything stays in memory.
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")

local Store = {}

local LOCK_TIMEOUT_SECONDS = 150
local RETRIES = 5

local memory: { [string]: any } = {}
local stores: { [string]: any } = {}
local available: boolean? = nil

local function getStore(name: string): any?
	if available == false then
		return nil
	end
	if stores[name] then
		return stores[name]
	end
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(name)
	end)
	if not ok then
		warn("[Store] DataStore nicht verfügbar, Spielstände bleiben nur im Speicher:", result)
		available = false
		return nil
	end
	stores[name] = result
	return result
end

function Store.isPersistent(): boolean
	return available ~= false
end

local function jobId(): string
	return game.JobId ~= "" and game.JobId or "studio"
end

local function memoryKey(storeName: string, key: string): string
	return storeName .. "/" .. key
end

-- Loads and locks a record. Returns (data, nil) or (nil, error message).
-- data is nil for a new record; the record shape is { lock = {...}, data = ... }.
function Store.acquire(storeName: string, key: string, force: boolean?): (any?, string?)
	local store = getStore(storeName)
	if not store then
		local entry = memory[memoryKey(storeName, key)]
		if entry and entry.lockedBy and not force then
			return nil, "locked"
		end
		memory[memoryKey(storeName, key)] = { lockedBy = jobId(), data = entry and entry.data }
		return entry and entry.data, nil
	end
	for attempt = 1, RETRIES do
		local lockedElsewhere = false
		local loaded: any = nil
		local ok, problem = pcall(function()
			store:UpdateAsync(key, function(record)
				record = record or {}
				local lock = record.lock
				local now = os.time()
				if lock and lock.jobId ~= jobId() and now - (lock.time or 0) < LOCK_TIMEOUT_SECONDS and not force then
					lockedElsewhere = true
					loaded = nil
					return nil
				end
				lockedElsewhere = false
				record.lock = { jobId = jobId(), time = now }
				loaded = record.data
				return record
			end)
		end)
		if ok and not lockedElsewhere then
			return loaded, nil
		end
		if ok and lockedElsewhere and attempt == RETRIES then
			return nil, "locked"
		end
		if not ok then
			warn(("[Store] Laden fehlgeschlagen (%s/%s), Versuch %d: %s"):format(storeName, key, attempt, tostring(problem)))
			if RunService:IsStudio() then
				-- Studio without "Enable Studio Access to API Services": keep playing in memory.
				warn("[Store] Studio ohne Speicherzugriff: Spielstände bleiben nur im Speicher.")
				available = false
				return Store.acquire(storeName, key, force)
			end
		end
		task.wait(attempt * 2)
	end
	return nil, "unavailable"
end

-- Writes the data and refreshes (or releases) the lock.
function Store.save(storeName: string, key: string, data: any, release: boolean?): boolean
	local store = getStore(storeName)
	if not store then
		local entry = memory[memoryKey(storeName, key)] or {}
		entry.data = data
		entry.lockedBy = (not release) and jobId() or nil
		memory[memoryKey(storeName, key)] = entry
		return true
	end
	for attempt = 1, 3 do
		local ok, problem = pcall(function()
			store:UpdateAsync(key, function(record)
				record = record or {}
				if record.lock and record.lock.jobId ~= jobId() and os.time() - (record.lock.time or 0) < LOCK_TIMEOUT_SECONDS then
					-- Another server took over (for example after a crash here); never overwrite it.
					return nil
				end
				record.data = data
				record.lock = (not release) and { jobId = jobId(), time = os.time() } or nil
				return record
			end)
		end)
		if ok then
			return true
		end
		warn(("[Store] Speichern fehlgeschlagen (%s/%s), Versuch %d: %s"):format(storeName, key, attempt, tostring(problem)))
		if RunService:IsStudio() then
			break
		end
		task.wait(attempt)
	end
	return false
end

-- Plain read without a lock (used to look up coop worlds before joining).
function Store.peek(storeName: string, key: string): any?
	local store = getStore(storeName)
	if not store then
		local entry = memory[memoryKey(storeName, key)]
		return entry and entry.data
	end
	local ok, record = pcall(function()
		return store:GetAsync(key)
	end)
	return ok and record and record.data or nil
end

local ordered: { [string]: any } = {}
function Store.setRanking(name: string, key: string, value: number)
	if available == false then
		return
	end
	local ok, store = pcall(function()
		ordered[name] = ordered[name] or DataStoreService:GetOrderedDataStore(name)
		return ordered[name]
	end)
	if ok and store then
		pcall(function()
			store:SetAsync(key, math.floor(math.min(value, 9e15)))
		end)
	end
end

function Store.topRanking(name: string, count: number): { any }
	if available == false then
		return {}
	end
	local ok, result = pcall(function()
		ordered[name] = ordered[name] or DataStoreService:GetOrderedDataStore(name)
		local pages = ordered[name]:GetSortedAsync(false, count)
		return pages:GetCurrentPage()
	end)
	return ok and result or {}
end

return Store
