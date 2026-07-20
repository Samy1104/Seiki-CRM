import React from 'react';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

interface ProspectionSettingsTabProps {
  dailyQuota: number;
  followup1Days: number;
  followup2Days: number;
  archiveAfter: number;
  onDailyQuotaChange: (v: number) => void;
  onFollowup1DaysChange: (v: number) => void;
  onFollowup2DaysChange: (v: number) => void;
  onArchiveAfterChange: (v: number) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ProspectionSettingsTab: React.FC<ProspectionSettingsTabProps> = ({
  dailyQuota,
  followup1Days,
  followup2Days,
  archiveAfter,
  onDailyQuotaChange,
  onFollowup1DaysChange,
  onFollowup2DaysChange,
  onArchiveAfterChange,
  onSubmit,
}) => (
  <div className="rounded-surface border border-line bg-elevated p-5">
    <div className="mb-3.5 text-sm font-bold text-ink">Quota d'envoi et relances</div>

    <form onSubmit={onSubmit}>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Quota d'envoi quotidien">
          <input type="number" value={dailyQuota} onChange={(e) => onDailyQuotaChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
          <span className="text-[10px] text-ink-faint">
            Limite Resend : ne pas dépasser {dailyQuota} emails envoyés par jour.
          </span>
        </Field>

        <Field label="Délai avant 1ère relance (jours)">
          <input type="number" value={followup1Days} onChange={(e) => onFollowup1DaysChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
        </Field>

        <Field label="Délai avant 2ème relance (jours)">
          <input type="number" value={followup2Days} onChange={(e) => onFollowup2DaysChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
        </Field>

        <Field label="Relances avant archivage">
          <input type="number" value={archiveAfter} onChange={(e) => onArchiveAfterChange(parseInt(e.target.value) || 1)} min={1} className={inputClass} />
        </Field>
      </div>

      <Button type="submit" variant="primary">Enregistrer les paramètres</Button>
    </form>
  </div>
);
