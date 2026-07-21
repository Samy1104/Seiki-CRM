import React from 'react';
import { AtSign, Trash2, Loader2 } from 'lucide-react';
import type { TagEntry } from '../../services/contentService';
import { Button } from '../../components/ui/Button';

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
    <div
      className="space-y-4 p-6 rounded-2xl border border-[var(--border-subtle)]"
      style={{ background: 'var(--bg-panel)' }}
    >
      <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <AtSign size={16} className="text-[var(--gold)]" /> Comptes tagués
      </h2>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
        Ajoute un alias une fois (nom + URN LinkedIn), puis tape @alias dans le post pour l'insérer.
        Pour trouver l'URN : si tu administres la page, le numéro est dans l'URL d'admin
        (<code>linkedin.com/company/ID/admin/</code>) → <code>urn:li:organization:ID</code>. Sinon, ouvre la page publique et cherche "urn:li:organization:" dans le code source (Ctrl+U).
      </p>

      {tagBook.length > 0 && (
        <div className="space-y-2">
          {tagBook.map((t) => (
            <div
              key={t.alias}
              className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-[var(--border-subtle)] bg-black/20"
            >
              <div className="min-w-0 flex items-center gap-2 text-xs">
                <span className="font-semibold text-[var(--gold)]">@{t.alias}</span>
                <span className="text-[var(--text-primary)] truncate font-medium">{t.name}</span>
                <span className="text-xs truncate text-[var(--text-muted)]">{t.urn}</span>
              </div>
              <button
                onClick={() => onDeleteTag(t.alias)}
                className="shrink-0 text-[var(--text-muted)] hover:text-rose-400 transition-colors cursor-pointer"
                title="Supprimer l'alias"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-end pt-2">
        <div>
          <label className="block text-xs mb-1 text-[var(--text-secondary)]">Alias</label>
          <input
            value={newTagAlias}
            onChange={(e) => setNewTagAlias(e.target.value)}
            placeholder="Lyon"
            className="rounded-xl p-2 text-xs bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none w-[110px]"
          />
        </div>
        <div>
          <label className="block text-xs mb-1 text-[var(--text-secondary)]">Nom affiché</label>
          <input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Ville de Lyon"
            className="rounded-xl p-2 text-xs bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none w-[180px]"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs mb-1 text-[var(--text-secondary)]">URN LinkedIn</label>
          <input
            value={newTagUrn}
            onChange={(e) => setNewTagUrn(e.target.value)}
            placeholder="urn:li:organization:12345"
            className="w-full rounded-xl p-2 text-xs bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
          />
        </div>
        <Button
          onClick={onAddTag}
          disabled={savingTag}
          className="bg-[var(--gold)] text-black font-semibold hover:bg-[var(--gold)]/90"
        >
          {savingTag ? <Loader2 size={14} className="animate-spin" /> : 'Ajouter'}
        </Button>
      </div>
    </div>
  );
};
