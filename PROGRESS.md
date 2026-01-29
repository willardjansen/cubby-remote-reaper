# Cubby Remote for Reaper - Progress

## 2026-01-29: v1.2.1 - Fixed MIDI Output in Packaged App

### Problem
MIDI output wasn't working in the packaged Electron app - JZZ library returns empty port lists.

### Solution
- Added `midi` package dependency
- Switched from `JZZ` to `midi` package for MIDI output (more reliable in Electron)
- Updated `sendMidi()` to use `midiOut.sendMessage()`
- Added README with setup and troubleshooting docs

---

## Overview

Cubby Remote for Reaper is a browser-based articulation switching app that integrates with Reaper and Reaticulate. When you select a track in Reaper that has a Reaticulate bank assigned, the browser automatically displays the corresponding articulations as clickable buttons.

## Architecture

```
┌─────────────────┐     HTTP POST      ┌─────────────────┐     WebSocket     ┌─────────────────┐
│     Reaper      │ ─────────────────> │  midi-server.js │ ─────────────────> │    Browser      │
│  (Lua Script)   │    port 3001       │   (Node.js)     │    port 3001      │  (Next.js App)  │
└─────────────────┘                    └─────────────────┘                    └─────────────────┘
        │                                       │                                      │
        │ Monitors track selection              │                      Displays articulations
        │ Parses .reabank files                 │                      Sends MIDI on click
        │ Matches tracks to banks               │                              │
        │                                       ▼                              │
        │                              ┌─────────────────┐                     │
        │                              │   IAC Driver    │ <───────────────────┘
        │                              │ (ArticulationRemote)
        │                              └─────────────────┘
        │                                       │
        │                                       ▼
        │                              ┌─────────────────┐
        └─────────────────────────────>│   Reaticulate   │
                                       │     (JSFX)      │
                                       └─────────────────┘
```

## Current Status: WORKING

- Track switching updates browser display
- Articulation buttons trigger correct keyswitches in Reaticulate
- Colors display correctly (when reabank has color metadata)
- Keyboard input working (Arturia KeyLab 88 tested)

## Components

### 1. Lua Script (`CubbyRemoteTrackMonitor.lua`)
- Location: `~/Library/Application Support/REAPER/Scripts/`
- Monitors selected track in Reaper
- Parses all `.reabank` files from Reaper's Data folder
- Matches track names to Reaticulate banks
- Extracts color metadata (`//! c=color`) from reabank files
- Sends bank data (articulations, colors, MSB/LSB) via HTTP POST to the MIDI server

### 2. MIDI Server (`midi-server.js`)
- Node.js server running on port 3001
- Receives HTTP POST from Lua script at `/track` endpoint
- Broadcasts bank data to all connected browsers via WebSocket
- Outputs MIDI to IAC Driver (ArticulationRemote port)

### 3. Browser App (`src/app/page.tsx`)
- Next.js React application running on port 3000
- Connects to MIDI server via WebSocket
- Shows "Select a track in Reaper" when no bank loaded
- Displays articulation grid with colored buttons
- Sends Program Change messages when articulations are clicked

### 4. Template Builder (`src/app/template-builder/page.tsx`)
- Accessible at http://localhost:3000/template-builder
- Loads banks from `reabank/` folder via API
- Folder tree with checkboxes for selecting banks
- Organizes banks by library name, with instrument subfolders for large libraries
- Generates .RPP files with Reaticulate banks pre-assigned
- Matching Cubase version styling (dark blue theme, yellow folders, document icons)

## Completed Work

### Session 1: Initial Setup
- Fixed reabank parser to handle `Bank * *` wildcard format
- Successfully loads 15,371+ banks from Reaticulate-ArtConductor.reabank
- Improved bank matching: exact matches prioritized, partial matches scored by length
- Banks indexed by both MSB-LSB key and lowercase name

### Session 2: MIDI Routing & Colors
- **Fixed MIDI routing**: Changed output to "ArticulationRemote" IAC port (matches Reaper's naming)
- **Fixed articulation switching**: Sends Program Change only (removed Bank Select CC messages)
- **Keyboard working**: Enabled Arturia KeyLab 88 MIDI input in Reaper preferences
- **Track switching**: Grid updates when selecting different tracks in Reaper
- **Colors working**: Lua script parses `//! c=color` metadata from reabank files
- **Initial screen**: Shows "Select a track in Reaper" instead of demo data
- **Removed cruft**: Removed file upload UI and getting started help text

### Session 3: Template Builder
- **Template Builder UI** (`/template-builder`): Generates .RPP files with Reaticulate banks pre-assigned
- **Reaticulate Integration**: Reverse-engineered correct format from actual Reaper project files
  - Track-level `<EXT>` block with JSON config
  - Project-level `<EXTSTATE>` with `msblsb_by_guid` mapping
  - JSFX path: `jsfx/Reaticulate.jsfx`
- **API Route** (`/api/reabanks/`): Reads banks from `reabank/` folder in project root
- **Folder Tree UI**: Matches Cubase version styling
  - Yellow SVG folder icons (open/closed states)
  - Document icons for individual banks
  - Three-state checkboxes (none/some/all)
  - Blue folder names (#60a5fa), gray counts
- **Library Name Mapping**: Converts abbreviations to full library names via regex patterns
  - 8Dio (Adagio, Century, Agitato, Lacrimosa, etc.)
  - Spitfire (Studio, Chamber, Albion, BBC SO)
  - EastWest (Hollywood Orchestra/Strings/Brass/Woodwinds)
  - Orchestral Tools (Berlin, Metropolis Ark, Inspire)
  - Vienna Symphonic Library (Synchron, SE editions)
  - Native Instruments, Audio Imperia, Cinesamples
  - Sonokinetic, Submission Audio, Sample Modeling
  - And 50+ more library mappings
- **Folder Structure**: Banks organized by library, with optional instrument subfolders for large libraries
  - Small libraries: Library → Bank Name
  - Large libraries (VSL, 8Dio Century, etc.): Library → Instrument → Bank Name

### Session 4: Template Builder Fixes
- **RPP Generation Verified**: Generated .RPP templates work in Reaper with Reaticulate banks correctly assigned!
- **Fixed regex patterns**: All library prefix patterns now allow digits (e.g., `VSBB1`, `OTI2`)
  - Changed `[A-Z]+` to `[A-Z0-9]+` throughout
  - Added `VSBB[0-9]*` → "VSL Big Bang Orchestra"
  - Banks like "VSBB1 Woodwinds Tutti" now correctly categorized
- **Fixed individual bank selection**: Checkbox onClick now properly toggles selection
  - Previously clicking checkbox did nothing (empty onClick handler)
  - Added hover state for bank items
- **Added specific 8Dio library mappings** to prevent generic "8Dio" catch-all:
  - 8DFIS → Fiore Intimate Strings
  - 8DFIT → Fiore Intimate Tutti
  - 8DFT → Fire Toolkit
  - 8DINS → Insolidus
  - 8DLAC → Lacrimosa
  - 8DLI → Liberis
  - 8DMAJ/8DMJ* → Majestica
  - 8DOBS → Ostinato Brass
  - 8DOWS → Ostinato Woodwinds
  - 8DREP → Repertoire
  - 8DRQN → Requiem
  - 8DSIC → Silka
  - 8DSYS → Symphony
  - 8DSS* → Studio Sopranos

### Session 5: Instrument Subfolders for Large Libraries
- **Added instrument subfolder extraction** for large libraries with hundreds of banks
  - VSL Synchron, VSL Synchron-ized, VSL SE, Vienna Symphonic Library
  - 8Dio Century, 8Dio Adagio, 8Dio Agitato, 8Dio (generic)
  - Orchestral Tools (Berlin Brass/Strings/Woodwinds, Metropolis Ark)
  - EW Hollywood (Strings/Brass/Woodwinds/Orchestra)
  - Spitfire Audio, BBC Symphony Orchestra
- **Instrument pattern matching**: Extracts instrument from bank name beginning
  - Full names: Violin, Viola, Cello, Bass, Trumpet, Trombone, Horn, Flute, etc.
  - Numbered variants: Violin 1, Cellos 2, Trumpets 1-3
  - Prefixed: 1st Violin, Second Violin, French Horn, English Horn
  - VSL patterns: Appassionata, Chamber, Synchron, Dimension, Syzd
  - Choir: Soprano, Alto, Tenor, Basso Profondo, ATB
- **Abbreviation detection**: Second-pass matching for libraries using short codes
  - Strings: Vln/Vn (Violins), Vla/Va (Violas), Vc/Vlc (Cellos), CB (Basses)
  - Brass: Tpt/Tp (Trumpets), Tbn/Trb (Trombones), Hn/Hrn (Horns), Tba (Tubas)
  - Woodwinds: Fl (Flutes), Ob (Oboes), Cl (Clarinets), Bn/Bsn (Bassoons)
  - Sections: Str/Strings, Brass, WW/Woodwinds, Perc/Percussion
- **Century banks now properly organized**: "Century Ens Lite CB" → 8Dio Century → Basses
- **VSL banks now properly organized**: "03 Basso Profondo Choir" → Vienna Symphonic Library → Basso Profondo

### Color Mapping
Browser maps Reaticulate color names to visual colors:
- `legato` → Blue
- `long`, `long-light`, `long-dark` → Green shades
- `short`, `short-light`, `short-dark`, `staccato` → Orange shades
- `pizz` → Pink
- `fx`, `col-legno`, `sul-pont`, `sul-tasto` → Purple
- `tremolo`, `trill` → Yellow/Gold
- `default` → Gray

## How to Run

1. **Start the MIDI server:**
   ```bash
   cd ~/dev/cubby-remote-reaper
   node midi-server.js
   ```
   Should show: `✅ Output: Browser to Cubase ArticulationRemote`

2. **Start the browser app:**
   ```bash
   cd ~/dev/cubby-remote-reaper
   npm run dev
   ```

3. **In Reaper:**
   - Ensure IAC Driver inputs are enabled (Preferences > MIDI Inputs)
   - Enable both "IAC Driver - Bus 1" and "IAC Driver - ArticulationRemote"
   - Actions > Show action list
   - Run script: `CubbyRemoteTrackMonitor.lua`

4. **Open browser:**
   - Desktop: http://localhost:3000
   - iPad/mobile: http://[your-ip]:3000 (e.g., http://192.168.1.38:3000)

5. **Select a track** in Reaper with Reaticulate configured

## Files Modified

| File | Changes |
|------|---------|
| `midi-server.js` | Changed MIDI output priority to prefer ArticulationRemote |
| `src/app/page.tsx` | Program Change only, initial waiting screen, color logging |
| `src/components/ArticulationGrid.tsx` | Added null safety check |
| `~/Library/.../CubbyRemoteTrackMonitor.lua` | Added color parsing debug logging |
| `src/app/template-builder/page.tsx` | Template Builder UI with folder tree, library mapping, instrument sections |
| `src/app/api/reabanks/route.ts` | API to read .reabank files from reabank folder |
| `src/lib/rppGenerator.ts` | Generates .RPP files with Reaticulate bank assignments |
| `reabank/` | Folder for .reabank files (loaded by API) |

## Known Issues

- **Duplicate banks**: If the same bank name exists twice in reabank file, the second overwrites the first (may lose colors)
- **IAC naming**: macOS shows "Browser to Cubase..." but Reaper shows "IAC Driver..." - same ports, different names

## Tested Setup

- macOS with Reaper 7
- Reaticulate JSFX installed
- Reaticulate.reabank (converted from Art Conductor, 15,371 banks)
- IAC Driver with "ArticulationRemote" port
- Arturia KeyLab Essential 88 (for keyboard input)
- Kontakt 8 with Native Instruments Cremona Quartet

## Next Steps

- [x] ~~Test MIDI output to Reaper via virtual MIDI port~~ DONE
- [x] ~~Connect Arturia KeyLab 88 for physical testing~~ DONE
- [x] ~~Template Builder with Reaticulate bank assignments~~ DONE
- [x] ~~Library name mapping (abbreviations → full names)~~ DONE
- [x] ~~Instrument section subfolders~~ RE-ADDED for large libraries only (VSL, 8Dio Century, etc.)
- [x] ~~Test generated .RPP files in Reaper~~ WORKING - Reaticulate banks load correctly!
- [ ] Clean up duplicate banks in reabank file
- [ ] Add visual feedback when articulation is triggered
- [ ] Persist grid layout preferences (columns, button size)
- [ ] Add support for multiple banks per track
