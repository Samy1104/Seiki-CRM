import React from 'react';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

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
  <div className="rounded-surface border border-line bg-elevated p-5">
    <div className="mb-3.5 text-sm font-bold text-ink">Règles SLA et automatisation</div>

    <form onSubmit={onSubmit}>
      <div className="mb-6 grid grid-cols-2 gap-4">
        <Field label="SLA Segment Media (jours maximum)">
          <input
            type="number"
            value={slaMedia}
            onChange={e => onSlaMediaChange(parseInt(e.target.value) || 1)}
            min={1}
            className={inputClass}
          />
          <span className="text-[10px] text-ink-faint">
            Alerte déclenchée si un lead du segment Media stagne plus de {slaMedia} jours dans la même étape.
          </span>
        </Field>

        <Field label="SLA Segment Retail (jours maximum)">
          <input
            type="number"
            value={slaRetail}
            onChange={e => onSlaRetailChange(parseInt(e.target.value) || 1)}
            min={1}
            className={inputClass}
          />
          <span className="text-[10px] text-ink-faint">
            Alerte déclenchée si un lead du segment Retail stagne plus de {slaRetail} jours.
          </span>
        </Field>

        <Field label="SLA Segment Instit (jours maximum)">
          <input
            type="number"
            value={slaInstit}
            onChange={e => onSlaInstitChange(parseInt(e.target.value) || 1)}
            min={1}
            className={inputClass}
          />
          <span className="text-[10px] text-ink-faint">
            Alerte déclenchée si un lead du segment Instit stagne plus de {slaInstit} jours.
          </span>
        </Field>

        <div className="col-span-2 mt-2 flex items-center justify-between border-t border-line pt-4">
          <div>
            <div className="text-[13px] font-semibold text-ink">Enrichissement et scoring automatique</div>
            <div className="mt-0.5 text-[11px] text-ink-faint">
              Calculer automatiquement le score ICP et préremplir les critères à la création d'un lead (via données d'enrichissement mail/domaine).
            </div>
          </div>

          <label className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={aiScoring}
              onChange={e => onAiScoringChange(e.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-hover transition-colors peer-checked:bg-amber"></span>
            <span className="absolute left-0.5 h-5 w-5 rounded-full bg-ink transition-transform peer-checked:translate-x-5"></span>
          </label>
        </div>
      </div>

      <Button type="submit" variant="primary">Enregistrer les paramètres</Button>
    </form>
  </div>
);
