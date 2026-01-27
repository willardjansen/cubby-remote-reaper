'use client';

import { Articulation, ArticulationSet, groupArticulations, countAutoAssignedRemotes } from '@/lib/reabankParser';
import { ArticulationButton } from './ArticulationButton';
import { useState, useMemo } from 'react';

interface ArticulationGridProps {
  articulationSet: ArticulationSet | null;
  columns?: number;
  buttonSize?: 'small' | 'medium' | 'large';
}

export function ArticulationGrid({
  articulationSet,
  columns = 4,
  buttonSize = 'medium'
}: ArticulationGridProps) {
  const [activeArticulationId, setActiveArticulationId] = useState<string | null>(null);

  // Safety check
  if (!articulationSet) return null;
  const [filterType, setFilterType] = useState<'all' | 'attribute' | 'direction'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter articulations
  const filteredArticulations = useMemo(() => {
    let arts = articulationSet.articulations;

    if (filterType === 'attribute') {
      arts = arts.filter(a => a.articulationType === 0);
    } else if (filterType === 'direction') {
      arts = arts.filter(a => a.articulationType === 1);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      arts = arts.filter(a =>
        a.name.toLowerCase().includes(query) ||
        a.shortName.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query)
      );
    }

    return arts;
  }, [articulationSet.articulations, filterType, searchQuery]);

  // Group by group number
  const groupedArticulations = useMemo(() => {
    return groupArticulations(filteredArticulations);
  }, [filteredArticulations]);

  const handleActivate = (articulation: Articulation) => {
    setActiveArticulationId(articulation.id);
  };

  const hasMultipleGroups = groupedArticulations.size > 1;

  // Count types
  const typeCount = useMemo(() => {
    const attributes = articulationSet.articulations.filter(a => a.articulationType === 0).length;
    const directions = articulationSet.articulations.filter(a => a.articulationType === 1).length;
    return { attributes, directions };
  }, [articulationSet.articulations]);

  const autoAssignedCount = useMemo(() => {
    return countAutoAssignedRemotes(articulationSet);
  }, [articulationSet]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header and filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-lg font-semibold text-white truncate max-w-full">
          {articulationSet.name}
        </h2>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-reaper-surface border border-reaper-accent
                       text-white text-sm w-40 focus:outline-none focus:ring-2
                       focus:ring-reaper-highlight"
          />

          {/* Type filter */}
          {typeCount.attributes > 0 && typeCount.directions > 0 && (
            <div className="flex rounded-lg overflow-hidden border border-reaper-accent">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${filterType === 'all'
                    ? 'bg-reaper-highlight text-white'
                    : 'bg-reaper-surface text-reaper-muted hover:bg-reaper-accent'}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('attribute')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${filterType === 'attribute'
                    ? 'bg-reaper-highlight text-white'
                    : 'bg-reaper-surface text-reaper-muted hover:bg-reaper-accent'}`}
              >
                Attr ({typeCount.attributes})
              </button>
              <button
                onClick={() => setFilterType('direction')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${filterType === 'direction'
                    ? 'bg-reaper-highlight text-white'
                    : 'bg-reaper-surface text-reaper-muted hover:bg-reaper-accent'}`}
              >
                Dir ({typeCount.directions})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-reaper-muted text-sm">
          {filteredArticulations.length} articulation{filteredArticulations.length !== 1 ? 's' : ''}
          {articulationSet.msb > 0 && (
            <span className="ml-2 text-xs opacity-75">
              Bank {articulationSet.msb}/{articulationSet.lsb}
            </span>
          )}
        </p>

        {autoAssignedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-500/20 border border-orange-500/50">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-xs text-orange-300">
              {autoAssignedCount} auto-assigned
            </span>
          </div>
        )}
      </div>

      {/* Grid */}
      {hasMultipleGroups ? (
        <div className="space-y-6">
          {Array.from(groupedArticulations.entries())
            .sort(([a], [b]) => a - b)
            .map(([groupNum, arts]) => (
              <div key={groupNum} className="space-y-2">
                <h3 className="text-sm font-medium text-reaper-muted">
                  Group {groupNum + 1}
                </h3>
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
                  }}
                >
                  {arts.map(art => (
                    <ArticulationButton
                      key={art.id}
                      articulation={art}
                      isActive={art.id === activeArticulationId}
                      onActivate={handleActivate}
                      size={buttonSize}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
          }}
        >
          {filteredArticulations.map(art => (
            <ArticulationButton
              key={art.id}
              articulation={art}
              isActive={art.id === activeArticulationId}
              onActivate={handleActivate}
              size={buttonSize}
            />
          ))}
        </div>
      )}

      {filteredArticulations.length === 0 && (
        <div className="text-center py-8 text-reaper-muted">
          No articulations found
        </div>
      )}
    </div>
  );
}
