import React, { useRef, useState } from 'react';
import { Download, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { AccentButton } from '../../components/ui/AccentButton';
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

  const processFile = async (file: File) => {
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
      console.error('Error reading/validating the import file:', err);
      showToast(err instanceof Error ? err.message : 'Erreur lors de la lecture du fichier', 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const summary = await leadImportService.commitImport(toCreate, toUpdate);
      if (summary.error) {
        console.error('Bulk import commit failed mid-loop:', summary.error);
        showToast(
          `Import interrompu après ${summary.created} création(s) et ${summary.updated} mise(s) à jour — vérifiez le pipeline avant de réessayer.`,
          'error'
        );
        handleReset();
        return;
      }
      setResult(summary);
      setStep('done');
    } catch (err) {
      console.error('Unexpected error during import:', err);
      showToast(
        "Une erreur inattendue s'est produite lors de l'import. Veuillez réessayer.",
        'error'
      );
      handleReset();
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
    <div className="flex flex-col gap-6 rounded-overlay border border-line-strong bg-surface p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h3 className="font-display text-base font-bold text-ink">Import en masse</h3>
          <p className="text-xs text-ink-soft">
            Téléchargez le modèle standardisé, complétez vos données et importez votre fichier ci-dessous.
          </p>
        </div>
        <a href="/templates/leads-import-template.xlsx" download>
          <Button variant="secondary" size="sm">
            <Download size={14} />
            Télécharger le modèle
          </Button>
        </a>
      </div>

      {step === 'select' && (
        <div className="flex flex-col gap-3">
          <label
            htmlFor="bulk-import-file"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="group flex cursor-pointer flex-col items-center gap-3 rounded-overlay border-2 border-dashed border-line-strong bg-elevated/40 px-6 py-12 text-center transition-all duration-200 hover:border-beige hover:bg-elevated"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-line shadow-xs group-hover:scale-105 transition-transform duration-200">
              <FileSpreadsheet size={24} className="text-beige" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">
                Glissez votre fichier ici ou <span className="text-beige underline">parcourez</span>
              </p>
              <p className="mt-1 text-xs text-ink-soft">Formats supportés : .xlsx</p>
            </div>
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
        </div>
      )}

      {step === 'preview' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-control border border-line bg-elevated p-3 text-center">
              <span className="block text-xl font-bold text-success">{toCreate.length}</span>
              <span className="text-xs text-ink-soft">Lead(s) prêt(s) à être créé(s)</span>
            </div>
            <div className="rounded-control border border-line bg-elevated p-3 text-center">
              <span className="block text-xl font-bold text-amber">{toUpdate.length}</span>
              <span className="text-xs text-ink-soft">Lead(s) existant(s) mis à jour</span>
            </div>
            <div className="rounded-control border border-line bg-elevated p-3 text-center">
              <span className="block text-xl font-bold text-danger">{errors.length}</span>
              <span className="text-xs text-ink-soft">Erreur(s)</span>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-ink">Détail des erreurs :</span>
              <ul className="max-h-40 overflow-y-auto rounded-control border border-line bg-elevated p-3 text-xs text-danger flex flex-col gap-1.5">
                {errors.map((err) => (
                  <li key={err.rowNumber} className="flex items-center gap-2">
                    <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold">
                      Ligne {err.rowNumber}
                    </span>
                    <span>{err.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <AccentButton variant="secondary" onClick={handleReset}>
              Annuler
            </AccentButton>
            <AccentButton
              variant="primary"
              onClick={handleConfirm}
              disabled={loading || (toCreate.length === 0 && toUpdate.length === 0)}
            >
              Confirmer l'import
            </AccentButton>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success border border-success/20">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h4 className="text-base font-bold text-ink">Import terminé avec succès !</h4>
            <p className="mt-1 text-sm text-ink-soft">
              {result.created} lead(s) créé(s), {result.updated} mis à jour
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <AccentButton variant="secondary" onClick={handleReset}>
              Importer un autre fichier
            </AccentButton>
            <AccentButton variant="primary" onClick={() => setView('pipeline')}>
              Voir le pipeline
            </AccentButton>
          </div>
        </div>
      )}
    </div>
  );
};
