import React, { useState } from 'react';
import { Download, Calendar, ArrowRightLeft, ChevronDown } from 'lucide-react';
import { PageTitle } from '../../components/ui/PageTitle';
import { AccentButton } from '../../components/ui/AccentButton';
import { SegmentedToggle } from '../../components/ui/SegmentedToggle';

export interface DashboardHeaderProps {
  codirDates: string[];
  comparisonMode: 'codir' | 'custom';
  setComparisonMode: (mode: 'codir' | 'custom') => void;
  selectedCodirA: string;
  setSelectedCodirA: (d: string) => void;
  selectedCodirB: string;
  setSelectedCodirB: (d: string) => void;
  customDateA: { start: string; end: string };
  setCustomDateA: (dates: { start: string; end: string }) => void;
  customDateB: { start: string; end: string };
  setCustomDateB: (dates: { start: string; end: string }) => void;
  onExportCsv: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  codirDates,
  comparisonMode,
  setComparisonMode,
  selectedCodirA,
  setSelectedCodirA,
  selectedCodirB,
  setSelectedCodirB,
  customDateA,
  setCustomDateA,
  customDateB,
  setCustomDateB,
  onExportCsv,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const effectiveCodirDates = codirDates.length > 0 ? codirDates : [todayIso, thirtyDaysAgoIso];

  return (
    <div className="mb-6 space-y-4">
      {/* Top Bar: Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageTitle>Dashboard</PageTitle>

        <AccentButton
          variant="primary"
          icon={<Download size={14} />}
          onClick={onExportCsv}
          className="self-start sm:self-auto"
        >
          Exporter CSV
        </AccentButton>
      </div>

      {/* Comparative Period Controls Card (Collapsible) */}
      <div className="bg-[#141414] border border-line rounded-2xl p-4 space-y-4 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line/60 pb-3">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2 text-sm font-bold text-[#f2ede4] hover:text-[#D4C4A8] transition-colors cursor-pointer text-left"
          >
            <ChevronDown className={`w-4 h-4 text-[#D4C4A8] transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
            <Calendar className="w-4.5 h-4.5 text-[#D4C4A8]" />
            <span className="text-sm font-bold tracking-tight">Mode de Comparaison temporelle</span>
          </button>

          {/* SegmentedToggle Component */}
          <SegmentedToggle<'codir' | 'custom'>
            value={comparisonMode}
            onChange={setComparisonMode}
            options={[
              {
                value: 'codir',
                label: 'Comparaison CODIR',
                icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
              },
              {
                value: 'custom',
                label: 'Périodes Personnalisées',
                icon: <Calendar className="w-3.5 h-3.5" />,
              },
            ]}
          />
        </div>

        {/* Collapsible Content */}
        {!isCollapsed && (
          <div className="pt-1 transition-all">
            {comparisonMode === 'codir' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-soft mb-1">
                    CODIR Actuel (Période A)
                  </label>
                  <select
                    value={selectedCodirA}
                    onChange={(e) => setSelectedCodirA(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-line rounded-lg px-3 py-2 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                  >
                    {effectiveCodirDates.map((date) => (
                      <option key={`a-${date}`} value={date}>
                        Réunion CODIR du {date} {codirDates.length === 0 ? '(Par défaut)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-soft mb-1">
                    CODIR Référence (Période B)
                  </label>
                  <select
                    value={selectedCodirB}
                    onChange={(e) => setSelectedCodirB(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-line rounded-lg px-3 py-2 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                  >
                    {effectiveCodirDates.map((date) => (
                      <option key={`b-${date}`} value={date}>
                        Réunion CODIR du {date} {codirDates.length === 0 ? '(Par défaut)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Custom Date Range A */}
                <div className="space-y-2 bg-[#1e1e1e]/60 border border-line/80 rounded-xl p-3">
                  <span className="text-xs font-bold text-[#D4C4A8] block">Période Actuelle (A)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-ink-soft mb-0.5">Début</label>
                      <input
                        type="date"
                        value={customDateA.start}
                        onChange={(e) => setCustomDateA({ ...customDateA, start: e.target.value })}
                        className="w-full bg-[#1e1e1e] border border-line rounded-lg px-2.5 py-1.5 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-ink-soft mb-0.5">Fin</label>
                      <input
                        type="date"
                        value={customDateA.end}
                        onChange={(e) => setCustomDateA({ ...customDateA, end: e.target.value })}
                        className="w-full bg-[#1e1e1e] border border-line rounded-lg px-2.5 py-1.5 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Date Range B */}
                <div className="space-y-2 bg-[#1e1e1e]/60 border border-line/80 rounded-xl p-3">
                  <span className="text-xs font-bold text-ink-soft block">Période de Référence (B)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-ink-soft mb-0.5">Début</label>
                      <input
                        type="date"
                        value={customDateB.start}
                        onChange={(e) => setCustomDateB({ ...customDateB, start: e.target.value })}
                        className="w-full bg-[#1e1e1e] border border-line rounded-lg px-2.5 py-1.5 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-ink-soft mb-0.5">Fin</label>
                      <input
                        type="date"
                        value={customDateB.end}
                        onChange={(e) => setCustomDateB({ ...customDateB, end: e.target.value })}
                        className="w-full bg-[#1e1e1e] border border-line rounded-lg px-2.5 py-1.5 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
