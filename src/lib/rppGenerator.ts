/**
 * Reaper .RPP Project File Generator
 *
 * Generates text-based Reaper project files with:
 * - Tracks configured with Kontakt VST3
 * - Reaticulate JSFX instances
 * - Bank assignments via Reaticulate extension data format
 */

export interface BankInfo {
  msb: number;
  lsb: number;
  name: string;
  articulations: { number: number; name: string }[];
}

export interface TrackConfig {
  bank: BankInfo;
  name: string;
  color?: string;
}

export interface FolderConfig {
  name: string;
  color?: string;
  tracks: TrackConfig[];
}

export interface ProjectConfig {
  name: string;
  tempo: number;
  sampleRate: number;
  tracks: TrackConfig[];
  folders?: FolderConfig[];
}

// Track bank GUIDs for project-level EXTSTATE
interface BankGuidMapping {
  guid: string;
  msblsb: number; // MSB * 128 + LSB
}

/**
 * Generate a unique GUID in Reaper format: {12345678-1234-1234-1234-123456789ABC}
 */
function generateGUID(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16).toUpperCase();
  const segment = (len: number) => Array(len).fill(0).map(hex).join('');

  return `{${segment(8)}-${segment(4)}-${segment(4)}-${segment(4)}-${segment(12)}}`;
}

/**
 * Generate a lowercase UUID for Reaticulate (without braces)
 */
function generateReaticulateGUID(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16).toLowerCase();
  const segment = (len: number) => Array(len).fill(0).map(hex).join('');

  return `${segment(8)}-${segment(4)}-${segment(4)}-${segment(4)}-${segment(12)}`;
}

/**
 * Generate a simple hash for bank identification (similar to Reaticulate's internal hash)
 * This is a simplified version - Reaticulate uses a more complex hash
 */
function generateBankHash(bankName: string): number {
  let hash = 0;
  for (let i = 0; i < bankName.length; i++) {
    const char = bankName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Make it a large negative number like Reaticulate uses
  return hash < 0 ? hash : -Math.abs(hash) - 1000000000;
}

/**
 * Convert hex color to Reaper color format (native color integer)
 * Reaper uses BGR format in a 32-bit integer
 */
function hexToReaperColor(hex: string): number {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return 0x01000000 | (b << 16) | (g << 8) | r;
}

/**
 * Instrument family to color mapping
 */
const FAMILY_COLORS: Record<string, string> = {
  violin: '#8B4513',
  viola: '#A0522D',
  cello: '#CD853F',
  bass: '#DEB887',
  flute: '#87CEEB',
  oboe: '#B0C4DE',
  clarinet: '#6495ED',
  bassoon: '#4682B4',
  horn: '#DAA520',
  trumpet: '#FFD700',
  trombone: '#FFA500',
  tuba: '#FF8C00',
  timpani: '#808080',
  percussion: '#696969',
  harp: '#DDA0DD',
  piano: '#2F4F4F',
  strings: '#8B4513',
  brass: '#DAA520',
  woodwinds: '#87CEEB',
};

/**
 * Get track color based on bank name
 */
function getTrackColor(bankName: string): number {
  const lowerName = bankName.toLowerCase();

  for (const [family, color] of Object.entries(FAMILY_COLORS)) {
    if (lowerName.includes(family)) {
      return hexToReaperColor(color);
    }
  }

  // Default pink (Cubby theme)
  return hexToReaperColor('#ff69b4');
}

/**
 * Escape content for RPP format
 */
function escapeRPP(str: string): string {
  return str.replace(/"/g, '\\"');
}

/**
 * Generate a complete .RPP project file
 */
export function generateRPP(config: ProjectConfig): string {
  const lines: string[] = [];
  const indent = (level: number) => '  '.repeat(level);

  // Track all bank GUID mappings for EXTSTATE
  const bankGuidMappings: BankGuidMapping[] = [];

  // Project header
  lines.push('<REAPER_PROJECT 0.1 "7.0" 1234567890');
  lines.push(`${indent(1)}RIPPLE 0`);
  lines.push(`${indent(1)}GROUPOVERRIDE 0 0 0`);
  lines.push(`${indent(1)}AUTOXFADE 129`);
  lines.push(`${indent(1)}ENVATTACH 3`);
  lines.push(`${indent(1)}MIXERUIFLAGS 11 48`);
  lines.push(`${indent(1)}PEAKGAIN 1`);
  lines.push(`${indent(1)}FEEDBACK 0`);
  lines.push(`${indent(1)}PANLAW 1`);
  lines.push(`${indent(1)}PROJOFFS 0 0 0`);
  lines.push(`${indent(1)}MAXPROJLEN 0 600`);
  lines.push(`${indent(1)}GRID 3199 8 1 8 1 0 0 0`);
  lines.push(`${indent(1)}TIMEMODE 1 5 -1 30 0 0 -1`);
  lines.push(`${indent(1)}PANMODE 3`);
  lines.push(`${indent(1)}CURSOR 0`);
  lines.push(`${indent(1)}ZOOM 100 0 0`);
  lines.push(`${indent(1)}VZOOMEX 6 0`);
  lines.push(`${indent(1)}USE_REC_CFG 0`);
  lines.push(`${indent(1)}RECMODE 1`);
  lines.push(`${indent(1)}LOOP 0`);
  lines.push(`${indent(1)}LOOPGRAN 0 4`);
  lines.push(`${indent(1)}RECORD_PATH "" ""`);
  lines.push(`${indent(1)}RENDER_FILE ""`);
  lines.push(`${indent(1)}RENDER_FMT 0 2 0`);
  lines.push(`${indent(1)}TEMPO ${config.tempo} 4 4`);
  lines.push(`${indent(1)}PLAYRATE 1 0 0.25 4`);
  lines.push(`${indent(1)}MASTERAUTOMODE 0`);
  lines.push(`${indent(1)}MASTERTRACKHEIGHT 0 0`);
  lines.push(`${indent(1)}MASTERMUTESOLO 0`);
  lines.push(`${indent(1)}MASTERTRACKVIEW 0 0.6667 0.5 0.5 -1 -1 -1 0 0 0 -1 -1 0`);
  lines.push(`${indent(1)}MASTERHWOUT 0 0 1 0 0 0 0 -1`);
  lines.push(`${indent(1)}MASTER_NCH 2 2`);
  lines.push(`${indent(1)}MASTER_VOLUME 1 0 -1 -1 1`);
  lines.push(`${indent(1)}MASTER_PANMODE 3`);
  lines.push(`${indent(1)}MASTER_FX 1`);
  lines.push(`${indent(1)}MASTER_SEL 0`);
  lines.push(`${indent(1)}SAMPLERATE ${config.sampleRate} 0 0`);

  // Master FX chain (empty)
  lines.push(`${indent(1)}<MASTERFXLIST`);
  lines.push(`${indent(1)}>`);

  // Generate tracks
  let trackIndex = 0;

  // Handle folders if present
  if (config.folders && config.folders.length > 0) {
    for (const folder of config.folders) {
      // Folder track
      const folderGuid = generateGUID();
      const folderColor = folder.color ? hexToReaperColor(folder.color) : getTrackColor(folder.name);

      lines.push(`${indent(1)}<TRACK ${folderGuid}`);
      lines.push(`${indent(2)}NAME "${escapeRPP(folder.name)}"`);
      lines.push(`${indent(2)}PEAKCOL ${folderColor}`);
      lines.push(`${indent(2)}BEAT -1`);
      lines.push(`${indent(2)}AUTOMODE 0`);
      lines.push(`${indent(2)}VOLPAN 1 0 -1 -1 1`);
      lines.push(`${indent(2)}MUTESOLO 0 0 0`);
      lines.push(`${indent(2)}IPHASE 0`);
      lines.push(`${indent(2)}PLAYOFFS 0 1`);
      lines.push(`${indent(2)}ISBUS 1 1`);
      lines.push(`${indent(2)}BUSCOMP 0 0 0 0 0`);
      lines.push(`${indent(2)}SHOWINMIX 1 0.6667 0.5 1 0.5 -1 -1 -1`);
      lines.push(`${indent(2)}SEL 0`);
      lines.push(`${indent(2)}REC 0 0 1 0 0 0 0 0`);
      lines.push(`${indent(2)}VU 2`);
      lines.push(`${indent(2)}TRACKHEIGHT 0 0 0 0 0 0`);
      lines.push(`${indent(2)}INQ 0 0 0 0.5 100 0 0 100`);
      lines.push(`${indent(2)}NCHAN 2`);
      lines.push(`${indent(2)}FX 1`);
      lines.push(`${indent(2)}TRACKID ${folderGuid}`);
      lines.push(`${indent(2)}PERF 0`);
      lines.push(`${indent(2)}MIDIOUT -1`);
      lines.push(`${indent(2)}MAINSEND 1 0`);
      lines.push(`${indent(1)}>`);
      trackIndex++;

      // Tracks in folder
      for (let i = 0; i < folder.tracks.length; i++) {
        const track = folder.tracks[i];
        const isLast = i === folder.tracks.length - 1;
        const { lines: trackLines, bankMapping } = generateTrackBlock(track, trackIndex, isLast ? 2 : 0);
        lines.push(...trackLines);
        if (bankMapping) {
          bankGuidMappings.push(bankMapping);
        }
        trackIndex++;
      }
    }
  }

  // Generate standalone tracks
  for (const track of config.tracks) {
    const { lines: trackLines, bankMapping } = generateTrackBlock(track, trackIndex, 0);
    lines.push(...trackLines);
    if (bankMapping) {
      bankGuidMappings.push(bankMapping);
    }
    trackIndex++;
  }

  // Add EXTENSIONS block (empty but required)
  lines.push(`${indent(1)}<EXTENSIONS`);
  lines.push(`${indent(1)}>`);

  // Add EXTSTATE with Reaticulate bank mappings
  if (bankGuidMappings.length > 0) {
    const msblsbByGuid: Record<string, number> = {};
    for (const mapping of bankGuidMappings) {
      msblsbByGuid[mapping.guid] = mapping.msblsb;
    }

    const changeCookie = generateReaticulateGUID();
    const stateJson = JSON.stringify({ msblsb_by_guid: msblsbByGuid, gc_ok: true });

    lines.push(`${indent(1)}<EXTSTATE`);
    lines.push(`${indent(2)}<REATICULATE`);
    lines.push(`${indent(3)}CHANGE_COOKIE ${changeCookie}`);
    lines.push(`${indent(3)}STATE ${stateJson}`);
    lines.push(`${indent(2)}>`);
    lines.push(`${indent(1)}>`);
  }

  // Close project
  lines.push('>');

  return lines.join('\n');
}

/**
 * Generate a single track block
 * Returns the track lines and the bank GUID mapping for EXTSTATE
 */
function generateTrackBlock(
  track: TrackConfig,
  index: number,
  folderDepth: number
): { lines: string[]; bankMapping: BankGuidMapping | null } {
  const lines: string[] = [];
  const indent = (level: number) => '  '.repeat(level);

  const trackGuid = generateGUID();
  const kontaktGuid = generateGUID();
  const reaticGuid = generateGUID();

  // Generate a unique GUID for this bank assignment
  const bankGuid = generateReaticulateGUID();
  const bankHash = generateBankHash(track.bank.name);
  const msblsb = track.bank.msb * 128 + track.bank.lsb;

  const trackColor = track.color ? hexToReaperColor(track.color) : getTrackColor(track.bank.name);

  lines.push(`${indent(1)}<TRACK ${trackGuid}`);
  lines.push(`${indent(2)}NAME "${escapeRPP(track.name)}"`);
  lines.push(`${indent(2)}PEAKCOL ${trackColor}`);
  lines.push(`${indent(2)}BEAT -1`);
  lines.push(`${indent(2)}AUTOMODE 0`);
  lines.push(`${indent(2)}VOLPAN 1 0 -1 -1 1`);
  lines.push(`${indent(2)}MUTESOLO 0 0 0`);
  lines.push(`${indent(2)}IPHASE 0`);
  lines.push(`${indent(2)}PLAYOFFS 0 1`);

  if (folderDepth > 0) {
    lines.push(`${indent(2)}ISBUS ${folderDepth} -1`);
  } else {
    lines.push(`${indent(2)}ISBUS 0 0`);
  }

  lines.push(`${indent(2)}BUSCOMP 0 0 0 0 0`);
  lines.push(`${indent(2)}SHOWINMIX 1 0.6667 0.5 1 0.5 -1 -1 -1`);
  lines.push(`${indent(2)}SEL 0`);
  lines.push(`${indent(2)}REC 0 0 1 0 0 0 0 0`);
  lines.push(`${indent(2)}VU 2`);
  lines.push(`${indent(2)}TRACKHEIGHT 0 0 0 0 0 0`);
  lines.push(`${indent(2)}INQ 0 0 0 0.5 100 0 0 100`);
  lines.push(`${indent(2)}NCHAN 2`);
  lines.push(`${indent(2)}FX 1`);
  lines.push(`${indent(2)}TRACKID ${trackGuid}`);
  lines.push(`${indent(2)}PERF 0`);

  // Reaticulate bank assignment via EXT block (track-level extension data)
  // Format: '2{"banks":[{...}],"y":0,"v":1,"defchan":1}'
  const reaticulateConfig = {
    banks: [{
      t: "g",                    // type: group
      v: bankGuid,              // bank GUID reference
      dstbus: 1,                // destination bus
      h: bankHash,              // bank hash
      name: track.bank.name,    // bank name
      src: 17,                  // source channel (17 = channel 1 in Reaticulate)
      dst: 17                   // destination channel
    }],
    y: 0,
    v: 1,
    defchan: 1
  };
  const reaticulateJson = JSON.stringify(reaticulateConfig);

  lines.push(`${indent(2)}<EXT`);
  lines.push(`${indent(3)}reaticulate '2${reaticulateJson}'`);
  lines.push(`${indent(2)}>`);

  lines.push(`${indent(2)}MIDIOUT -1`);
  lines.push(`${indent(2)}MAINSEND 1 0`);

  // FX Chain
  lines.push(`${indent(2)}<FXCHAIN`);
  lines.push(`${indent(3)}WNDRECT 0 0 0 0`);
  lines.push(`${indent(3)}SHOW 0`);
  lines.push(`${indent(3)}LASTSEL 0`);
  lines.push(`${indent(3)}DOCKED 0`);
  lines.push(`${indent(3)}BYPASS 0 0 0`);

  // Reaticulate JSFX (correct path from actual Reaper project)
  lines.push(`${indent(3)}<JS jsfx/Reaticulate.jsfx ""`);
  // Minimal JSFX state - Reaticulate will initialize itself
  lines.push(`${indent(4)}0 0 0 -1 0 0 0 0 1 8421504 8421504 8421504 8421504 8421504 8421504 8421504 8421504 8421504 8421504 8421504 8421504 8421504 8421504 8421504 8421504 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 12 0 0`);
  lines.push(`${indent(3)}>`);
  lines.push(`${indent(3)}FLOATPOS 0 0 0 0`);
  lines.push(`${indent(3)}FXID ${reaticGuid}`);
  lines.push(`${indent(3)}WAK 0 0`);
  lines.push(`${indent(3)}BYPASS 0 0 0`);

  // Kontakt VST3 (empty instance)
  lines.push(`${indent(3)}<VST "VST3: Kontakt (Native Instruments GmbH)" "Kontakt.vst3" 0 "" ${kontaktGuid} ""`);
  lines.push(`${indent(4)}47k9Krn+5e4CAAAAAQAAAAAAAAACAAAAAAAAAAIAAAABAAAAAAAAAAIAAAAAAAAATAAAAAEAAAAAABAA`);
  lines.push(`${indent(3)}>`);
  lines.push(`${indent(3)}FLOATPOS 0 0 0 0`);
  lines.push(`${indent(3)}FXID ${kontaktGuid}`);
  lines.push(`${indent(3)}WAK 0 0`);
  lines.push(`${indent(3)}BYPASS 0 0 0`);

  lines.push(`${indent(2)}>`);

  lines.push(`${indent(1)}>`);

  return {
    lines,
    bankMapping: {
      guid: bankGuid,
      msblsb
    }
  };
}
