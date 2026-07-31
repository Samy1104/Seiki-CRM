import React, { useState } from 'react';
import { Download, Calendar, Check } from 'lucide-react';
import { PageTitle } from '../../components/ui/PageTitle';
import { AccentButton } from '../../components/ui/AccentButton';
import { Modal } from '../../components/ui/Modal';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';
import type { PeriodPreset } from '../../utils/dashboardCalculations';
import type { CodirMeeting } from '../../services/settingsService';

export interface DashboardHeaderProps {
  preset: PeriodPreset;
  setPreset: (p: PeriodPreset) => void;
  customRange: { start: string; end: string };
  setCustomRange: (r: { start: string; end: string }) => void;
  codirMeetings: CodirMeeting[];
  onValidateCodir: () => Promise<void>;
  onExportCsv: () => void;
}

const PRESET_LABELS: Record<PeriodPreset, string> = {
  since_last_codir: 'Depuis le dernier CODIR',
  last_two_codirs: 'Entre les 2 derniers CODIR',
  month: 'Mois en cours',
  quarter: 'Trimestre en cours',
  year: 'Année en cours',
  custom: 'Période personnalisée',
};

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  preset,
  setPreset,
  customRange,
  setCustomRange,
  codirMeetings,
  onValidateCodir,
  onExportCsv,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [validating, setValidating] = useState(false);

  const handleConfirmValidate = async () => {
    setValidating(true);
    try {
      await onValidateCodir();
    } finally {
      setValidating(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageTitle>Dashboard</PageTitle>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <AccentButton variant="secondary" icon={<Check size={14} />} onClick={() => setConfirmOpen(true)}>
            Valider le CODIR du jour
          </AccentButton>
          <AccentButton variant="primary" icon={<Download size={14} />} onClick={onExportCsv}>
            Exporter CSV
          </AccentButton>
        </div>
      </div>

      <div className="bg-[#141414] border border-line rounded-xl px-3.5 py-2.5">
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4C4A8]" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f2ede4]">Période</span>
          </div>

          <Select value={preset} onValueChange={(val) => setPreset(val as PeriodPreset)}>
            <SelectTrigger id="dashboard-period-preset" aria-label="Période" className="w-[210px] text-xs h-8">
              <SelectValue placeholder="Choisir une période" />
            </SelectTrigger>
            <SelectContent side="bottom">
              {(Object.keys(PRESET_LABELS) as PeriodPreset[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PRESET_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <div>
                <label htmlFor="dashboard-custom-start" className="sr-only">Début</label>
                <input
                  id="dashboard-custom-start"
                  aria-label="Début"
                  type="date"
                  value={customRange.start}
                  onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                  className="bg-[#1e1e1e] border border-line rounded-md px-2 py-1 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                />
              </div>
              <div>
                <label htmlFor="dashboard-custom-end" className="sr-only">Fin</label>
                <input
                  id="dashboard-custom-end"
                  aria-label="Fin"
                  type="date"
                  value={customRange.end}
                  onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                  className="bg-[#1e1e1e] border border-line rounded-md px-2 py-1 text-xs text-[#f2ede4] focus:outline-none focus:border-[#D4C4A8]"
                />
              </div>
            </div>
          )}

          <span className="text-[11px] text-ink-soft ml-auto">
            {codirMeetings.length} réunion{codirMeetings.length > 1 ? 's' : ''} CODIR enregistrée{codirMeetings.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} header="Confirmer l'enregistrement du CODIR">
        <div className="p-6 space-y-4">
          <p className="text-sm text-ink-soft">
            Cette action enregistre la date et l'heure actuelles comme nouvelle réunion CODIR de référence pour les prochains calculs de delta.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-ink-soft hover:text-[#f2ede4] transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <AccentButton variant="primary" onClick={handleConfirmValidate} disabled={validating}>
              {validating ? 'Enregistrement...' : 'Confirmer'}
            </AccentButton>
          </div>
        </div>
      </Modal>
    </div>
  );
};
