import React from 'react';
import { AtSign, Trash2, Loader2, Plus } from 'lucide-react';
import type { TagEntry } from '../../services/contentService';
import { AccentButton } from '../../components/ui/AccentButton';
import { Field, inputClass } from '../../components/ui/Field';

interface TagBookPanelProps {
  tagBook: TagEntry[];
  newTagAlias: string;
  setNewTagAlias: (v: string) => void;
  newTagName: string;
  setNewTagName: (v: string) => void;
  newTagUrn: string;
  setNewTagUrn: (v: string) => void;
  savingTag: boolean;
  onAddTag: () => void;
  onDeleteTag: (alias: string) => void;
}

export const TagBookPanel: React.FC<TagBookPanelProps> = ({
  tagBook,
  newTagAlias,
  setNewTagAlias,
  newTagName,
  setNewTagName,
  newTagUrn,
  setNewTagUrn,
  savingTag,
  onAddTag,
  onDeleteTag,
}) => {
  return (
    <div className="space-y-4 p-6 rounded-surface border border-line-strong bg-surface shadow-hover">
      <div className="flex items-center gap-2 pb-3 border-b border-line-strong">
        <AtSign size={15} strokeWidth={2} className="text-[#D4C4A8]" />
        <h2 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
          Comptes tagués (TagBook)
        </h2>
      </div>

      <p className="text-xs font-ui text-ink-soft leading-relaxed">
        Ajoutez un alias une fois (nom + URN LinkedIn), puis tapez <code className="text-[#D4C4A8] font-semibold">@alias</code> dans le post pour l'insérer.
        Pour trouver l'URN : si vous administrez la page, le numéro est dans l'URL d'admin
        (<code>linkedin.com/company/ID/admin/</code>) → <code className="text-ink">urn:li:organization:ID</code>.
      </p>

      {tagBook.length > 0 && (
        <div className="space-y-2 pt-1">
          {tagBook.map((t) => (
            <div
              key={t.alias}
              className="flex items-center justify-between gap-2 p-3 rounded-control border border-line-strong bg-base hover:border-line-focus transition-all"
            >
              <div className="min-w-0 flex items-center gap-2 text-xs font-ui">
                <span className="font-semibold text-[#D4C4A8] bg-[#D4C4A8]/10 border border-line-focus px-2 py-0.5 rounded-control">
                  @{t.alias}
                </span>
                <span className="text-ink truncate font-medium">{t.name}</span>
                <span className="text-xs truncate text-ink-faint">({t.urn})</span>
              </div>
              <button
                onClick={() => onDeleteTag(t.alias)}
                className="shrink-0 text-ink-faint hover:text-danger transition-colors cursor-pointer p-1"
                title="Supprimer l'alias"
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-end pt-2 border-t border-line-strong mt-2">
        <Field label="Alias">
          <input
            value={newTagAlias}
            onChange={(e) => setNewTagAlias(e.target.value)}
            placeholder="Lyon"
            className={`${inputClass} py-2 px-3 text-xs w-[110px]`}
          />
        </Field>
        <Field label="Nom affiché">
          <input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Ville de Lyon"
            className={`${inputClass} py-2 px-3 text-xs w-[180px]`}
          />
        </Field>
        <Field label="URN LinkedIn" className="flex-1 min-w-[200px]">
          <input
            value={newTagUrn}
            onChange={(e) => setNewTagUrn(e.target.value)}
            placeholder="urn:li:organization:12345"
            className={`${inputClass} py-2 px-3 text-xs`}
          />
        </Field>
        <AccentButton
          variant="primary"
          onClick={onAddTag}
          disabled={savingTag}
          icon={
            savingTag ? (
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            ) : (
              <Plus size={14} strokeWidth={2.5} />
            )
          }
        >
          {savingTag ? 'Enregistrement...' : 'Ajouter'}
        </AccentButton>
      </div>
    </div>
  );
};
