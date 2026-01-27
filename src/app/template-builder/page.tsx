'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  parseReabankFile,
  ArticulationSet,
} from '@/lib/reabankParser';
import { generateRPP, TrackConfig } from '@/lib/rppGenerator';

interface FolderNode {
  name: string;
  path: string;
  banks: ArticulationSet[];
  subfolders: Record<string, FolderNode>;
}

export default function TemplateBuilder() {
  const [allBanks, setAllBanks] = useState<ArticulationSet[]>([]);
  const [folderTree, setFolderTree] = useState<FolderNode | null>(null);
  const [selectedBanks, setSelectedBanks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([''])); // Root expanded

  // Load banks from API (reads from reabank folder)
  useEffect(() => {
    fetch('/api/reabanks/')
      .then(res => res.json())
      .then(data => {
        if (data.banks && data.banks.length > 0) {
          // Convert API banks to ArticulationSet format
          const banks: ArticulationSet[] = data.banks.map((bank: {
            msb: number;
            lsb: number;
            name: string;
            articulations: { number: number; name: string; color: string }[];
          }) => ({
            name: bank.name,
            fileName: `${bank.msb}-${bank.lsb}`,
            msb: bank.msb,
            lsb: bank.lsb,
            articulations: bank.articulations.map((art) => ({
              id: `${bank.msb}-${bank.lsb}-${art.number}`,
              number: art.number,
              name: art.name,
              shortName: art.name.substring(0, 8),
              description: art.name,
              color: 0,
              group: 0,
              articulationType: 0,
              midiMessages: [],
            })),
          }));
          setAllBanks(banks);
          buildFolderTree(banks);
          console.log(`Loaded ${banks.length} banks from API`);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load from API:', err);
        setLoading(false);
      });
  }, []);

  // Handle file upload (fallback)
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const content = await file.text();
      const parsed = parseReabankFile(content);
      setAllBanks(parsed.banks);
      buildFolderTree(parsed.banks);
    } catch (err) {
      console.error('Failed to parse file:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Build folder tree from bank names
  const buildFolderTree = (banks: ArticulationSet[]) => {
    const root: FolderNode = {
      name: 'Root',
      path: '',
      banks: [],
      subfolders: {},
    };

    banks.forEach(bank => {
      const parts = parseBankNameToPath(bank.name);
      let current = root;

      parts.slice(0, -1).forEach((part) => {
        if (!current.subfolders[part]) {
          current.subfolders[part] = {
            name: part,
            path: current.path ? `${current.path}/${part}` : part,
            banks: [],
            subfolders: {},
          };
        }
        current = current.subfolders[part];
      });

      current.banks.push(bank);
    });

    setFolderTree(root);

    // Expand top-level folders by default
    const topLevel = Object.values(root.subfolders).map(f => f.path);
    setExpandedFolders(new Set(['', ...topLevel]));
  };

  // Parse bank name into folder hierarchy
  const parseBankNameToPath = (name: string): string[] => {
    // Prefix patterns - order matters (longer/more specific first)
    const prefixPatterns: [RegExp, string][] = [
      // 8Dio specific libraries
      [/^8DAGE1\s+/, '8Dio Acoustic Grand Ensembles'],
      [/^8DAGE2\s+/, '8Dio Acoustic Grand Ensembles 2'],
      [/^8DADS\s+/, '8Dio Adagio Deep Strings'],
      [/^8DAD2\s+/, '8Dio Adagio Deep Strings 2'],
      [/^8DA2N?\s+/, '8Dio Adagio'],
      [/^8DAB\s+/, '8Dio Adagio Basses'],
      [/^8DAGA\s+/, '8Dio Agitato'],
      [/^8DAGC\s+/, '8Dio Agitato Cellos'],
      [/^8DAGI\s+/, '8Dio Agitato'],
      [/^8DALA\s+/, '8Dio Lacrimosa'],
      [/^8DANT\s+/, '8Dio Anthology'],
      [/^8DAS\s+/, '8Dio Adagio Strings'],
      [/^8DC[A-Z0-9]*\s+/, '8Dio Century'],
      [/^8DDQS\s+/, '8Dio Deep Quartet Strings'],
      [/^8DEP\s+/, '8Dio Epic'],
      [/^8DFIS\s+/, '8Dio Fiore Intimate Strings'],
      [/^8DFIT\s+/, '8Dio Fiore Intimate Tutti'],
      [/^8DFT\s+/, '8Dio Fire Toolkit'],
      [/^8DFVC\s+/, '8Dio Vocals'],
      [/^8DF[A-Z0-9]*\s+/, '8Dio'],
      [/^8DINS\s+/, '8Dio Insolidus'],
      [/^8DI[A-Z0-9]*\s+/, '8Dio Intimate'],
      [/^8DLAC\s+/, '8Dio Lacrimosa'],
      [/^8DLI\s+/, '8Dio Liberis'],
      [/^8DL[A-Z0-9]*\s+/, '8Dio Liberis'],
      [/^8DMAJ\s+/, '8Dio Majestica'],
      [/^8DMJ[A-Z0-9]*\s+/, '8Dio Majestica'],
      [/^8DM[A-Z0-9]*\s+/, '8Dio'],
      [/^8DOBS\s+/, '8Dio Ostinato Brass'],
      [/^8DOWS\s+/, '8Dio Ostinato Woodwinds'],
      [/^8DO[A-Z0-9]*\s+/, '8Dio'],
      [/^8DQ[A-Z0-9]*\s+/, '8Dio'],
      [/^8DREP\s+/, '8Dio Repertoire'],
      [/^8DRQN\s+/, '8Dio Requiem'],
      [/^8DR[A-Z0-9]*\s+/, '8Dio Requiem'],
      [/^8DSIC\s+/, '8Dio Silka'],
      [/^8DSYS\s+/, '8Dio Symphony'],
      [/^8DSS[A-Z0-9]*\s+/, '8Dio Studio Sopranos'],
      [/^8DS[A-Z0-9]*\s+/, '8Dio Studio'],
      [/^8D[A-Z0-9]+\s+/, '8Dio'],
      [/^8S[A-Z0-9]*\s+/, '8Dio'],

      // Spitfire
      [/^SFBB[A-Z0-9]*\s+/, 'Spitfire British Brass'],
      [/^SFA[0-9]+\s+/, 'Spitfire Albion'],
      [/^SFAL[A-Z0-9]*\s+/, 'Spitfire Albion'],
      [/^SFSS[A-Z0-9]*\s+/, 'Spitfire Studio Strings'],
      [/^SFSW[A-Z0-9]*\s+/, 'Spitfire Studio Woodwinds'],
      [/^SFSB[A-Z0-9]*\s+/, 'Spitfire Studio Brass'],
      [/^SFCS[A-Z0-9]*\s+/, 'Spitfire Chamber Strings'],
      [/^SFSO[A-Z0-9]*\s+/, 'Spitfire Symphony Orchestra'],
      [/^SFOP[A-Z0-9]*\s+/, 'Spitfire Originals'],
      [/^SF[A-Z0-9]+\s+/, 'Spitfire Audio'],

      // BBC Symphony Orchestra
      [/^BBCSO\s+/, 'BBC Symphony Orchestra'],

      // Cinematic Studio Series
      [/^CSSS[0-9]*\s+/, 'Cinematic Studio Strings'],
      [/^CSST[0-9]*\s+/, 'Cinematic Studio Strings'],
      [/^CSSW[0-9]*\s+/, 'Cinematic Studio Woodwinds'],
      [/^CSSB[A-Z0-9]*\s+/, 'Cinematic Studio Brass'],
      [/^CSSO[A-Z0-9]*\s+/, 'Cinematic Solo Strings'],
      [/^CSCP[A-Z0-9]*\s+/, 'Cinematic Studio Piano'],
      [/^CSM[A-Z0-9]+\s+/, 'Cinesamples'],
      [/^CSS[A-Z0-9]*\s+/, 'Cinematic Studio Series'],

      // Cinesamples
      [/^CI[A-Z0-9]+\s+/, 'Cinesamples'],

      // EastWest
      [/^EWHF[A-Z0-9]+\s+/, 'EW Hollywood Fantasy Orchestra'],
      [/^EWHO[A-Z0-9]*\s+/, 'EW Hollywood Orchestra'],
      [/^EWHB[A-Z0-9]*\s+/, 'EW Hollywood Brass'],
      [/^EWHS[A-Z0-9]*\s+/, 'EW Hollywood Strings'],
      [/^EWHW[A-Z0-9]*\s+/, 'EW Hollywood Woodwinds'],
      [/^EWHH[A-Z0-9]*\s+/, 'EW Hollywood Harp'],
      [/^EWHC[A-Z0-9]*\s+/, 'EW Hollywood Choirs'],
      [/^EWHP[A-Z0-9]*\s+/, 'EW Hollywood Percussion'],
      [/^EWH[A-Z0-9]+\s+/, 'EW Hollywood'],
      [/^EWOH[A-Z0-9]+\s+/, 'EW Hollywood Orchestra Opus'],
      [/^EWOP[A-Z0-9]+\s+/, 'EW Hollywood Orchestra Opus'],
      [/^EWS[A-Z0-9]+\s+/, 'EW Symphonic Orchestra'],
      [/^EWVO[A-Z0-9]+\s+/, 'EW Voices of'],
      [/^EWVP[A-Z0-9]*\s+/, 'EW'],
      [/^EWMR[0-9A-Z]*\s+/, 'EW Ministry of Rock'],
      [/^EWRA[A-Z0-9]*\s+/, 'EW RA'],
      [/^EWG[A-Z0-9]+\s+/, 'EW Goliath'],
      [/^EWDB[A-Z0-9]*\s+/, 'EW'],
      [/^EWDS[A-Z0-9]*\s+/, 'EW'],
      [/^EWBA[A-Z0-9]*\s+/, 'EW'],
      [/^EWCO[A-Z0-9]*\s+/, 'EW'],
      [/^EW[A-Z0-9]+\s+/, 'EastWest'],

      // Orchestral Tools
      [/^OTMA[0-9]+[A-Z0-9]*\s+/, 'OT Metropolis Ark'],
      [/^OTBB[A-Z0-9]*\s+/, 'OT Berlin Brass'],
      [/^OTBS[A-Z0-9]*\s+/, 'OT Berlin Strings'],
      [/^OTBW[A-Z0-9]*\s+/, 'OT Berlin Woodwinds'],
      [/^OTSO[A-Z0-9]*\s+/, 'OT Soloists'],
      [/^OTSYS[A-Z0-9]*\s+/, 'OT Symphonic'],
      [/^OTI[0-9]+[A-Z0-9]*\s+/, 'OT Inspire'],
      [/^OT[A-Z0-9]+\s+/, 'Orchestral Tools'],

      // Vienna Symphonic Library
      [/^VSBB[0-9]*\s+/, 'VSL Big Bang Orchestra'],
      [/^VSSY[A-Z0-9]+\s+/, 'VSL Synchron-ized'],
      [/^VSSYS[A-Z0-9]*\s+/, 'VSL Synchron Strings'],
      [/^VSSS[A-Z0-9]*\s+/, 'VSL Synchron Strings'],
      [/^VSS[A-Z0-9]+\s+/, 'VSL Synchron'],
      [/^VSE[0-9]+\s+/, 'VSL SE'],
      [/^VSY[A-Z0-9]+\s+/, 'VSL Synchron'],
      [/^VS[A-Z0-9]+\s+/, 'Vienna Symphonic Library'],

      // Native Instruments
      [/^NICRQ[A-Z0-9]*\s+/, 'NI Cremona Quartet'],
      [/^NIK[0-9]+\s+/, 'NI Kontakt'],
      [/^NI[A-Z0-9]+\s+/, 'Native Instruments'],

      // Audio Imperia
      [/^AIAR[0-9]*[A-Z0-9]*\s+/, 'AI Areia'],
      [/^AINU[0-9]*[A-Z0-9]*\s+/, 'AI Nucleus'],
      [/^AIJG[0-9]+\s+/, 'AI Jaeger'],
      [/^AI[A-Z0-9]+\s+/, 'Audio Imperia'],

      // Albion
      [/^AB[A-Z0-9]+\s+/, 'Spitfire Albion'],

      // ProjectSAM
      [/^PS[A-Z0-9]+\s+/, 'ProjectSAM'],

      // Strezov
      [/^ST[A-Z0-9]+\s+/, 'Strezov Sampling'],

      // Chris Hein
      [/^CH[A-Z0-9]+\s+/, 'Chris Hein'],

      // Sonuscore
      [/^SO[A-Z0-9]+\s+/, 'Sonuscore'],
      [/^SN[A-Z0-9]+\s+/, 'Sonuscore'],

      // Musical Sampling
      [/^MS[A-Z0-9]+\s+/, 'Musical Sampling'],

      // Audiobro
      [/^AU[A-Z0-9]+\s+/, 'Audiobro'],

      // Fluffy Audio
      [/^FA[A-Z0-9]+\s+/, 'Fluffy Audio'],

      // Fracture Sounds
      [/^FR[A-Z0-9]+\s+/, 'Fracture Sounds'],

      // Impact Soundworks
      [/^IS[A-Z0-9]+\s+/, 'Impact Soundworks'],
      [/^IW[A-Z0-9]+\s+/, 'Impact Soundworks'],

      // Sample Logic
      [/^SL[A-Z0-9]+\s+/, 'Sample Logic'],

      // Heavyocity
      [/^HY[A-Z0-9]+\s+/, 'Heavyocity'],

      // Embertone
      [/^EM[A-Z0-9]+\s+/, 'Embertone'],

      // Orange Tree Samples
      [/^OR[A-Z0-9]+\s+/, 'Orange Tree Samples'],

      // Spitfire LABS
      [/^LABS\s+/, 'Spitfire LABS'],

      // Keepforest
      [/^KH[A-Z0-9]+\s+/, 'Keepforest'],

      // Berlin (OT)
      [/^BE[A-Z0-9]+\s+/, 'OT Berlin'],

      // Aaron Venture
      [/^AP[A-Z0-9]+\s+/, 'Aaron Venture'],

      // Westgate
      [/^WS[A-Z0-9]+\s+/, 'Westgate'],

      // Performance Samples
      [/^PL[A-Z0-9]+\s+/, 'Performance Samples'],

      // Virharmonic
      [/^VH[A-Z0-9]+\s+/, 'Virharmonic'],
      [/^VE[A-Z0-9]+\s+/, 'Virharmonic'],

      // V2 (Big Band library)
      [/^V2M2[A-Z0-9]?\s+/, 'V2 Musics Big Band'],

      // Soundiron
      [/^SI[A-Z0-9]+\s+/, 'Soundiron'],

      // Sonokinetic
      [/^SK[A-Z0-9]+\s+/, 'Sonokinetic'],

      // Submission Audio (Bass guitars)
      [/^SA[A-Z0-9]+\s+/, 'Submission Audio'],

      // Spitfire Studio (SS prefix that's not SSS/SSB/SSW)
      [/^SSLC\s+/, 'Sample Modeling'],
      [/^SSLV\s+/, 'Sample Modeling'],
      [/^SSTB[A-Z0-9]*\s+/, 'Spitfire Studio Brass'],
      [/^SSTS[A-Z0-9]*\s+/, 'Spitfire Studio Strings'],
      [/^SSTW[A-Z0-9]*\s+/, 'Spitfire Studio Woodwinds'],
      [/^SS[A-Z0-9]+\s+/, 'Spitfire Studio'],

      // Spitfire misc
      [/^SP[A-Z0-9]+\s+/, 'Spitfire'],
      [/^SR[A-Z0-9]+\s+/, 'Spitfire'],
      [/^SX[A-Z0-9]+\s+/, 'Spitfire'],

      // Rigid Audio
      [/^RA[A-Z0-9]+\s+/, 'Rigid Audio'],

      // Red Room Audio
      [/^RW[A-Z0-9]+\s+/, 'Red Room Audio'],

      // Sample Modeling
      [/^SM[A-Z0-9]+\s+/, 'Sample Modeling'],

      // Orchestral (generic)
      [/^ORCH?\s+/, 'Orchestral'],

      // Sample libraries with ID prefix
      [/^ID[A-Z0-9]+\s+/, 'Infinite'],
      [/^IN[A-Z0-9]+\s+/, 'Infinite'],

      // Xperimenta
      [/^XP[A-Z0-9]+\s+/, 'Xperimenta'],

      // UVI
      [/^UV[A-Z0-9]+\s+/, 'UVI'],
    ];

    // Extract instrument subfolder from bank name for better organization
    const extractInstrumentFolder = (bankName: string): [string | null, string] => {
      // Strip leading number prefix (e.g., "01 ", "02 ", "11 ")
      const withoutNumber = bankName.replace(/^[0-9]+[a-z]?\s+/, '');

      // Common instrument patterns to extract as folders
      const instrumentPatterns = [
        // Strings
        /^((?:1st |2nd |First |Second )?Violin[s]?(?:\s*[1-2])?)/i,
        /^(Viola[s]?)/i,
        /^(Cell[oi](?:\s*[1-2])?)/i,
        /^((?:Double |Upright )?Bass(?:es)?(?:\s*[1-2])?)/i,
        /^(Contrabass)/i,
        // Brass
        /^(Trumpet[s]?(?:\s*[1-3])?)/i,
        /^(Trombone[s]?)/i,
        /^((?:French )?Horn[s]?)/i,
        /^(Tuba[s]?)/i,
        /^(Wagner Tuba[s]?)/i,
        /^(Cornet[s]?)/i,
        /^(Flugelhorn)/i,
        /^(Euphoni[ou]m)/i,
        // Woodwinds
        /^(Flute[s]?)/i,
        /^(Oboe[s]?)/i,
        /^(Clarinet[s]?)/i,
        /^(Bassoon[s]?)/i,
        /^(Piccolo)/i,
        /^(English Horn)/i,
        /^(Woodwind[s]?)/i,
        // Percussion
        /^(Timpani)/i,
        /^(Percussion)/i,
        /^(Snare)/i,
        /^(Cymbals?)/i,
        /^(Xylophone)/i,
        /^(Marimba)/i,
        /^(Vibraphone)/i,
        /^(Glockenspiel)/i,
        // Keys
        /^(Piano)/i,
        /^(Harp)/i,
        /^(Celesta)/i,
        // Choir / Vocals
        /^(Choir)/i,
        /^(Soprano[s]?)/i,
        /^(Alto[s]?)/i,
        /^(Tenor[s]?)/i,
        /^(Basso?\s+\w+)/i,
        /^(ATB\s+\w+)/i,
        // Ensembles / Collections
        /^(Appassionata\s+\w+)/i,
        /^(Chamber\s+\w+)/i,
        /^(Synchron\s+\w+(?:\s+\w+)?)/i,
        /^(Epic\s+\w+)/i,
        /^(Fanfare\s+\w+)/i,
        /^(Dimension\s+\w+)/i,
        /^(Syzd\s+\w+(?:\s+\w+)?)/i,
        // Century-style naming (instrument at end)
        /^(Century\s+(?:Ens(?:emble)?|Str(?:ings)?|Solo)?\s*(?:Lite\s+)?(?:Vln|Vn))/i,
        /^(Century\s+(?:Ens(?:emble)?|Str(?:ings)?|Solo)?\s*(?:Lite\s+)?(?:Vla|Va))/i,
        /^(Century\s+(?:Ens(?:emble)?|Str(?:ings)?|Solo)?\s*(?:Lite\s+)?(?:Vc|Vlc|Cello))/i,
        /^(Century\s+(?:Ens(?:emble)?|Str(?:ings)?|Solo)?\s*(?:Lite\s+)?(?:CB|Cb|Bass))/i,
        /^(Century\s+(?:Brass|Woodwinds?|WW|Strings?|Str))/i,
        // Generic Century catch-all by section
        /Century.*\b(Vln|Vn|Violin)/i,
        /Century.*\b(Vla|Va|Viola)/i,
        /Century.*\b(Vc|Vlc|Cello)/i,
        /Century.*\b(CB|Cb|Contrabass|Bass(?:es)?)/i,
        /Century.*\b(Brass)/i,
        /Century.*\b(WW|Woodwinds?)/i,
      ];

      for (const pattern of instrumentPatterns) {
        const match = withoutNumber.match(pattern);
        if (match) {
          return [match[1], bankName];
        }
      }

      // Second pass: look for instrument abbreviations anywhere in the name
      // Common in libraries like 8Dio Century that use "Century Ens Lite CB" format
      const abbrevPatterns: [RegExp, string][] = [
        // Strings
        [/\b(Vln|Vn)\b/i, 'Violins'],
        [/\b(Vla|Va)\b/i, 'Violas'],
        [/\b(Vc|Vlc)\b/i, 'Cellos'],
        [/\bCB\b/, 'Basses'],  // Case sensitive to avoid false matches
        // Brass
        [/\b(Tpt|Tp)\b/i, 'Trumpets'],
        [/\b(Tbn|Trb)\b/i, 'Trombones'],
        [/\b(Hn|Hrn)\b/i, 'Horns'],
        [/\bTba\b/i, 'Tubas'],
        // Woodwinds
        [/\b(Fl)\b/i, 'Flutes'],
        [/\bOb\b/i, 'Oboes'],
        [/\bCl\b/i, 'Clarinets'],
        [/\b(Bn|Bsn)\b/i, 'Bassoons'],
        [/\bPicc?\b/i, 'Piccolo'],
        // Sections
        [/\bStr(?:ings)?\b/i, 'Strings'],
        [/\bBrass\b/i, 'Brass'],
        [/\b(?:WW|Woodwinds?)\b/i, 'Woodwinds'],
        [/\bPerc(?:ussion)?\b/i, 'Percussion'],
      ];

      for (const [pattern, instrumentName] of abbrevPatterns) {
        if (pattern.test(withoutNumber)) {
          return [instrumentName, bankName];
        }
      }

      // No specific instrument found
      return [null, bankName];
    };

    // Libraries that benefit from instrument subfolders (large libraries)
    const librariesWithSubfolders = [
      'VSL Synchron',
      'VSL Synchron-ized',
      'VSL Synchron Strings',
      'VSL SE',
      'Vienna Symphonic Library',
      'Orchestral Tools',
      'OT Berlin Brass',
      'OT Berlin Strings',
      'OT Berlin Woodwinds',
      'OT Metropolis Ark',
      'Spitfire Audio',
      'BBC Symphony Orchestra',
      'EW Hollywood Strings',
      'EW Hollywood Brass',
      'EW Hollywood Woodwinds',
      'EW Hollywood Orchestra',
      '8Dio Century',
      '8Dio Adagio',
      '8Dio Agitato',
      '8Dio',
    ];

    // Try each pattern
    for (const [pattern, libraryName] of prefixPatterns) {
      const match = name.match(pattern);
      if (match) {
        const rest = name.substring(match[0].length).trim();

        // For large libraries, try to extract instrument subfolder
        if (librariesWithSubfolders.includes(libraryName)) {
          const [instrument, displayName] = extractInstrumentFolder(rest);
          if (instrument) {
            return [libraryName, instrument, displayName];
          }
        }

        return [libraryName, rest];
      }
    }

    // Generic fallback - extract first token as folder
    const genericMatch = name.match(/^([A-Z][A-Z0-9]{1,7})\s+(.+)$/);
    if (genericMatch) {
      return [genericMatch[1], genericMatch[2]];
    }

    return ['Other', name];
  };

  const getBankKey = (bank: ArticulationSet) => `${bank.msb}-${bank.lsb}`;

  const countBanksInFolder = (node: FolderNode): number => {
    let count = node.banks.length;
    Object.values(node.subfolders).forEach(sub => {
      count += countBanksInFolder(sub);
    });
    return count;
  };

  const getAllBanksInFolder = (node: FolderNode): ArticulationSet[] => {
    const banks = [...node.banks];
    Object.values(node.subfolders).forEach(sub => {
      banks.push(...getAllBanksInFolder(sub));
    });
    return banks;
  };

  const getFolderState = (node: FolderNode): 'none' | 'some' | 'all' => {
    const allBanksInNode = getAllBanksInFolder(node);
    if (allBanksInNode.length === 0) return 'none';
    const selectedCount = allBanksInNode.filter(b => selectedBanks.has(getBankKey(b))).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === allBanksInNode.length) return 'all';
    return 'some';
  };

  const toggleFolder = (node: FolderNode) => {
    const state = getFolderState(node);
    const allBanksInNode = getAllBanksInFolder(node);
    const newSelected = new Set(selectedBanks);

    if (state === 'all') {
      allBanksInNode.forEach(b => newSelected.delete(getBankKey(b)));
    } else {
      allBanksInNode.forEach(b => newSelected.add(getBankKey(b)));
    }

    setSelectedBanks(newSelected);
  };

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const selectedBanksList = useMemo(() => {
    return allBanks.filter(b => selectedBanks.has(getBankKey(b)));
  }, [allBanks, selectedBanks]);

  const handleGenerate = async () => {
    if (selectedBanksList.length === 0) return;

    setGenerating(true);
    try {
      const tracks: TrackConfig[] = selectedBanksList.map(bank => ({
        bank: {
          msb: bank.msb,
          lsb: bank.lsb,
          name: bank.name,
          articulations: bank.articulations.map(a => ({
            number: a.number,
            name: a.name,
          })),
        },
        name: bank.name,
      }));

      const rppContent = generateRPP({
        name: 'My Template',
        tempo: 120,
        sampleRate: 48000,
        tracks,
      });

      const blob = new Blob([rppContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Template.RPP';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate:', err);
    } finally {
      setGenerating(false);
    }
  };

  // Checkbox component matching Cubase style
  const Checkbox = ({ state, onClick }: { state: 'none' | 'some' | 'all'; onClick: () => void }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`w-[18px] h-[18px] rounded-[3px] border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
        state === 'none'
          ? 'border-gray-500 bg-transparent hover:border-gray-400'
          : 'border-red-500 bg-red-500'
      }`}
    >
      {state === 'all' && (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {state === 'some' && (
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="11" width="16" height="2" rx="1" />
        </svg>
      )}
    </button>
  );

  // Folder icon component (yellow folder like Cubase)
  const FolderIcon = ({ open }: { open?: boolean }) => (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="#f59e0b">
      {open ? (
        // Open folder
        <>
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H8a3 3 0 00-3 2.5L4 18H4a2 2 0 01-2-2V6z" />
          <path d="M6 12a2 2 0 012-2h10l-2 8H6l2-6z" fillOpacity="0.9" />
        </>
      ) : (
        // Closed folder
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      )}
    </svg>
  );

  // Document icon for bank items
  const DocumentIcon = () => (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="#94a3b8">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
    </svg>
  );

  // Render folder
  const renderFolder = (node: FolderNode, depth: number = 0): JSX.Element | null => {
    if (node.name === 'Root') {
      return (
        <div>
          {Object.values(node.subfolders)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(sub => renderFolder(sub, 0))}
        </div>
      );
    }

    const isExpanded = expandedFolders.has(node.path);
    const hasChildren = Object.keys(node.subfolders).length > 0 || node.banks.length > 0;
    const count = countBanksInFolder(node);
    const state = getFolderState(node);
    const indent = depth * 24;

    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-2 py-1 cursor-pointer group"
          style={{ paddingLeft: `${indent + 12}px` }}
        >
          <Checkbox state={state} onClick={() => toggleFolder(node)} />

          <div
            className="flex items-center gap-1.5 flex-1"
            onClick={() => hasChildren && toggleExpanded(node.path)}
          >
            <FolderIcon open={isExpanded} />
            <span className="text-[#60a5fa] text-[15px]">{node.name}</span>
            <span className="text-gray-500 text-[13px]">({count})</span>
          </div>
        </div>

        {isExpanded && (
          <div>
            {Object.values(node.subfolders)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(sub => renderFolder(sub, depth + 1))}

            {node.banks
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(bank => {
                const key = getBankKey(bank);
                const isSelected = selectedBanks.has(key);
                // Extract just the articulation name (last part after library prefix)
                const displayName = parseBankNameToPath(bank.name).slice(-1)[0] || bank.name;
                const toggleBank = () => {
                  const newSelected = new Set(selectedBanks);
                  if (isSelected) {
                    newSelected.delete(key);
                  } else {
                    newSelected.add(key);
                  }
                  setSelectedBanks(newSelected);
                };
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 py-1 cursor-pointer group hover:bg-[#1e293b] rounded"
                    style={{ paddingLeft: `${(depth + 1) * 24 + 12}px` }}
                    onClick={toggleBank}
                  >
                    <Checkbox state={isSelected ? 'all' : 'none'} onClick={toggleBank} />
                    <DocumentIcon />
                    <span className="text-[#94a3b8] text-[14px]">{displayName}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1729] text-white flex items-center justify-center">
        <div className="text-gray-400">Loading banks...</div>
      </div>
    );
  }

  if (allBanks.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f1729] text-white p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">Reaper Template Builder</h1>
          <p className="text-gray-400 mb-8">
            Select banks to include in your Reaper template. Tracks will have Reaticulate banks pre-assigned.
          </p>
          <div className="bg-[#1a2332] rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">No banks loaded. Load a .reabank file to get started.</p>
            <label className="inline-block">
              <input type="file" accept=".reabank" onChange={handleFileUpload} className="hidden" />
              <span className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg cursor-pointer inline-block transition-colors">
                Load .reabank File
              </span>
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1729] text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl font-bold mb-1">Reaper Template Builder</h1>
        <p className="text-gray-400 mb-6">
          Select banks to include in your Reaper template. Tracks will have Reaticulate banks pre-assigned.
        </p>

        {/* Main Layout */}
        <div className="flex gap-6">
          {/* Left Panel - Bank Tree */}
          <div className="flex-1 bg-[#1a2332] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Reaticulate Banks ({allBanks.length} total)</h2>
              <label className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer">
                <input type="file" accept=".reabank" onChange={handleFileUpload} className="hidden" />
                Load different file
              </label>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {folderTree && renderFolder(folderTree)}
            </div>
          </div>

          {/* Right Panel - Selected */}
          <div className="w-56 bg-[#1a2332] rounded-lg p-5">
            <h2 className="font-semibold mb-4">Selected</h2>

            <div className="text-5xl font-bold text-white mb-1">
              {selectedBanksList.length}
            </div>
            <div className="text-gray-400 text-sm mb-6">tracks</div>

            <button
              onClick={handleGenerate}
              disabled={selectedBanksList.length === 0 || generating}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {generating ? 'Generating...' : 'Generate .RPP'}
            </button>

            <div className="mt-6">
              <h3 className="text-sm text-gray-400 mb-2">Next Steps:</h3>
              <ol className="text-sm text-gray-500 space-y-1">
                <li>1. Open generated .RPP in Reaper</li>
                <li>2. Load Kontakt patches</li>
                <li>3. Banks are already assigned!</li>
                <li>4. Start composing</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
