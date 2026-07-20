import React from 'react';
import type { PipelineStage } from '../../services/settingsService';
import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
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
  <div className="grid grid-cols-[1.5fr_1fr] gap-5">
    <div className="rounded-surface border border-line bg-elevated p-5">
      <div className="mb-3.5 text-sm font-bold text-ink">Étapes du processus commercial</div>

      <div className="overflow-hidden rounded-control border border-line">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-surface text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2.5">Position</th>
              <th className="px-3 py-2.5">Nom</th>
              <th className="px-3 py-2.5">Couleur</th>
              <th className="px-3 py-2.5">Gagné final ?</th>
              <th className="px-3 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stages.map(st => (
              <tr key={st.id} className="border-b border-line last:border-b-0">
                <td className="px-3 py-2.5 font-semibold text-ink-soft">#{st.position}</td>
                <td className="px-3 py-2.5 font-semibold text-ink">{st.name}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: st.color }}></span>
                    <span className="text-[11px] text-ink-faint">{st.color}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {st.is_closed_won ? <Badge tone="success">Gagné</Badge> : <Badge tone="neutral">Actif</Badge>}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    className="text-xs font-medium text-ink-faint transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-faint cursor-pointer"
                    onClick={() => onDelete(st.id)}
                    disabled={st.is_closed_won}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div className="rounded-surface border border-line bg-elevated p-5">
      <div className="mb-3.5 text-sm font-bold text-ink">Ajouter une étape</div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
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

        <Field label="Couleur de l'étape">
          <input
            type="color"
            value={newStageColor}
            onChange={e => onColorChange(e.target.value)}
            className="h-9 w-full cursor-pointer rounded-control border border-line-strong bg-base p-0.5"
          />
        </Field>

        <label className="flex items-center gap-2 pt-1 text-xs text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={newStageIsWon}
            onChange={e => onIsWonChange(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-amber"
          />
          Marquer comme étape finale de succès (Gagné)
        </label>

        <Button type="submit" variant="primary" className="mt-2 w-full">
          <Plus size={14} />
          Créer l'étape
        </Button>
      </form>
    </div>
  </div>
);
