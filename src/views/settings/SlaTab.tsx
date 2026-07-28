import React from 'react';
import { AccentButton } from '../../components/ui/AccentButton';
import { Field, inputClass } from '../../components/ui/Field';
import { Save, Sparkles, Clock } from 'lucide-react';

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
  <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm max-w-4xl">
    <div className="flex items-center justify-between mb-5 pb-3 border-b border-line">
      <div>
        <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
          <Clock size={18} className="text-[#D4C4A8]" />
          Règles SLA et Automatisation
        </h2>
        <p className="text-[11px] text-ink-soft">Seuils de stagnation des leads et fonctionnalités IA</p>
      </div>
    </div>

    <form onSubmit={onSubmit}>
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field label="SLA Segment Media (jours max)">
          <input
            type="number"
            value={slaMedia}
            onChange={e => onSlaMediaChange(parseInt(e.target.value) || 1)}
            min={1}
            className={inputClass}
          />
          <span className="text-[10px] text-ink-soft mt-1 block">Alerte après {slaMedia} jours d'inactivité.</span>
        </Field>

        <Field label="SLA Segment Retail (jours max)">
          <input
            type="number"
            value={slaRetail}
            onChange={e => onSlaRetailChange(parseInt(e.target.value) || 1)}
            min={1}
            className={inputClass}
          />
          <span className="text-[10px] text-ink-soft mt-1 block">Alerte après {slaRetail} jours d'inactivité.</span>
        </Field>

        <Field label="SLA Segment Instit (jours max)">
          <input
            type="number"
            value={slaInstit}
            onChange={e => onSlaInstitChange(parseInt(e.target.value) || 1)}
            min={1}
            className={inputClass}
          />
          <span className="text-[10px] text-ink-soft mt-1 block">Alerte après {slaInstit} jours d'inactivité.</span>
        </Field>

        <div className="sm:col-span-3 mt-3 flex items-center justify-between border-t border-line pt-5 bg-surface/40 p-4 rounded-control">
          <div>
            <div className="text-[13px] font-semibold text-ink flex items-center gap-2">
              <Sparkles size={15} className="text-[#D4C4A8]" />
              Enrichissement & Scoring Automatique ICP
            </div>
            <div className="mt-0.5 text-[11px] text-ink-soft max-w-xl">
              Calculer automatiquement le score ICP et enrichir les informations lors de la création d'un prospect.
            </div>
          </div>

          <label className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={aiScoring}
              onChange={e => onAiScoringChange(e.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-hover transition-colors peer-checked:bg-[#D4C4A8]"></span>
            <span className="absolute left-0.5 h-5 w-5 rounded-full bg-[#0d0d0d] transition-transform peer-checked:translate-x-5"></span>
          </label>
        </div>
      </div>

      <AccentButton type="submit" variant="primary" icon={<Save size={14} />}>
        Enregistrer les paramètres
      </AccentButton>
    </form>
  </div>
);

