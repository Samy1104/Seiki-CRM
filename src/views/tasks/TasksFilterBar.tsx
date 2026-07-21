import React from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';
import type { Lead } from '../../services/leadsService';
import type { TeamMember } from '../../services/settingsService';

interface TasksFilterBarProps {
  filterPriority: 'high' | 'medium' | 'low' | '';
  setFilterPriority: (val: 'high' | 'medium' | 'low' | '') => void;
  filterLeadId: string;
  setFilterLeadId: (val: string) => void;
  filterAssigneeId: string;
  setFilterAssigneeId: (val: string) => void;
  sortByDue: 'asc' | '';
  setSortByDue: (val: 'asc' | '') => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  leads: Lead[];
  teamMembers: TeamMember[];
}

export const TasksFilterBar: React.FC<TasksFilterBarProps> = ({
  filterPriority,
  setFilterPriority,
  filterLeadId,
  setFilterLeadId,
  filterAssigneeId,
  setFilterAssigneeId,
  sortByDue,
  setSortByDue,
  hasActiveFilters,
  clearFilters,
  leads,
  teamMembers,
}) => {
  return (
    <div
      className="p-4 rounded-2xl border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4"
      style={{ background: 'var(--bg-panel)' }}
    >
      <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mr-1">
          <SlidersHorizontal size={14} />
          <span>Filtres</span>
        </div>

        {/* Priorité */}
        <Select
          value={filterPriority}
          onValueChange={(val) => setFilterPriority(val as 'high' | 'medium' | 'low' | '')}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Toutes priorités" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Toutes priorités</SelectItem>
            <SelectItem value="high">Haute</SelectItem>
            <SelectItem value="medium">Moyenne</SelectItem>
            <SelectItem value="low">Basse</SelectItem>
          </SelectContent>
        </Select>

        {/* Lead */}
        <Select value={filterLeadId} onValueChange={setFilterLeadId}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tous les leads" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous les leads</SelectItem>
            {leads.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Assigné */}
        <Select value={filterAssigneeId} onValueChange={setFilterAssigneeId}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tous les membres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous les membres</SelectItem>
            {teamMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tri */}
        <Select value={sortByDue} onValueChange={(val) => setSortByDue(val as 'asc' | '')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tri par défaut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tri par défaut</SelectItem>
            <SelectItem value="asc">Date d'échéance (proche)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <X size={14} />
          <span>Effacer les filtres</span>
        </button>
      )}
    </div>
  );
};
