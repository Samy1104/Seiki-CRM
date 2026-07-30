import React, { useRef, useState } from 'react';
import { Download, Upload, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import {
  leadImportService,
  type NewLeadRow,
  type UpdateLeadRow,
  type RowError,
} from '../../services/leadImportService';

type Step = 'select' | 'preview' | 'done';

interface BulkImportPanelProps {
  setView: (view: string) => void;
}

export const BulkImportPanel: React.FC<BulkImportPanelProps> = ({ setView }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('select');
  const [loading, setLoading] = useState(false);
  const [toCreate, setToCreate] = useState<NewLeadRow[]>([]);
  const [toUpdate, setToUpdate] = useState<UpdateLeadRow[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const rows = await leadImportService.parseFile(file);
      const [existingByEmail, prospectStageId] = await Promise.all([
        leadImportService.fetchExistingLeadsByEmail(),
        leadImportService.getProspectStageId(),
      ]);
      const validation = leadImportService.validateRows(rows, existingByEmail, prospectStageId);
      setToCreate(validation.toCreate);
      setToUpdate(validation.toUpdate);
      setErrors(validation.errors);
      setStep('preview');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la lecture du fichier', 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const summary = await leadImportService.commitImport(toCreate, toUpdate);
      if (summary.error) {
        showToast(
          `Import interrompu après ${summary.created} création(s) et ${summary.updated} mise(s) à jour — vérifiez le pipeline avant de réessayer.`,
          'error'
        );
        handleReset();
        return;
      }
      setResult(summary);
      setStep('done');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setToCreate([]);
    setToUpdate([]);
    setErrors([]);
    setResult(null);
    setStep('select');
  };

  return (
    <div className="flex flex-col gap-5 rounded-overlay border border-line-strong bg-surface p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-bold text-ink">Import en masse</h3>
          <p className="text-xs text-ink-soft">Téléchargez le modèle, remplissez-le, puis importez-le ici.</p>
        </div>
        <a
          href="/templates/leads-import-template.xlsx"
          download
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber hover:underline"
        >
          <Download size={14} />
          Télécharger le modèle
        </a>
      </div>

      {step === 'select' && (
        <label
          htmlFor="bulk-import-file"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-control border border-dashed border-line-strong px-6 py-10 text-center text-ink-soft hover:border-amber/60"
        >
          <Upload size={20} />
          <span className="text-sm">Importer un fichier (.xlsx)</span>
          <input
            id="bulk-import-file"
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleFileChange}
            disabled={loading}
          />
        </label>
      )}

      {step === 'preview' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm text-ink">
            <span>{toCreate.length} lead(s) prêt(s) à être créé(s)</span>
            <span>{toUpdate.length} lead(s) existant(s) sera(ont) mis à jour</span>
            <span>{errors.length} erreur(s)</span>
          </div>

          {errors.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-control border border-line bg-elevated p-3 text-xs text-danger">
              {errors.map((err) => (
                <li key={err.rowNumber}>
                  Ligne {err.rowNumber} : {err.reason}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleReset}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={loading || (toCreate.length === 0 && toUpdate.length === 0)}
            >
              Confirmer l'import
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 size={28} className="text-success" />
          <p className="text-sm text-ink">
            {result.created} lead(s) créé(s), {result.updated} mis à jour
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleReset}>
              Importer un autre fichier
            </Button>
            <Button variant="primary" onClick={() => setView('pipeline')}>
              Voir le pipeline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
