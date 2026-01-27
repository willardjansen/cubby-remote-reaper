import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface Articulation {
  number: number;
  name: string;
  color: string;
}

interface Bank {
  msb: number;
  lsb: number;
  name: string;
  articulations: Articulation[];
}

// Parse a .reabank file content
function parseReabankContent(content: string): Bank[] {
  const banks: Bank[] = [];
  let currentBank: Bank | null = null;
  let currentMeta: { color?: string } = {};
  let bankCounter = 0;

  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines
    if (!line) continue;

    // Bank definition: Bank MSB LSB Name
    if (line.startsWith('Bank ')) {
      const match = line.match(/^Bank\s+(\S+)\s+(\S+)\s+(.+)$/);
      if (match) {
        const [, msbStr, lsbStr, name] = match;

        // Handle * wildcards
        let msb: number, lsb: number;
        if (msbStr === '*' || lsbStr === '*') {
          bankCounter++;
          msb = bankCounter;
          lsb = 0;
        } else {
          msb = parseInt(msbStr, 10);
          lsb = parseInt(lsbStr, 10);
        }

        currentBank = {
          msb,
          lsb,
          name: name.trim(),
          articulations: [],
        };
        banks.push(currentBank);
        currentMeta = {};
      }
    }
    // Metadata: //! c=color i=icon o=output
    else if (line.startsWith('//!')) {
      const colorMatch = line.match(/c=([^\s]+)/);
      if (colorMatch) {
        currentMeta.color = colorMatch[1];
      }
    }
    // Articulation: number name
    else if (/^\d+\s+.+$/.test(line) && currentBank) {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (match) {
        const [, numStr, artName] = match;
        currentBank.articulations.push({
          number: parseInt(numStr, 10),
          name: artName.trim(),
          color: currentMeta.color || 'default',
        });
        currentMeta = {};
      }
    }
  }

  return banks;
}

export async function GET() {
  try {
    // Path to reabank folder in project root
    const reabankDir = path.join(process.cwd(), 'reabank');

    // Check if directory exists
    try {
      await fs.access(reabankDir);
    } catch {
      return NextResponse.json({ banks: [], error: 'reabank folder not found' });
    }

    // Read all .reabank files
    const files = await fs.readdir(reabankDir);
    const reabankFiles = files.filter(f => f.endsWith('.reabank'));

    if (reabankFiles.length === 0) {
      return NextResponse.json({ banks: [], error: 'No .reabank files found' });
    }

    // Parse all files
    const allBanks: Bank[] = [];

    for (const file of reabankFiles) {
      const filePath = path.join(reabankDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const banks = parseReabankContent(content);
      allBanks.push(...banks);
    }

    console.log(`[API] Loaded ${allBanks.length} banks from ${reabankFiles.length} files`);

    return NextResponse.json({
      banks: allBanks,
      files: reabankFiles,
      count: allBanks.length,
    });
  } catch (error) {
    console.error('[API] Error loading reabanks:', error);
    return NextResponse.json({ banks: [], error: String(error) }, { status: 500 });
  }
}
