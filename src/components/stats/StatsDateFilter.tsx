import React, { useState } from 'react';
import { Calendar, Download, User } from 'lucide-react';
import { DateFilterState } from '../../utils/statsCalculations';

export interface StatsDateFilterProps {
  filter: DateFilterState;
  onFilterChange: (filter: DateFilterState) => void;
  salesReps: { id: string; name: string }[];
  selectedRep: string;
  onRepChange: (repId: string) => void;
  onExportCsv: () => void;
}

export const StatsDateFilter: React.FC<StatsDateFilterProps> = ({
  filter,
  onFilterChange,
  salesReps,
  selectedRep,
  onRepChange,
  onExportCsv,
}) => {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [startDate, setStartDate] = useState(filter.startDate || '');
  const [endDate, setEndDate] = useState(filter.endDate || '');

  const presets: { key: DateFilterState['preset']; label: string }[] = [
    { key: 'today', label: "Aujourd'hui" },
    { key: '7d', label: '7 derniers jours' },
    { key: 'month', label: 'Ce mois' },
    { key: 'quarter', label: 'Ce trimestre' },
    { key: 'year', label: 'Année en cours' },
    { key: 'all', label: 'Tout' },
  ];

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate && endDate) {
      onFilterChange({ preset: 'custom', startDate, endDate });
      setShowCustomModal(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line-strong bg-[#141414] p-4">
      {/* Presets */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => {
          const isActive = filter.preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onFilterChange({ preset: p.key })}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#D4C4A8] text-black'
                  : 'bg-[#1e1e1e] text-[#f2ede4] hover:bg-[#2a2a2a]'
              }`}
            >
              {p.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowCustomModal(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            filter.preset === 'custom'
              ? 'bg-[#D4C4A8] text-black'
              : 'bg-[#1e1e1e] text-[#f2ede4] hover:bg-[#2a2a2a]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          {filter.preset === 'custom' && filter.startDate && filter.endDate
            ? `${filter.startDate} → ${filter.endDate}`
            : 'Personnalisé'}
        </button>
      </div>

      {/* Sales Rep Filter & Export */}
      <div className="flex items-center gap-3">
        {salesReps.length > 0 && (
          <div className="flex items-center gap-2 bg-[#1e1e1e] px-3 py-1.5 rounded-lg border border-line">
            <User className="w-3.5 h-3.5 text-[#D4C4A8]" />
            <select
              value={selectedRep}
              onChange={(e) => onRepChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-[#f2ede4] focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#141414]">
                Tous les commerciaux
              </option>
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id} className="bg-[#141414]">
                  {rep.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={onExportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1e1e1e] text-[#D4C4A8] border border-[#D4C4A8]/30 hover:bg-[#D4C4A8] hover:text-black transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Exporter (.csv)
        </button>
      </div>

      {/* Custom Date Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleApplyCustom}
            className="w-full max-w-sm rounded-2xl border border-line-strong bg-[#141414] p-6 space-y-4 shadow-xl"
          >
            <h3 className="text-base font-bold text-[#f2ede4]">Sélectionner une période</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="custom-start-date" className="block text-xs text-ink-soft mb-1">
                  Date de début
                </label>
                <input
                  id="custom-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg bg-[#1e1e1e] border border-line px-3 py-2 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                  required
                />
              </div>
              <div>
                <label htmlFor="custom-end-date" className="block text-xs text-ink-soft mb-1">
                  Date de fin
                </label>
                <input
                  id="custom-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg bg-[#1e1e1e] border border-line px-3 py-2 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-white cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#D4C4A8] text-black hover:bg-[#c3b296] cursor-pointer"
              >
                Appliquer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
