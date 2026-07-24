import React from 'react';
import { AtSign, Plus } from 'lucide-react';
import type { TagEntry } from '../../services/contentService';

interface TagAutoCompleteComboboxProps {
  filterQuery: string;
  tagBook: TagEntry[];
  onSelectTag: (tag: TagEntry) => void;
  onOpenQuickAdd: (query: string) => void;
  position?: { top?: number; left?: number };
  className?: string;
}

export const TagAutoCompleteCombobox: React.FC<TagAutoCompleteComboboxProps> = ({
  filterQuery,
  tagBook,
  onSelectTag,
  onOpenQuickAdd,
  position,
  className = '',
}) => {
  const filtered = tagBook.filter(
    (t) =>
      t.alias.toLowerCase().includes(filterQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div
      style={position ? { top: position.top, left: position.left } : undefined}
      className={`z-30 min-w-[240px] max-h-[220px] overflow-y-auto bg-surface border border-line-strong rounded-overlay shadow-modal p-1.5 text-xs font-ui ${
        position ? 'absolute' : 'w-full mt-1'
      } ${className}`}
    >
      <div className="px-2.5 py-1 text-ink-faint font-semibold uppercase tracking-wider text-[10px] flex items-center justify-between">
        <span>Taguer un compte</span>
        {filtered.length > 0 && <span className="text-[10px]">{filtered.length} trouvé(s)</span>}
      </div>

      {filtered.length > 0 ? (
        filtered.map((tag) => (
          <button
            key={tag.alias}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelectTag(tag);
            }}
            className="w-full text-left px-2.5 py-2 rounded-control hover:bg-hover flex items-center justify-between gap-2 transition-colors cursor-pointer"
          >
            <span className="font-medium text-ink flex items-center gap-1.5 truncate">
              <AtSign size={13} className="text-[#D4C4A8] shrink-0" />
              <span className="truncate">{tag.name}</span>
            </span>
            <span className="text-[10px] text-ink-soft shrink-0">@{tag.alias}</span>
          </button>
        ))
      ) : (
        <div className="px-2.5 py-1.5 text-ink-soft text-xs italic">
          Aucun compte existant pour "{filterQuery}"
        </div>
      )}

      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onOpenQuickAdd(filterQuery);
        }}
        className="w-full text-left px-2.5 py-2 rounded-control hover:bg-[#D4C4A8]/10 text-[#D4C4A8] font-semibold flex items-center gap-1.5 border-t border-line-strong mt-1 cursor-pointer transition-colors"
      >
        <Plus size={13} />
        <span>Nouveau compte "{filterQuery || 'URL'}"</span>
      </button>
    </div>
  );
};
