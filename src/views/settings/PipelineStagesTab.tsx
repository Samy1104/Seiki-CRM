import React, { useState, useRef } from 'react';
import type { PipelineStage } from '../../services/settingsService';
import { Plus, Trash2, Edit2, CheckCircle2, XCircle, Save, X, Palette, ChevronUp, ChevronDown } from 'lucide-react';
import { AccentButton } from '../../components/ui/AccentButton';
import { Badge } from '../../components/ui/Badge';
import { Field, inputClass } from '../../components/ui/Field';
import { ColorModal } from '../../components/ColorModal';

interface PipelineStagesTabProps {
  stages: PipelineStage[];
  editingStageId: string | null;
  newStageName: string;
  newStageColor: string;
  newStageIsWon: boolean;
  newStageIsLost: boolean;
  onNameChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onIsWonChange: (v: boolean) => void;
  onIsLostChange: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onStartEdit: (stage: PipelineStage) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onMoveStage?: (id: string, direction: 'up' | 'down') => void;
}

export const PipelineStagesTab: React.FC<PipelineStagesTabProps> = ({
  stages,
  editingStageId,
  newStageName,
  newStageColor,
  newStageIsWon,
  newStageIsLost,
  onNameChange,
  onColorChange,
  onIsWonChange,
  onIsLostChange,
  onSubmit,
  onStartEdit,
  onCancelEdit,
  onDelete,
  onMoveStage,
}) => {
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const colorAnchorRef = useRef<HTMLButtonElement>(null);

  return (
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
          {stages.map((st, index) => (
            <div
              key={st.id}
              className="flex items-center justify-between p-3.5 rounded-control border border-line bg-surface/60 transition-all hover:border-line-strong"
            >
              <div className="flex items-center gap-3">
                {/* Reorder Up/Down arrows */}
                {onMoveStage && (
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => onMoveStage(st.id, 'up')}
                      className="p-0.5 text-ink-soft hover:text-ink hover:bg-hover rounded transition-colors disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                      title="Monter l'étape"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={index === stages.length - 1}
                      onClick={() => onMoveStage(st.id, 'down')}
                      className="p-0.5 text-ink-soft hover:text-ink hover:bg-hover rounded transition-colors disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                      title="Descendre l'étape"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                )}
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-hover text-xs font-bold text-[#D4C4A8] border border-line shrink-0">
                  #{st.position}
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="h-3.5 w-3.5 rounded-full shadow-sm shrink-0" style={{ background: st.color }} />
                  <span className="font-semibold text-ink text-sm">{st.name}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {st.is_closed_won ? (
                  <Badge tone="success">
                    <CheckCircle2 size={12} className="mr-1 inline" /> Gagné
                  </Badge>
                ) : st.is_closed_lost ? (
                  <Badge tone="danger">
                    <XCircle size={12} className="mr-1 inline" /> Perdu
                  </Badge>
                ) : (
                  <Badge tone="neutral">Actif</Badge>
                )}
                <button
                  type="button"
                  className="p-1.5 text-ink-soft transition-colors hover:bg-hover hover:text-ink rounded-control cursor-pointer"
                  onClick={() => onStartEdit(st)}
                  title="Modifier l'étape"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  type="button"
                  className="p-1.5 text-ink-soft transition-colors hover:bg-danger/10 hover:text-danger rounded-control disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
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

      {/* Form Card */}
      <div className="rounded-surface border border-line bg-elevated p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="mb-4 pb-3 border-b border-line">
            <h2 className="font-display text-base font-bold text-ink">
              {editingStageId ? "Modifier l'étape" : "Ajouter une étape"}
            </h2>
            <p className="text-[11px] text-ink-soft">
              {editingStageId ? "Mettre à jour les paramètres de l'étape" : "Créer une nouvelle étape dans le tunnel de vente"}
            </p>
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
              <div className="relative">
                <button
                  ref={colorAnchorRef}
                  type="button"
                  onClick={() => setColorModalOpen(true)}
                  className="flex items-center justify-between w-full h-9 px-3 rounded-control border border-line-strong bg-surface hover:bg-hover transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-4 w-4 rounded-full shadow-sm shrink-0 border border-white/20" style={{ background: newStageColor }} />
                    <span className="text-xs font-mono font-medium text-ink">{newStageColor}</span>
                  </div>
                  <Palette size={14} className="text-ink-soft" />
                </button>

                {colorModalOpen && (
                  <ColorModal
                    value={newStageColor}
                    onChange={(hex) => onColorChange(hex)}
                    onClose={() => setColorModalOpen(false)}
                    anchorRef={colorAnchorRef}
                  />
                )}
              </div>
            </Field>

            <label className="flex items-start gap-2.5 pt-1 text-xs text-ink cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newStageIsWon}
                onChange={e => {
                  onIsWonChange(e.target.checked);
                  if (e.target.checked) onIsLostChange(false);
                }}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#D4C4A8]"
              />
              <span>Marquer comme étape finale de succès (Lead gagné)</span>
            </label>

            <label className="flex items-start gap-2.5 pt-1 text-xs text-ink cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newStageIsLost}
                onChange={e => {
                  onIsLostChange(e.target.checked);
                  if (e.target.checked) onIsWonChange(false);
                }}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#D4C4A8]"
              />
              <span>Marquer comme étape de perte (Lead perdu & archivé)</span>
            </label>

            <div className="mt-2 flex gap-2">
              <AccentButton type="submit" variant="primary" icon={editingStageId ? <Save size={14} /> : <Plus size={14} />} className="flex-1">
                {editingStageId ? 'Enregistrer' : "Créer l'étape"}
              </AccentButton>
              {editingStageId && (
                <AccentButton type="button" variant="secondary" icon={<X size={14} />} onClick={onCancelEdit}>
                  Annuler
                </AccentButton>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
