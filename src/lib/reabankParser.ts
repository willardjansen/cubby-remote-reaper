/**
 * Reaticulate .reabank file parser
 *
 * Parses Reaticulate bank files to extract articulation definitions.
 * Format: Text file with Bank definitions and articulation entries.
 */

import { MidiMessage } from './midiHandler';

export interface RemoteTrigger {
  status: number;
  data1: number;
  isAutoAssigned?: boolean;
}

export interface Articulation {
  id: string;
  number: number;
  name: string;
  shortName: string;
  description: string;
  color: number;
  group: number;
  icon?: string;
  output?: string;
  articulationType: number; // 0 = attribute, 1 = direction
  remoteTrigger?: RemoteTrigger;
  midiMessages: MidiMessage[];
  keySwitch?: number;
}

export interface ArticulationSet {
  name: string;
  fileName: string;
  msb: number;
  lsb: number;
  articulations: Articulation[];
}

export interface ParsedReabank {
  banks: ArticulationSet[];
  parseTime: number;
  errors: string[];
}

// Reaticulate color names to color indices
const COLOR_MAP: Record<string, number> = {
  'default': 0,
  'long': 1,
  'long-light': 2,
  'long-dark': 3,
  'short': 4,
  'short-light': 5,
  'short-dark': 6,
  'textured': 7,
  'fx': 8,
  'legato': 9,
  'staccato': 10,
  'tremolo': 11,
  'trill': 12,
  'pizz': 13,
  'harmonics': 14,
  'percussion': 15,
};

// Color indices to hex values (Reaticulate-style colors)
export const REATICULATE_COLORS: Record<number, string> = {
  0: '#808080',  // default - gray
  1: '#4CAF50',  // long - green
  2: '#81C784',  // long-light
  3: '#2E7D32',  // long-dark
  4: '#FF9800',  // short - orange
  5: '#FFB74D',  // short-light
  6: '#EF6C00',  // short-dark
  7: '#9C27B0',  // textured - purple
  8: '#607D8B',  // fx - blue-gray
  9: '#2196F3',  // legato - blue
  10: '#f44336', // staccato - red
  11: '#E91E63', // tremolo - pink
  12: '#00BCD4', // trill - cyan
  13: '#795548', // pizz - brown
  14: '#03A9F4', // harmonics - light blue
  15: '#9E9E9E', // percussion - gray
};

/**
 * Parse a .reabank file content into structured data
 */
export function parseReabankFile(content: string): ParsedReabank {
  const startTime = performance.now();
  const banks: ArticulationSet[] = [];
  const errors: string[] = [];

  const lines = content.split('\n');
  let currentBank: ArticulationSet | null = null;
  let currentArticulationMeta: {
    color?: string;
    icon?: string;
    output?: string;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Skip pure comment lines (not articulation metadata)
    if (line.startsWith('//') && !line.startsWith('//!')) {
      continue;
    }

    // Bank definition: Bank [MSB] [LSB] [Name]
    if (line.startsWith('Bank ')) {
      // Save previous bank if exists
      if (currentBank) {
        banks.push(currentBank);
      }

      const match = line.match(/^Bank\s+(\d+)\s+(\d+)\s+(.+)$/);
      if (match) {
        const msb = parseInt(match[1], 10);
        const lsb = parseInt(match[2], 10);
        const name = match[3].trim();

        currentBank = {
          name,
          fileName: `${msb}-${lsb}-${name}`,
          msb,
          lsb,
          articulations: [],
        };
        currentArticulationMeta = null;
      } else {
        errors.push(`Line ${i + 1}: Invalid bank format: ${line}`);
      }
      continue;
    }

    // Articulation metadata: //! c=color i=icon o=output
    if (line.startsWith('//!')) {
      currentArticulationMeta = {};

      // Parse color
      const colorMatch = line.match(/c=([^\s]+)/);
      if (colorMatch) {
        currentArticulationMeta.color = colorMatch[1];
      }

      // Parse icon
      const iconMatch = line.match(/i=([^\s]+)/);
      if (iconMatch) {
        currentArticulationMeta.icon = iconMatch[1];
      }

      // Parse output
      const outputMatch = line.match(/o=([^\s]+)/);
      if (outputMatch) {
        currentArticulationMeta.output = outputMatch[1];
      }

      continue;
    }

    // Articulation entry: [number] [name]
    const artMatch = line.match(/^(\d+)\s+(.+)$/);
    if (artMatch && currentBank) {
      const artNumber = parseInt(artMatch[1], 10);
      const artName = artMatch[2].trim();

      // Parse output to get MIDI messages and key switch
      let midiMessages: MidiMessage[] = [];
      let keySwitch: number | undefined;

      if (currentArticulationMeta?.output) {
        const output = currentArticulationMeta.output;
        // Parse output like "note:24" or "cc:32,64"
        if (output.startsWith('note:')) {
          const noteNum = parseInt(output.substring(5), 10);
          keySwitch = noteNum;
          midiMessages.push({ status: 0x90, data1: noteNum, data2: 127 });
        } else if (output.startsWith('cc:')) {
          const parts = output.substring(3).split(',');
          if (parts.length >= 2) {
            midiMessages.push({
              status: 0xB0,
              data1: parseInt(parts[0], 10),
              data2: parseInt(parts[1], 10),
            });
          }
        }
      }

      // Get color index
      const colorName = currentArticulationMeta?.color || 'default';
      const colorIndex = COLOR_MAP[colorName] ?? 0;

      const articulation: Articulation = {
        id: `${currentBank.msb}-${currentBank.lsb}-${artNumber}`,
        number: artNumber,
        name: artName,
        shortName: artName.length > 8 ? artName.substring(0, 8) : artName,
        description: `${artName} (PC ${artNumber})`,
        color: colorIndex,
        group: 0,
        icon: currentArticulationMeta?.icon,
        output: currentArticulationMeta?.output,
        articulationType: 0, // Default to attribute
        midiMessages,
        keySwitch,
        // Remote trigger will be auto-assigned if not present
      };

      currentBank.articulations.push(articulation);
      currentArticulationMeta = null;
      continue;
    }
  }

  // Don't forget the last bank
  if (currentBank) {
    banks.push(currentBank);
  }

  const parseTime = performance.now() - startTime;

  return {
    banks,
    parseTime,
    errors,
  };
}

/**
 * Check if any articulations are missing remote triggers
 */
export function hasUnassignedRemotes(artSet: ArticulationSet): boolean {
  return artSet.articulations.some(a => !a.remoteTrigger);
}

/**
 * Auto-assign remote triggers to articulations that don't have them
 */
export function autoAssignRemoteTriggers(artSet: ArticulationSet): ArticulationSet {
  const usedNotes = new Set<number>();

  // First pass: collect already-used notes
  artSet.articulations.forEach(art => {
    if (art.remoteTrigger && !art.remoteTrigger.isAutoAssigned) {
      usedNotes.add(art.remoteTrigger.data1);
    }
    if (art.keySwitch !== undefined) {
      usedNotes.add(art.keySwitch);
    }
  });

  // Second pass: assign notes to unassigned articulations
  let nextNote = 0;
  const newArticulations = artSet.articulations.map(art => {
    if (art.remoteTrigger) return art;

    // Find next available note
    while (usedNotes.has(nextNote) && nextNote < 127) {
      nextNote++;
    }

    if (nextNote >= 127) {
      return art; // No more notes available
    }

    usedNotes.add(nextNote);

    return {
      ...art,
      remoteTrigger: {
        status: 0x90, // Note On
        data1: nextNote++,
        isAutoAssigned: true,
      },
    };
  });

  return {
    ...artSet,
    articulations: newArticulations,
  };
}

/**
 * Count auto-assigned remote triggers
 */
export function countAutoAssignedRemotes(artSet: ArticulationSet): number {
  return artSet.articulations.filter(a => a.remoteTrigger?.isAutoAssigned).length;
}

/**
 * Group articulations by group number
 */
export function groupArticulations(articulations: Articulation[]): Map<number, Articulation[]> {
  const groups = new Map<number, Articulation[]>();

  articulations.forEach(art => {
    const group = art.group || 0;
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(art);
  });

  return groups;
}

/**
 * Convert MIDI note number to note name
 */
export function midiNoteToName(note: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  const noteName = noteNames[note % 12];
  return `${noteName}${octave}`;
}

/**
 * Search banks by name
 */
export function searchBanks(banks: ArticulationSet[], query: string): ArticulationSet[] {
  if (!query.trim()) return banks;

  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery.split(/\s+/).filter(Boolean);

  return banks.filter(bank => {
    const searchText = bank.name.toLowerCase();
    return terms.every(term => searchText.includes(term));
  });
}

/**
 * Create a simple articulation set for demo/testing
 */
export function createDemoArticulationSet(): ArticulationSet {
  const arts: Articulation[] = [
    { id: '1', number: 1, name: 'Sustain', shortName: 'Sustain', description: 'Long sustained note', color: 1, group: 0, articulationType: 0, midiMessages: [], remoteTrigger: { status: 0x90, data1: 0 } },
    { id: '2', number: 2, name: 'Staccato', shortName: 'Staccato', description: 'Short staccato', color: 4, group: 0, articulationType: 0, midiMessages: [], remoteTrigger: { status: 0x90, data1: 1 } },
    { id: '3', number: 3, name: 'Spiccato', shortName: 'Spiccato', description: 'Bouncing bow', color: 4, group: 0, articulationType: 0, midiMessages: [], remoteTrigger: { status: 0x90, data1: 2 } },
    { id: '4', number: 4, name: 'Pizzicato', shortName: 'Pizz', description: 'Plucked strings', color: 13, group: 0, articulationType: 0, midiMessages: [], remoteTrigger: { status: 0x90, data1: 3 } },
    { id: '5', number: 5, name: 'Tremolo', shortName: 'Tremolo', description: 'Fast repeated notes', color: 11, group: 0, articulationType: 0, midiMessages: [], remoteTrigger: { status: 0x90, data1: 4 } },
    { id: '6', number: 6, name: 'Trills', shortName: 'Trills', description: 'Alternating notes', color: 12, group: 0, articulationType: 0, midiMessages: [], remoteTrigger: { status: 0x90, data1: 5 } },
    { id: '7', number: 7, name: 'Harmonics', shortName: 'Harm', description: 'Harmonic overtones', color: 14, group: 0, articulationType: 0, midiMessages: [], remoteTrigger: { status: 0x90, data1: 6 } },
    { id: '8', number: 8, name: 'Legato', shortName: 'Legato', description: 'Smooth connected', color: 9, group: 0, articulationType: 0, midiMessages: [], remoteTrigger: { status: 0x90, data1: 7 } },
  ];

  return {
    name: 'Demo Strings',
    fileName: 'demo-strings',
    msb: 0,
    lsb: 0,
    articulations: arts,
  };
}
