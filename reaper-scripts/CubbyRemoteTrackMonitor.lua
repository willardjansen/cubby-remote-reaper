--[[
  Cubby Remote - Track Monitor for Reaper
  Reads Reaticulate bank from selected track and sends articulations to browser
]]--

local WS_PORT = 3001
local lastSentTrack = ""
local reabankCache = {}  -- Cache parsed reabank files
local bankCounter = 0    -- Counter for unique bank IDs when using wildcards

-- Parse a .reabank file and return banks indexed by "msb-lsb"
function parseReabankFile(filepath)
  local file = io.open(filepath, "r")
  if not file then return nil end

  local banks = {}
  local currentBank = nil
  local currentMeta = {}

  local lineNum = 0
  local bankCount = 0
  for line in file:lines() do
    lineNum = lineNum + 1
    line = line:match("^%s*(.-)%s*$")  -- trim

    -- Debug: show first 10 lines of each file
    if lineNum <= 10 then
      reaper.ShowConsoleMsg("[LINE " .. lineNum .. "] " .. (line or "nil"):sub(1,50) .. "\n")
    end

    -- Skip empty lines
    if line == "" then
      -- skip
    -- Bank definition: Bank MSB LSB Name
    elseif line:sub(1,4) == "Bank" then
      bankCount = bankCount + 1
      if bankCount <= 5 then
        reaper.ShowConsoleMsg("[BANK] " .. line:sub(1,60) .. "\n")
      end
      -- Use more flexible pattern - capture anything between Bank and the name
      local msb, lsb, name = line:match("^Bank%s+(%S+)%s+(%S+)%s+(.+)$")
      if msb and lsb and name then
        -- Handle * wildcards - use counter for unique ID
        local msbNum, lsbNum
        if msb == "*" or lsb == "*" then
          bankCounter = bankCounter + 1
          msbNum = bankCounter
          lsbNum = 0
        else
          msbNum = tonumber(msb)
          lsbNum = tonumber(lsb)
        end
        currentBank = {
          msb = msbNum,
          lsb = lsbNum,
          name = name,
          articulations = {}
        }
        local key = msbNum .. "-" .. lsbNum
        banks[key] = currentBank
        banks[name:lower()] = currentBank  -- Also index by name
        currentMeta = {}
      end
    -- Metadata: //! c=color o=output etc
    elseif line:match("^//!") then
      currentMeta.color = line:match("c=([^%s]+)") or currentMeta.color
      currentMeta.output = line:match("o=([^%s]+)") or currentMeta.output
    -- Articulation: number name
    elseif line:match("^%d+%s+.+$") and currentBank then
      local num, artName = line:match("^(%d+)%s+(.+)$")
      if num and artName then
        table.insert(currentBank.articulations, {
          number = tonumber(num),
          name = artName,
          color = currentMeta.color or "default",
          output = currentMeta.output
        })
        currentMeta = {}
      end
    end
  end

  file:close()
  return banks
end

-- Load all reabank files from Reaper's Data folder
function loadReabanks()
  local dataPath = reaper.GetResourcePath() .. "/Data/"

  -- Find .reabank files
  local i = 0
  while true do
    local file = reaper.EnumerateFiles(dataPath, i)
    if not file then break end

    if file:match("%.reabank$") then
      local fullPath = dataPath .. file
      reaper.ShowConsoleMsg("[Cubby] Loading: " .. file .. "\n")
      local banks = parseReabankFile(fullPath)
      if banks then
        for k, v in pairs(banks) do
          reabankCache[k] = v
        end
      end
    end
    i = i + 1
  end

  local count = 0
  for _ in pairs(reabankCache) do count = count + 1 end
  reaper.ShowConsoleMsg("[Cubby] Loaded " .. math.floor(count/2) .. " banks\n")
end

-- Get track GUID as string
function getTrackGUID(track)
  if not track then return nil end
  local guid = reaper.GetTrackGUID(track)
  return guid
end

-- Get Reaticulate bank assignment from track
-- Reaticulate stores bank config in project extension state
function getReaticuateBank(track)
  if not track then return nil end

  local trackGUID = getTrackGUID(track)
  if not trackGUID then return nil end

  -- Method 1: Try Reaticulate's project extension state
  -- Reaticulate stores track config as: reaticulate.track.<guid>
  local retval, extState = reaper.GetProjExtState(0, "reaticulate", "track." .. trackGUID)
  if retval > 0 and extState and extState ~= "" then
    -- Parse the extension state - format varies by Reaticulate version
    -- Try to find bank MSB/LSB in the config
    local msb = extState:match("msb=(%d+)")
    local lsb = extState:match("lsb=(%d+)")
    if msb and lsb then
      local key = msb .. "-" .. lsb
      if reabankCache[key] then
        return reabankCache[key]
      end
    end
  end

  -- Method 2: Check Reaticulate JSFX parameters directly
  local fxCount = reaper.TrackFX_GetCount(track)
  for i = 0, fxCount - 1 do
    local retval, fxName = reaper.TrackFX_GetFXName(track, i, "")
    if fxName and fxName:lower():find("reaticulate") then
      -- Reaticulate JSFX stores current bank in slider parameters
      -- Try to get bank from FX preset/state
      local retval, presetName = reaper.TrackFX_GetPreset(track, i, "")

      -- Also try reading the FX state chunk for bank info
      local retval, fxChunk = reaper.TrackFX_GetNamedConfigParm(track, i, "focused_widget_state_str")

      -- Try getting the track state chunk and look for Reaticulate's data
      local retval, chunk = reaper.GetTrackStateChunk(track, "", false)
      if chunk then
        -- Look for bank assignment patterns in JSFX state
        -- Reaticulate stores bank as serialized data
        for bankStr in chunk:gmatch("<JS reaticulate.->(.-)<") do
          local msb = bankStr:match("(%d+)%s+%d+%s+//bank")
          local lsb = bankStr:match("%d+%s+(%d+)%s+//bank")
          if msb and lsb then
            local key = msb .. "-" .. lsb
            if reabankCache[key] then
              return reabankCache[key]
            end
          end
        end
      end
    end
  end

  -- Method 3: Try to match track name to bank name in cache
  local trackName = getTrackName(track)
  if trackName then
    local lowerName = trackName:lower()
    -- Check if any bank name contains the track name or vice versa
    for key, bank in pairs(reabankCache) do
      if type(key) == "string" and type(bank) == "table" and bank.name then
        local bankLower = bank.name:lower()
        if bankLower:find(lowerName, 1, true) or lowerName:find(bankLower, 1, true) then
          return bank
        end
      end
    end
  end

  return nil
end

function getTrackName(track)
  if not track then return nil end
  local retval, name = reaper.GetTrackName(track)
  if not name or name == "" then
    local trackNum = math.floor(reaper.GetMediaTrackInfo_Value(track, "IP_TRACKNUMBER"))
    return "Track " .. trackNum
  end
  return name
end

-- Convert bank to JSON
function bankToJson(bank, trackName)
  local arts = {}
  for i, art in ipairs(bank.articulations) do
    table.insert(arts, string.format(
      '{"number":%d,"name":"%s","color":"%s"}',
      art.number,
      art.name:gsub('"', '\\"'),
      art.color or "default"
    ))
  end

  return string.format(
    '{"type":"bankData","trackName":"%s","bankName":"%s","msb":%d,"lsb":%d,"articulations":[%s]}',
    trackName:gsub('"', '\\"'),
    bank.name:gsub('"', '\\"'),
    bank.msb,
    bank.lsb,
    table.concat(arts, ",")
  )
end

function sendBankData(trackName, bank)
  local json = bankToJson(bank, trackName)
  -- Write to temp file for curl (JSON might be too long for command line)
  local tmpFile = os.tmpname()
  local f = io.open(tmpFile, "w")
  f:write(json)
  f:close()

  local cmd = string.format(
    'curl -s -X POST -H "Content-Type: application/json" -d @%s http://localhost:%d/track && rm %s &',
    tmpFile, WS_PORT, tmpFile
  )
  os.execute(cmd)
end

function sendTrackOnly(trackName)
  local json = string.format('{"type":"trackChange","trackName":"%s"}', trackName:gsub('"', '\\"'))
  local cmd = string.format(
    'curl -s -X POST -H "Content-Type: application/json" -d \'%s\' http://localhost:%d/track &',
    json, WS_PORT
  )
  os.execute(cmd)
end

function poll()
  local track = reaper.GetSelectedTrack(0, 0)

  if track then
    local trackName = getTrackName(track)

    if trackName ~= lastSentTrack then
      lastSentTrack = trackName

      local bank = getReaticuateBank(track)
      if bank then
        reaper.ShowConsoleMsg("[Cubby] " .. trackName .. " -> " .. bank.name .. " (" .. #bank.articulations .. " arts)\n")
        sendBankData(trackName, bank)
      else
        reaper.ShowConsoleMsg("[Cubby] " .. trackName .. " (no Reaticulate bank)\n")
        sendTrackOnly(trackName)
      end
    end
  elseif lastSentTrack ~= "" then
    lastSentTrack = ""
  end

  reaper.defer(poll)
end

-- Initialize
reaper.ShowConsoleMsg("\n========================================\n")
reaper.ShowConsoleMsg("[Cubby Remote] Track Monitor\n")
reaper.ShowConsoleMsg("========================================\n")
loadReabanks()
reaper.ShowConsoleMsg("[Cubby] Monitoring track selection...\n\n")
poll()
