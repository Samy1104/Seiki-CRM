import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Field, inputClass } from './Field';
import { Button } from './Button';
import { Loader2, Plus } from 'lucide-react';
import { addAndPersistTag } from '../../services/linkedinTagService';
import type { TagEntry } from '../../services/contentService';

interface QuickAddTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  onTagCreated: (tag: TagEntry) => void;
}

export const QuickAddTagModal: React.FC<QuickAddTagModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  onTagCreated,
}) => {
  const [urlOrHandle, setUrlOrHandle] = useState(initialQuery);
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUrlOrHandle(initialQuery);
      setCustomName('');
      setError('');
    }
  }, [isOpen, initialQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlOrHandle.trim()) return;
    setLoading(true);
    setError('');
    try {
      const tag = await addAndPersistTag(urlOrHandle, customName);
      onTagCreated(tag);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du tag');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} header="Ajouter un compte LinkedIn à taguer">
      <form onSubmit={handleSubmit} className="p-6 space-y-4 font-ui">
        <Field label="Lien LinkedIn ou Handle (@nom)">
          <input
            value={urlOrHandle}
            onChange={(e) => setUrlOrHandle(e.target.value)}
            placeholder="https://linkedin.com/company/seiki ou @seiki"
            className={inputClass}
            required
            autoFocus
          />
        </Field>
        <Field label="Nom affiché (optionnel)">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Ex: Seiki Intelligence"
            className={inputClass}
          />
        </Field>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={loading}>
            {loading ? (
              <Loader2 className="animate-spin text-base" size={14} />
            ) : (
              <Plus size={14} />
            )}
            <span>Ajouter &amp; Taguer</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
