import React from 'react';

interface SlaTabProps {
  slaMedia: number;
  slaRetail: number;
  slaInstit: number;
  aiScoring: boolean;
  onSlaMediaChange: (v: number) => void;
  onSlaRetailChange: (v: number) => void;
  onSlaInstitChange: (v: number) => void;
  onAiScoringChange: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const SlaTab: React.FC<SlaTabProps> = ({
  slaMedia,
  slaRetail,
  slaInstit,
  aiScoring,
  onSlaMediaChange,
  onSlaRetailChange,
  onSlaInstitChange,
  onAiScoringChange,
  onSubmit,
}) => (
  <div className="card" style={{ padding: '20px' }}>
    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-h)', marginBottom: '14px' }}>
      Règles SLA et automatisation
    </div>

    <form onSubmit={onSubmit}>
      <div className="form-grid" style={{ marginBottom: '24px' }}>
        {/* Media SLA */}
        <div className="form-field">
          <div className="field-label">SLA Segment Media (jours maximum)</div>
          <input
            type="number"
            value={slaMedia}
            onChange={e => onSlaMediaChange(parseInt(e.target.value) || 1)}
            min={1}
          />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Alerte déclenchée si un lead du segment Media stagne plus de {slaMedia} jours dans la même étape.
          </span>
        </div>

        {/* Retail SLA */}
        <div className="form-field">
          <div className="field-label">SLA Segment Retail (jours maximum)</div>
          <input
            type="number"
            value={slaRetail}
            onChange={e => onSlaRetailChange(parseInt(e.target.value) || 1)}
            min={1}
          />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Alerte déclenchée si un lead du segment Retail stagne plus de {slaRetail} jours.
          </span>
        </div>

        {/* Instit SLA */}
        <div className="form-field">
          <div className="field-label">SLA Segment Instit (jours maximum)</div>
          <input
            type="number"
            value={slaInstit}
            onChange={e => onSlaInstitChange(parseInt(e.target.value) || 1)}
            min={1}
          />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Alerte déclenchée si un lead du segment Instit stagne plus de {slaInstit} jours.
          </span>
        </div>

        {/* AI Auto scoring */}
        <div className="form-field" style={{ gridColumn: 'span 2', marginTop: '10px', borderTop: '0.5px solid var(--border)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: '600', color: 'var(--text-h)', fontSize: '13px' }}>Enrichissement et scoring automatique</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Calculer automatiquement le score ICP et préremplir les critères à la création d'un lead (via données d'enrichissement mail/domaine).
              </div>
            </div>

            {/* Custom Toggle Switch */}
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={aiScoring}
                onChange={e => onAiScoringChange(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <button type="submit" className="btn btn-grad">
        Enregistrer les paramètres
      </button>
    </form>
  </div>
);
