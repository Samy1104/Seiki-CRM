import React from 'react';
import type { PipelineStage } from '../../services/settingsService';
import { Plus } from 'lucide-react';

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
  <div className="two-col" style={{ gap: '20px' }}>
    {/* Stage List */}
    <div className="card" style={{ padding: '20px', flex: '1.5' }}>
      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-h)', marginBottom: '14px' }}>
        Étapes du processus commercial
      </div>

      <div className="leads-table-container">
        <table className="leads-table">
          <thead>
            <tr>
              <th>Position</th>
              <th>Nom</th>
              <th>Couleur</th>
              <th>Gagné final ?</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {stages.map(st => (
              <tr key={st.id}>
                <td style={{ fontWeight: '600' }}>#{st.position}</td>
                <td style={{ fontWeight: '600', color: 'var(--text-h)' }}>{st.name}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: st.color }}></span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{st.color}</span>
                  </div>
                </td>
                <td>
                  {st.is_closed_won ? (
                    <span className="badge badge-success" style={{ fontSize: '9px' }}>Gagné</span>
                  ) : (
                    <span className="badge badge-neutral" style={{ fontSize: '9px' }}>Actif</span>
                  )}
                </td>
                <td>
                  <button
                    className="hist-btn del"
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

    {/* Add Stage Form */}
    <div className="card" style={{ padding: '20px', flex: '1' }}>
      <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-h)', marginBottom: '14px' }}>
        Ajouter une étape
      </div>

      <form onSubmit={onSubmit}>
        <div className="form-field" style={{ marginBottom: '12px' }}>
          <div className="field-label">Nom de l'étape *</div>
          <input
            type="text"
            placeholder="ex : Négociation"
            value={newStageName}
            onChange={e => onNameChange(e.target.value)}
            required
          />
        </div>

        <div className="form-field" style={{ marginBottom: '12px' }}>
          <div className="field-label">Couleur de l'étape</div>
          <input
            type="color"
            value={newStageColor}
            onChange={e => onColorChange(e.target.value)}
            style={{ height: '36px', padding: '2px', cursor: 'pointer' }}
          />
        </div>

        <div className="form-field" style={{ marginBottom: '20px', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
          <input
            type="checkbox"
            id="stage-won"
            checked={newStageIsWon}
            onChange={e => onIsWonChange(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="stage-won" style={{ fontSize: '12px', color: 'var(--text-h)', cursor: 'pointer', userSelect: 'none' }}>
            Marquer comme étape finale de succès (Gagné)
          </label>
        </div>

        <button type="submit" className="btn btn-grad" style={{ width: '100%' }}>
          <Plus size={14} style={{ marginRight: '4px' }} />
          Créer l'étape
        </button>
      </form>
    </div>
  </div>
);
