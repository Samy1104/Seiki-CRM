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
      className="p-3.5 rounded-xl flex items-center justify-between gap-4 w-full"
      style={{
        background: '#141414',
        border: '1px solid rgba(242,237,228,0.08)',
      }}
    >
      <div
        className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] flex-shrink-0 mr-1"
        style={{ color: "var(--color-charcoal-fg-soft, #b0afa8)" }}
      >
        <SlidersHorizontal size={13} style={{ color: "#666" }} />
        <span>Filtres</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1 min-w-0">
        {/* Priorité */}
        <Select
          value={filterPriority}
          onValueChange={(val) => setFilterPriority(val as 'high' | 'medium' | 'low' | '')}
        >
          <SelectTrigger className="w-full text-[12px]" style={{ background: '#0d0d0d', borderColor: 'rgba(242,237,228,0.12)', color: 'var(--color-charcoal-fg, #f2ede4)' }}>
            <SelectValue placeholder="Toutes priorités" />
          </SelectTrigger>
          <SelectContent style={{ background: '#141414', borderColor: 'rgba(242,237,228,0.15)', color: 'var(--color-charcoal-fg, #f2ede4)' }}>
            <SelectItem value="">Toutes priorités</SelectItem>
            <SelectItem value="high">Haute</SelectItem>
            <SelectItem value="medium">Moyenne</SelectItem>
            <SelectItem value="low">Basse</SelectItem>
          </SelectContent>
        </Select>

        {/* Lead */}
        <Select value={filterLeadId} onValueChange={setFilterLeadId}>
          <SelectTrigger className="w-full text-[12px]" style={{ background: '#0d0d0d', borderColor: 'rgba(242,237,228,0.12)', color: 'var(--color-charcoal-fg, #f2ede4)' }}>
            <SelectValue placeholder="Tous les leads" />
          </SelectTrigger>
          <SelectContent style={{ background: '#141414', borderColor: 'rgba(242,237,228,0.15)', color: 'var(--color-charcoal-fg, #f2ede4)' }}>
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
          <SelectTrigger className="w-full text-[12px]" style={{ background: '#0d0d0d', borderColor: 'rgba(242,237,228,0.12)', color: 'var(--color-charcoal-fg, #f2ede4)' }}>
            <SelectValue placeholder="Tous les membres" />
          </SelectTrigger>
          <SelectContent style={{ background: '#141414', borderColor: 'rgba(242,237,228,0.15)', color: 'var(--color-charcoal-fg, #f2ede4)' }}>
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
          <SelectTrigger className="w-full text-[12px]" style={{ background: '#0d0d0d', borderColor: 'rgba(242,237,228,0.12)', color: 'var(--color-charcoal-fg, #f2ede4)' }}>
            <SelectValue placeholder="Tri par défaut" />
          </SelectTrigger>
          <SelectContent style={{ background: '#141414', borderColor: 'rgba(242,237,228,0.15)', color: 'var(--color-charcoal-fg, #f2ede4)' }}>
            <SelectItem value="">Tri par défaut</SelectItem>
            <SelectItem value="asc">Date d'échéance (proche)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] uppercase tracking-[0.1em] font-medium transition-colors cursor-pointer flex-shrink-0"
          style={{
            color: "var(--color-charcoal-danger, #e05252)",
            background: "rgba(224, 82, 82, 0.1)",
            border: "1px solid rgba(224, 82, 82, 0.2)",
          }}
        >
          <X size={13} />
          <span>Effacer</span>
        </button>
      )}
    </div>
  );
};
