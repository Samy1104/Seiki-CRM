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
      className="space-y-4 p-6 rounded-2xl border border-[var(--border-subtle)] shadow-lg"
      style={{ background: 'var(--bg-panel)' }}
    >
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-subtle)]">
        <AtSign size={15} className="text-[var(--gold)]" />
        <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-[var(--text-primary)]">
          Comptes tagués (TagBook)
        </h2>
      </div>

      <p className="text-xs text-[var(--text-secondary)] leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
        Ajoutez un alias une fois (nom + URN LinkedIn), puis tapez <code className="text-[#c8b89a] font-semibold">@alias</code> dans le post pour l'insérer.
        Pour trouver l'URN : si vous administrez la page, le numéro est dans l'URL d'admin
        (<code>linkedin.com/company/ID/admin/</code>) → <code className="text-[var(--text-primary)]">urn:li:organization:ID</code>.
      </p>

      {tagBook.length > 0 && (
        <div className="space-y-2 pt-1">
          {tagBook.map((t) => (
            <div
              key={t.alias}
              className="flex items-center justify-between gap-2 p-3 rounded-xl border border-[var(--border-subtle)] bg-black/40 hover:border-[#c8b89a]/30 transition-all"
            >
              <div className="min-w-0 flex items-center gap-2 text-xs" style={{ fontFamily: 'var(--font-body)' }}>
                <span className="font-semibold text-[#c8b89a] bg-[#c8b89a]/10 px-2 py-0.5 rounded-md">
                  @{t.alias}
                </span>
                <span className="text-[var(--text-primary)] truncate font-medium">{t.name}</span>
                <span className="text-xs truncate text-[var(--text-muted)]">({t.urn})</span>
              </div>
              <button
                onClick={() => onDeleteTag(t.alias)}
                className="shrink-0 text-[var(--text-muted)] hover:text-rose-400 transition-colors cursor-pointer p-1"
                title="Supprimer l'alias"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-end pt-2 border-t border-[var(--border-subtle)] mt-2">
        <div>
          <label
            className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-1"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Alias
          </label>
          <input
            value={newTagAlias}
            onChange={(e) => setNewTagAlias(e.target.value)}
            placeholder="Lyon"
            className="rounded-xl p-2.5 text-xs bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[#c8b89a] transition-all w-[110px]"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        </div>
        <div>
          <label
            className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-1"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Nom affiché
          </label>
          <input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Ville de Lyon"
            className="rounded-xl p-2.5 text-xs bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[#c8b89a] transition-all w-[180px]"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label
            className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-1"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            URN LinkedIn
          </label>
          <input
            value={newTagUrn}
            onChange={(e) => setNewTagUrn(e.target.value)}
            placeholder="urn:li:organization:12345"
            className="w-full rounded-xl p-2.5 text-xs bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[#c8b89a] transition-all"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        </div>
        <Button
          onClick={onAddTag}
          disabled={savingTag}
          className="bg-[var(--gold)] text-black font-semibold text-xs tracking-wider uppercase hover:bg-[var(--gold)]/90 transition-all px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
        >
          {savingTag ? <Loader2 size={14} className="animate-spin" /> : 'Ajouter'}
        </Button>
      </div>
    </div>
  );
};

