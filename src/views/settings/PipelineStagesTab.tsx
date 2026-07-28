import React from 'react';
import type { PipelineStage } from '../../services/settingsService';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { AccentButton } from '../../components/ui/AccentButton';
import { Badge } from '../../components/ui/Badge';
import { Field, inputClass } from '../../components/ui/Field';

interface PipelineStagesTabProps {
  stages: PipelineStage[];
  newStageName: string;
  newStageColor: string;
  newStageIsWon: boolean;
  onNameChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onIsWonChange: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: (id: string) => void;
}

export const PipelineStagesTab: React.FC<PipelineStagesTabProps> = ({
  stages,
  newStageName,
  newStageColor,
  newStageIsWon,
  onNameChange,
  onColorChange,
  onIsWonChange,
  onSubmit,
  onDelete,
}) => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
    {/* Stages sequence list */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Processus commercial</h2>
          <p className="text-[11px] text-ink-soft">Étapes configurées dans le pipeline kanban</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#D4C4A8]/15 text-[#D4C4A8] border border-line-focus">
          {stages.length} étapes
        </span>
      </div>

      <div className="space-y-3">
        {stages.map((st) => (
          <div
            key={st.id}
            className="flex items-center justify-between p-3.5 rounded-control border border-line bg-surface/60 transition-all hover:border-line-strong"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-hover text-xs font-bold text-[#D4C4A8] border border-line">
                #{st.position}
              </span>
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5 rounded-full shadow-sm shrink-0" style={{ background: st.color }} />
                <span className="font-semibold text-ink text-sm">{st.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {st.is_closed_won ? (
                <Badge tone="success">
                  <CheckCircle2 size={12} className="mr-1 inline" /> Gagné
                </Badge>
              ) : (
                <Badge tone="neutral">Actif</Badge>
              )}
              <button
                type="button"
                className="p-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                onClick={() => onDelete(st.id)}
                disabled={st.is_closed_won}
                title="Supprimer l'étape"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Create Stage Card */}
    <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm">
      <div className="mb-4 pb-3 border-b border-line">
        <h2 className="font-display text-base font-bold text-ink">Ajouter une étape</h2>
        <p className="text-[11px] text-ink-soft">Créer une nouvelle étape dans le tunnel de vente</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Nom de l'étape *">
          <input
            type="text"
            placeholder="ex : Négociation"
            value={newStageName}
            onChange={e => onNameChange(e.target.value)}
            required
            className={inputClass}
          />
        </Field>

        <Field label="Couleur d'identification">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={newStageColor}
              onChange={e => onColorChange(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-control border border-line-strong bg-base p-1 shrink-0"
            />
            <span className="text-xs font-mono text-ink-soft">{newStageColor}</span>
          </div>
        </Field>

        <label className="flex items-start gap-2.5 pt-1 text-xs text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={newStageIsWon}
            onChange={e => onIsWonChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-[#D4C4A8]"
          />
          <span>Marquer comme étape finale de succès (Lead gagné)</span>
        </label>

        <AccentButton type="submit" variant="primary" icon={<Plus size={14} />} className="mt-2 w-full">
          Créer l'étape
        </AccentButton>
      </form>
    </div>
  </div>
);
