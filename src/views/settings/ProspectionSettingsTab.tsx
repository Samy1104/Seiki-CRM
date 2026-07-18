import React from 'react';

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
  <div className="card" style={{ padding: '20px' }}>
    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' }}>
      Quota d'envoi et relances
    </div>

    <form onSubmit={onSubmit}>
      <div className="form-grid" style={{ marginBottom: '24px' }}>
        <div className="form-field">
          <div className="field-label">Quota d'envoi quotidien</div>
          <input type="number" value={dailyQuota} onChange={(e) => onDailyQuotaChange(parseInt(e.target.value) || 1)} min={1} />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Limite Resend : ne pas dépasser {dailyQuota} emails envoyés par jour.
          </span>
        </div>

        <div className="form-field">
          <div className="field-label">Délai avant 1ère relance (jours)</div>
          <input type="number" value={followup1Days} onChange={(e) => onFollowup1DaysChange(parseInt(e.target.value) || 1)} min={1} />
        </div>

        <div className="form-field">
          <div className="field-label">Délai avant 2ème relance (jours)</div>
          <input type="number" value={followup2Days} onChange={(e) => onFollowup2DaysChange(parseInt(e.target.value) || 1)} min={1} />
        </div>

        <div className="form-field">
          <div className="field-label">Relances avant archivage</div>
          <input type="number" value={archiveAfter} onChange={(e) => onArchiveAfterChange(parseInt(e.target.value) || 1)} min={1} />
        </div>
      </div>

      <button type="submit" className="btn btn-grad">Enregistrer les paramètres</button>
    </form>
  </div>
);
