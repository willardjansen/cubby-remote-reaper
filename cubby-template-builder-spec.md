# Cubby Template Builder for Reaper - Project Specification

## Project Overview

Build an Electron-based desktop application that generates Reaper project templates with pre-configured tracks and Reaticulate articulation banks. This is similar to the Cubase Template Builder but leverages Reaper's open architecture to directly write expression maps into project files.

## Background Context

### The Problem
- User has 15,360 Reaticulate articulation banks (converted from Art Conductor/Studio One)
- Creating orchestral templates manually is time-consuming
- Need to assign Kontakt + Reaticulate JSFX + specific banks to each track
- Reaper's `.RPP` project files are text-based (unlike Cubase's binary format), making programmatic generation possible

### Key Advantage Over Cubase
In Cubase, we had to hack binary `.tracktemplate` files (unreliable). With Reaper, we can cleanly generate text-based `.RPP` files with all configurations included.

## Technical Stack

### Frontend
- **Electron** - Desktop application framework
- **HTML/CSS/JS** - UI layer
- **Design aesthetic:** Pink neon theme (consistent with other Cubby apps)
- **Framework:** Vanilla JS or lightweight framework (user preference)

### Backend
- **Node.js** - File parsing and generation
- **No external dependencies** for core functionality if possible
- Parse `.reabank` files
- Generate `.RPP` (Reaper Project) files

## Core Features

### 1. Bank Library Browser
**Purpose:** Display and search through 15,360 Reaticulate banks

**UI Requirements:**
- Search/filter box (instant search)
- Hierarchical tree view organized by:
  - Developer/Library (Spitfire, 8Dio, Orchestral Tools, etc.)
  - Instrument family (Strings, Brass, Woodwinds, etc.)
  - Specific instrument
- Bank preview showing:
  - Bank name
  - Number of articulations
  - List of articulations with icons/colors

**Data Source:**
- Parse from: `/Users/[username]/Library/Application Support/REAPER/Data/Reaticulate-ArtConductor.reabank`
- This is a single 15.59MB text file with 15,360 bank definitions

### 2. Template Builder Interface
**Purpose:** Select banks and configure template structure

**Layout:**
- **Left panel:** Bank browser (search/filter)
- **Right panel:** Selected tracks/instruments
- **Bottom panel:** Template settings

**Track Configuration:**
- Each selected bank becomes a track
- User can:
  - Reorder tracks (drag and drop)
  - Group tracks into folders
  - Set track colors
  - Configure routing/buses
  - Name tracks (auto-generated from bank name, editable)

**Template Settings:**
- Project name
- Sample rate (44.1k, 48k, 96k)
- Buffer size
- Track count display
- Optional: Folder structure presets (e.g., "Orchestral Standard", "Hybrid", etc.)

### 3. Project File Generation
**Purpose:** Create valid Reaper `.RPP` project file with all configurations

**Output Format:** `.RPP` file (Reaper Project)

**Track Configuration per instrument:**
```
TRACK {GUID}
  NAME "Track Name"
  TRACKID {GUID}
  
  // Kontakt VST3 instance
  <VST "VST3: Kontakt 8 (Native Instruments)" kontakt.vst3 0 "" {GUID}
    // Kontakt specific state data
  >
  
  // Reaticulate JSFX
  <JS reaticulate "Reaticulate"
    // Reaticulate configuration
  >
  
  // Reaticulate bank assignment stored in extension data
  <FXCHAIN_REC
    REATICULATE_TRACK_BANK_CONFIG
    // Bank MSB/LSB assignment
  >
}
```

**Key Elements to Generate:**
1. **Track header** with unique GUID
2. **Kontakt VST3** plugin instance (empty, user loads patches manually)
3. **Reaticulate JSFX** (JS: reaticulate)
4. **Bank assignment** via Reaticulate's extension data format
5. **Track color** (based on instrument family or user choice)
6. **Folder structure** (if tracks are grouped)

### 4. Reaticulate Integration

**Bank Assignment Format:**
Reaticulate stores bank assignments in project extension data. Format example:
```
<REATICULATE_TRACK_CONFIG
  TRACK_INDEX 0
  BANK_MSB 1
  BANK_LSB 2
  CHANNEL_SOURCE 0
  CHANNEL_DEST 0
>
```

**Bank MSB/LSB Mapping:**
- Each bank in the `.reabank` file has: `Bank [MSB] [LSB] [Name]`
- Parse these values and write them into track configuration
- Example: `Bank 42 1 NICRQ Amati Viola Longs` → MSB=42, LSB=1

## File Format Specifications

### Input: Reaticulate .reabank Format

**Location:** `~/Library/Application Support/REAPER/Data/Reaticulate-ArtConductor.reabank`

**Format Example:**
```
// Comment lines start with //
Bank 42 1 NICRQ Amati Viola Longs
//! c=long i=note-whole o=note:24
1 Long Finger
//! c=long i=tremolo o=note:25
2 Tremolo Bowed
//! c=legato i=legato o=note:26
3 Long Porta

Bank 42 2 Another Bank Name
//! c=short i=staccato o=note:36
1 Staccato
```

**Parsing Requirements:**
- Extract bank definitions (starts with `Bank [MSB] [LSB] [Name]`)
- Extract articulations (lines with numbers after `//!` declarations)
- Build hierarchical structure from bank names (use naming convention to infer hierarchy)
- Store articulation metadata (colors, icons, output events)

### Output: Reaper .RPP Format

**Location:** User-specified save location

**Format:** Text-based, space-indented hierarchical structure

**Minimal Project Template:**
```
<REAPER_PROJECT 0.1 "7.0" 1234567890
  TEMPO 120 4 4
  SAMPLERATE 48000
  
  TRACK {GUID-HERE}
    NAME "Track Name"
    TRACKID {GUID-HERE}
    
    <VST "VST3: Kontakt 8 (Native Instruments)" kontakt.vst3 0 "" {GUID}
    >
    
    <JS reaticulate "Reaticulate"
    >
  >
>
```

**GUID Generation:** Use Node.js crypto to generate RFC4122 UUIDs in format: `{12345678-1234-1234-1234-123456789ABC}`

**Critical Details:**
- Indentation uses spaces (2 spaces per level)
- Opening tags: `<TAGNAME`
- Closing tags: `>`
- Track GUIDs must be unique
- VST state data can be empty/minimal (user loads patches)
- Reaticulate JSFX must be present for articulation switching to work

## UI/UX Design Guidelines

### Visual Style
**Theme:** Dark with pink/neon accents (consistent with Cubby Apps suite)

**Colors:**
- Background: `#1a1a1a` (dark gray/black)
- Panel backgrounds: `#252525`
- Text: `#e0e0e0` (light gray)
- Accent: `#ff69b4` or similar pink/neon
- Borders: `#333333`

**Typography:**
- Modern sans-serif (e.g., Inter, SF Pro, Segoe UI)
- Clear hierarchy (headings, body, captions)

### Layout
```
┌─────────────────────────────────────────────────┐
│ Cubby Template Builder          [_][□][X]      │
├──────────────┬──────────────────────────────────┤
│              │                                  │
│  BANK        │  SELECTED TRACKS                 │
│  BROWSER     │                                  │
│              │  [Track 1: Violin 1 - Longs]     │
│  Search: ___ │  [Track 2: Violin 2 - Shorts]    │
│              │  [Track 3: Viola - Ensemble]     │
│  □ Spitfire  │  [Track 4: Cello - Legato]       │
│    □ Strings │                                  │
│    □ Brass   │  [+ Add Track]                   │
│  □ 8Dio      │                                  │
│  □ Native    │                                  │
│              │                                  │
│              │                                  │
├──────────────┴──────────────────────────────────┤
│ Template Settings                               │
│ Name: [My Orchestral Template_______]           │
│ Sample Rate: [48000 ▾]  Tracks: 4              │
│                                                 │
│          [Generate Template]                    │
└─────────────────────────────────────────────────┘
```

### Interactions
1. **Search:** Type-to-filter, instant results
2. **Bank selection:** Double-click or drag-and-drop to add to template
3. **Track reordering:** Drag and drop in right panel
4. **Track removal:** Delete key or remove button
5. **Generate:** Click button → file save dialog → write `.RPP` file

## Implementation Phases

### Phase 1: Parser and Data Model
**Goal:** Read and parse Reaticulate banks

**Tasks:**
1. Read `Reaticulate-ArtConductor.reabank` file
2. Parse bank definitions (MSB, LSB, name)
3. Parse articulations per bank
4. Build in-memory data structure
5. Implement search/filter logic
6. Test with 15,360 banks (performance must be acceptable)

**Data Structure:**
```javascript
{
  banks: [
    {
      msb: 42,
      lsb: 1,
      name: "NICRQ Amati Viola Longs",
      path: ["Native Instruments", "Amati Viola", "Longs"], // parsed from name
      articulations: [
        { number: 1, name: "Long Finger", color: "long", icon: "note-whole", output: "note:24" },
        { number: 2, name: "Tremolo Bowed", color: "long", icon: "tremolo", output: "note:25" }
      ]
    }
  ]
}
```

### Phase 2: UI Shell
**Goal:** Create Electron app with basic UI

**Tasks:**
1. Set up Electron project structure
2. Create main window with three panels
3. Implement bank browser tree view
4. Implement search functionality
5. Style with pink neon theme
6. Add track selection panel
7. Add template settings panel

### Phase 3: Template Builder Logic
**Goal:** Build selected tracks list and configuration

**Tasks:**
1. Add tracks from bank selection
2. Implement drag-and-drop reordering
3. Allow track removal
4. Support folder grouping (optional)
5. Track naming (auto-generate, allow edit)
6. Track color assignment

### Phase 4: RPP File Generator
**Goal:** Generate valid Reaper project files

**Tasks:**
1. Create `.RPP` file writer
2. Generate project header (tempo, sample rate, etc.)
3. Generate track entries with:
   - Unique GUIDs
   - Track names
   - Kontakt VST3 instances
   - Reaticulate JSFX instances
   - Bank assignments (MSB/LSB via extension data)
4. Handle folder structure
5. Test generated files in Reaper
6. Validate all tracks have correct bank assignments

### Phase 5: Polish and Testing
**Goal:** Production-ready application

**Tasks:**
1. File save dialog
2. Error handling (missing banks, invalid paths, etc.)
3. Loading indicators (parsing 15MB file)
4. Preferences (default save location, theme options)
5. About dialog
6. User documentation
7. Testing on macOS (primary platform)
8. Optional: Windows support

## Technical Requirements

### System Requirements
- **macOS:** 12+ (Monterey or later)
- **Windows:** 10/11 (optional, secondary)
- **Reaper:** 6.0+ (tested with 7.x)
- **Reaticulate:** 0.5.0+ installed

### File Paths (macOS)
- Reaticulate banks: `~/Library/Application Support/REAPER/Data/Reaticulate-ArtConductor.reabank`
- Generated templates: User-specified (suggest: `~/Documents/Reaper Templates/`)
- App preferences: `~/Library/Application Support/Cubby Template Builder/`

### File Paths (Windows)
- Reaticulate banks: `%APPDATA%\REAPER\Data\Reaticulate-ArtConductor.reabank`
- Generated templates: User-specified
- App preferences: `%APPDATA%\Cubby Template Builder\`

## Critical Implementation Notes

### 1. Reaticulate Bank Assignment
The most critical part is correctly writing bank assignments into the `.RPP` file. Reaticulate expects specific format in the project extension data.

**Research needed:**
- Examine existing Reaper projects with Reaticulate banks assigned
- Reverse-engineer the exact format Reaticulate uses
- Test generated files to ensure Reaticulate recognizes bank assignments

**Approach:**
1. Create a test project in Reaper manually
2. Assign a Reaticulate bank to a track
3. Save project
4. Open `.RPP` file in text editor
5. Find the extension data format
6. Replicate in generator

### 2. Kontakt VST State
Kontakt instances can be empty (no patches loaded). User will load patches manually after opening template.

**Minimal state:**
```
<VST "VST3: Kontakt 8 (Native Instruments)" kontakt.vst3 0 "" {GUID}
  // Minimal state - empty Kontakt instance
>
```

### 3. GUID Generation
Every track, VST instance, and JSFX needs unique GUIDs.

**Format:** `{12345678-1234-1234-1234-123456789ABC}`

**Implementation:**
```javascript
const crypto = require('crypto');

function generateGUID() {
  return '{' + crypto.randomUUID().toUpperCase() + '}';
}
```

### 4. Performance Considerations
With 15,360 banks:
- **Parsing:** Should complete in < 2 seconds
- **Search:** Instant filtering (< 100ms)
- **UI rendering:** Virtualized list for smooth scrolling
- **File generation:** < 1 second for typical 50-100 track template

**Optimization strategies:**
- Parse `.reabank` file once on startup, cache in memory
- Use virtual scrolling for bank list (only render visible items)
- Index banks by name for fast search
- Generate `.RPP` file in streaming fashion (write as you go)

## Testing Strategy

### Unit Tests
1. `.reabank` parser (can it handle all 15,360 banks?)
2. Search/filter logic (performance, accuracy)
3. `.RPP` generator (valid format, correct MSB/LSB)
4. GUID generation (uniqueness)

### Integration Tests
1. Generate template → open in Reaper → verify tracks exist
2. Assign bank → verify Reaticulate recognizes assignment
3. Load Kontakt → verify articulations switch correctly

### Manual Testing Checklist
- [ ] Parse 15.59MB `.reabank` file successfully
- [ ] Search returns accurate results instantly
- [ ] Add 100+ tracks to template
- [ ] Reorder tracks via drag-and-drop
- [ ] Generate `.RPP` file
- [ ] Open in Reaper - all tracks present
- [ ] Reaticulate shows correct banks assigned
- [ ] Click articulations - switching works

## Delivery and Distribution

### Packaging
- **macOS:** `.dmg` installer (code-signed if possible)
- **Windows:** `.exe` installer (optional)

### Branding
- App icon: Pink neon theme (consistent with Cubby Apps)
- Window title: "Cubby Template Builder for Reaper"
- About dialog: Credits, version, link to other Cubby apps

### Documentation
Create user guide covering:
1. Installation
2. Initial setup (locate Reaticulate banks)
3. Creating a template
4. Opening template in Reaper
5. Loading Kontakt patches
6. Using articulations
7. Troubleshooting

## Future Enhancements (Post-MVP)

### Phase 2 Features
1. **Template presets:** Save/load common configurations
2. **Batch generation:** Create multiple templates at once
3. **Smart grouping:** Auto-organize by instrument family
4. **Custom routing:** Configure sends/buses
5. **MIDI CC assignments:** Pre-configure expression, dynamics, etc.
6. **Track icons:** Visual identification in Reaper
7. **Import existing templates:** Parse `.RPP` and show current configuration

### Phase 3 Features
1. **Cloud sync:** Share templates across devices
2. **Community templates:** Download pre-made templates
3. **Kontakt patch loader:** Auto-load patches (requires Kontakt scripting)
4. **Expression map editor:** Create new banks in app
5. **Integration with other Cubby apps:** Cross-app communication

## Related Cubby Apps

This app is part of the Cubby Apps ecosystem:
- **Cubby Remote:** DAW articulation switching via MIDI/OSC
- **Cubby Composer:** Music composition assistant
- **Cubby Score:** Notation tools
- **Cubby Convert:** Format converters (like Art Conductor → Reaticulate)

**Design consistency:** Maintain pink neon theme and similar UI patterns.

## Resources and References

### Reaper Documentation
- Reaper project file format: https://github.com/ReaTeam/Doc/blob/master/REAPER-project-file-format.md
- Reaper JSFX documentation: https://www.reaper.fm/sdk/js/js.php

### Reaticulate Documentation
- Reaticulate home: https://reaticulate.com/
- Reabank format: https://reaticulate.com/reabank.html
- GitHub: https://github.com/jtackaberry/reaticulate

### Electron Resources
- Electron docs: https://www.electronjs.org/docs
- File system operations: Node.js `fs` module
- Native file dialogs: `dialog` module

## Example Workflow (User Perspective)

1. **Launch app:** "Cubby Template Builder for Reaper"
2. **See bank library:** 15,360 banks organized by developer/library
3. **Search:** Type "violin" → see all violin banks
4. **Add tracks:**
   - Double-click "Spitfire Chamber Strings - Violin 1 Long"
   - Double-click "Spitfire Chamber Strings - Violin 1 Short"
   - Double-click "Spitfire Chamber Strings - Violin 2 Ensemble"
5. **Configure:**
   - Reorder tracks
   - Group into "Strings" folder
   - Name template "My String Section"
6. **Generate:** Click "Generate Template"
7. **Save:** Choose location, save as `My String Section.RPP`
8. **Open in Reaper:** File appears with 3 tracks, each with Kontakt + Reaticulate
9. **Load patches:** Load corresponding Kontakt patches on each track
10. **Use:** Click articulations in Reaticulate, they switch correctly

**Result:** Complete orchestral template setup in minutes instead of hours!

## Success Criteria

The project is successful when:
1. ✅ App parses all 15,360 banks without errors
2. ✅ Search is fast and accurate
3. ✅ Generated `.RPP` files open correctly in Reaper
4. ✅ Reaticulate recognizes bank assignments
5. ✅ Articulation switching works as expected
6. ✅ UI is responsive and polished
7. ✅ User can create a 100-track template in < 5 minutes

## Open Questions

1. **Kontakt patch loading:** Can we auto-load patches, or is manual load required?
2. **Reaticulate extension format:** Need to reverse-engineer from sample projects
3. **Track colors:** Use instrument family convention or user preference?
4. **Folder structure:** Auto-organize or user-defined?
5. **Platform priority:** macOS only initially, or Windows support from start?

## Contact and Support

**Developer:** Willard (willardjansen)
**Related projects:** Cubby Apps suite (Cubby Remote, Cubby Composer, etc.)
**Target platform:** macOS (Apple Silicon M1/M2/M3)
**Development environment:** VS Code with Claude Code integration

---

## Getting Started (For Claude Code)

**Step 1:** Set up Electron project structure
**Step 2:** Implement `.reabank` parser (read 15.59MB file, parse 15,360 banks)
**Step 3:** Build bank browser UI with search
**Step 4:** Research Reaticulate bank assignment format (examine sample `.RPP` files)
**Step 5:** Implement `.RPP` file generator
**Step 6:** Test end-to-end workflow

**Priority:** Get the core workflow working (parse → select → generate → test in Reaper) before adding polish.

Good luck! 🚀
