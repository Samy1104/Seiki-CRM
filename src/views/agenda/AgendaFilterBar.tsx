import React from 'react';
import { Search, X } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';

const segments = [
  'Tous les segments',
  'Général',
  'Média',
  'Investisseurs',
  'Partenaires',
];

interface AgendaFilterBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedSegment: string;
  setSelectedSegment: (seg: string) => void;
}

export const AgendaFilterBar: React.FC<AgendaFilterBarProps> = ({
  searchTerm,
  setSearchTerm,
  selectedSegment,
  setSelectedSegment,
}) => {
  const hasActiveFilters = Boolean(searchTerm || (selectedSegment && selectedSegment !== 'Tous les segments'));

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedSegment('Tous les segments');
  };

  return (
    <div
      className="p-4 rounded-2xl border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4"
      style={{ background: 'var(--bg-panel)' }}
    >
      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="text"
            placeholder="Rechercher un événement, lieu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
          />
        </div>

        {/* Segment Filter */}
        <div className="w-[180px]">
          <Select value={selectedSegment} onValueChange={setSelectedSegment}>
            <SelectTrigger>
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent>
              {segments.map((seg) => (
                <SelectItem key={seg} value={seg}>
                  {seg}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <X size={14} />
          <span>Effacer</span>
        </button>
      )}
    </div>
  );
};
