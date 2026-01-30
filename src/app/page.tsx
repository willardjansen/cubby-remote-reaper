'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArticulationGrid } from '@/components/ArticulationGrid';
import {
  ArticulationSet,
  createDemoArticulationSet,
  parseReabankFile,
  autoAssignRemoteTriggers,
  hasUnassignedRemotes,
  searchBanks,
} from '@/lib/reabankParser';
import { midiHandler, MidiState, BankData } from '@/lib/midiHandler';

export default function Home() {
  const [midiState, setMidiState] = useState<MidiState | null>(null);
  const [currentSet, setCurrentSet] = useState<ArticulationSet | null>(null);
  const [currentTrack, setCurrentTrack] = useState<string>('');
  const [allBanks, setAllBanks] = useState<ArticulationSet[]>([]);
  const [columns, setColumns] = useState(4);
  const [buttonSize, setButtonSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showSettings, setShowSettings] = useState(false);
  const [showBankBrowser, setShowBankBrowser] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  // Initialize MIDI
  useEffect(() => {
    midiHandler.initialize().then(state => {
      setMidiState(state);
    });

    const unsubscribe = midiHandler.subscribe(state => {
      setMidiState(state);
    });

    return () => unsubscribe();
  }, []);

  // Listen for bank data from Reaper (with full articulation list)
  useEffect(() => {
    const unsubscribeBankData = midiHandler.onBankData((bankData: BankData) => {
      setCurrentTrack(bankData.trackName);

      // Convert bank data to ArticulationSet
      const colorMap: Record<string, number> = {
        'default': 0, 'long': 1, 'long-light': 2, 'long-dark': 3,
        'short': 4, 'short-light': 5, 'short-dark': 6, 'textured': 7,
        'fx': 8, 'legato': 9, 'staccato': 10, 'tremolo': 11,
        'trill': 12, 'pizz': 13, 'harmonics': 14, 'percussion': 15,
        // Additional Reaticulate colors
        'con-sord': 1, 'sordino': 1, 'muted': 1,
        'marcato': 4, 'accent': 4,
        'legato-runs': 9, 'legato-fast': 9, 'legato-slow': 9,
        'staccatissimo': 10, 'spiccato': 10,
        'col-legno': 8, 'sul-pont': 8, 'sul-tasto': 8,
        'note-whole': 1, 'note-half': 1,
      };

      const artSet: ArticulationSet = {
        name: bankData.bankName,
        fileName: `${bankData.msb}-${bankData.lsb}`,
        msb: bankData.msb,
        lsb: bankData.lsb,
        articulations: bankData.articulations.map((art) => ({
          id: `${bankData.msb}-${bankData.lsb}-${art.number}`,
          number: art.number,
          name: art.name,
          shortName: art.name.length > 8 ? art.name.substring(0, 8) : art.name,
          description: art.name,
          color: colorMap[art.color] ?? 0,
          group: 0,
          articulationType: 0,
          midiMessages: [
            { status: 0xC0, data1: art.number, data2: 0 },     // Program Change only
          ],
        })),
      };

      console.log('>>> SETTING ARTICULATION SET:', artSet.name, artSet.articulations.length);
      setCurrentSet(artSet);
      console.log(`Loaded bank from Reaper: ${bankData.bankName} (${bankData.articulations.length} articulations)`);
      console.log('Colors received:', bankData.articulations.map(a => a.color));
    });

    // Also listen for simple track changes (when no Reaticulate bank)
    const unsubscribeTrack = midiHandler.onTrackName(async (trackName) => {
      setCurrentTrack(trackName);

      // Search for matching bank in manually loaded banks
      if (allBanks.length > 0) {
        const matches = searchBanks(allBanks, trackName);
        if (matches.length > 0) {
          let artSet = matches[0];
          if (hasUnassignedRemotes(artSet)) {
            artSet = autoAssignRemoteTriggers(artSet);
          }
          setCurrentSet(artSet);
          console.log(`Matched bank by track name: ${artSet.name}`);
        }
      }
    });

    return () => {
      unsubscribeBankData();
      unsubscribeTrack();
    };
  }, [allBanks]);

  // Load saved settings from localStorage
  useEffect(() => {
    const savedColumns = localStorage.getItem('reaper-grid-columns');
    if (savedColumns) setColumns(parseInt(savedColumns));

    const savedSize = localStorage.getItem('reaper-button-size');
    if (savedSize) setButtonSize(savedSize as 'small' | 'medium' | 'large');
  }, []);

  // Handle reabank file upload
  const handleFileUpload = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.reabank')) {
        try {
          const content = await file.text();
          const parsed = parseReabankFile(content);

          console.log(`Loaded ${parsed.banks.length} banks from ${file.name}`);

          // Store all banks for search
          setAllBanks(parsed.banks);

          // Auto-select first bank
          if (parsed.banks.length > 0) {
            let artSet = parsed.banks[0];
            if (hasUnassignedRemotes(artSet)) {
              artSet = autoAssignRemoteTriggers(artSet);
            }
            setCurrentSet(artSet);
          }
        } catch (error) {
          console.error(`Failed to parse ${file.name}:`, error);
        }
      }
    }
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Select a bank from the browser
  const selectBank = (bank: ArticulationSet) => {
    let artSet = bank;
    if (hasUnassignedRemotes(artSet)) {
      artSet = autoAssignRemoteTriggers(artSet);
    }
    setCurrentSet(artSet);
    setShowBankBrowser(false);
  };

  // Filtered banks for browser
  const filteredBanks = bankSearch ? searchBanks(allBanks, bankSearch) : allBanks;

  const hasBank = currentSet !== null;

  return (
    <main
      className="min-h-screen p-4"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Cubby Remote</h1>

          {/* Connection status */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${midiState?.isConnected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-sm text-reaper-muted">
              {midiState?.isConnected
                ? midiState.useWebSocket
                  ? 'MIDI Bridge'
                  : 'Connected'
                : 'Disconnected'
              }
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Current track */}
          {currentTrack && (
            <span className="text-sm text-reaper-highlight bg-reaper-highlight/20 px-3 py-1 rounded-lg">
              {currentTrack}
            </span>
          )}

          {/* Bank count */}
          {allBanks.length > 0 && (
            <button
              onClick={() => setShowBankBrowser(true)}
              className="text-sm text-reaper-muted bg-reaper-surface px-3 py-1 rounded-lg
                hover:bg-reaper-accent transition-colors"
            >
              {allBanks.length} banks
            </button>
          )}

          {/* Template Builder link */}
          <button
            onClick={() => window.open('/template-builder', '_blank')}
            className="p-2 rounded-lg bg-reaper-surface hover:bg-reaper-accent transition-colors"
            title="Template Builder"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </button>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg bg-reaper-surface hover:bg-reaper-accent transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Settings panel */}
      {showSettings && (
        <div className="mb-4 p-4 bg-reaper-surface rounded-lg space-y-4">
          <h3 className="font-semibold">Settings</h3>

          {/* Column selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-reaper-muted">Columns:</label>
            <div className="flex gap-1">
              {[3, 4, 5, 6, 8].map(n => (
                <button
                  key={n}
                  onClick={() => {
                    setColumns(n);
                    localStorage.setItem('reaper-grid-columns', n.toString());
                  }}
                  className={`px-3 py-1 rounded text-sm ${columns === n
                    ? 'bg-reaper-highlight'
                    : 'bg-reaper-accent hover:bg-reaper-highlight/50'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Button size */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-reaper-muted">Size:</label>
            <div className="flex gap-1">
              {(['small', 'medium', 'large'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => {
                    setButtonSize(size);
                    localStorage.setItem('reaper-button-size', size);
                  }}
                  className={`px-3 py-1 rounded text-sm capitalize ${buttonSize === size
                    ? 'bg-reaper-highlight'
                    : 'bg-reaper-accent hover:bg-reaper-highlight/50'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* MIDI output */}
          {midiState && midiState.outputs.length > 0 && (
            <div>
              <label className="text-sm text-reaper-muted block mb-2">
                MIDI Output:
              </label>
              <select
                value={midiState.selectedOutputId || ''}
                onChange={(e) => midiHandler.selectOutput(e.target.value)}
                className="w-full p-2 rounded bg-reaper-accent text-white text-sm"
              >
                {midiState.outputs.map(output => (
                  <option key={output.id} value={output.id}>
                    {output.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Bank Browser Modal */}
      {showBankBrowser && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setShowBankBrowser(false)}
        >
          <div
            className="bg-reaper-surface rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-reaper-accent">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Select Bank</h3>
                <button
                  onClick={() => setShowBankBrowser(false)}
                  className="text-reaper-muted hover:text-white"
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                placeholder="Search banks..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="w-full px-3 py-2 rounded bg-reaper-bg border border-reaper-accent
                  text-white focus:outline-none focus:border-reaper-highlight"
                autoFocus
              />
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {filteredBanks.length === 0 ? (
                <p className="text-reaper-muted text-center py-4">No banks found</p>
              ) : (
                <div className="space-y-1">
                  {filteredBanks.slice(0, 100).map((bank, i) => (
                    <button
                      key={`${bank.msb}-${bank.lsb}-${i}`}
                      onClick={() => selectBank(bank)}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-reaper-accent
                        transition-colors ${currentSet?.name === bank.name ? 'bg-reaper-highlight' : ''}`}
                    >
                      <div className="font-medium">{bank.name}</div>
                      <div className="text-xs text-reaper-muted">
                        Bank {bank.msb}/{bank.lsb} • {bank.articulations.length} articulations
                      </div>
                    </button>
                  ))}
                  {filteredBanks.length > 100 && (
                    <p className="text-reaper-muted text-center py-2 text-sm">
                      Showing 100 of {filteredBanks.length} banks. Use search to narrow down.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Articulation Grid or Waiting Screen */}
      {hasBank ? (
        <ArticulationGrid
          articulationSet={currentSet}
          columns={columns}
          buttonSize={buttonSize}
        />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <p className="text-xl text-reaper-muted">
            Select a track in Reaper
          </p>
        </div>
      )}
    </main>
  );
}
