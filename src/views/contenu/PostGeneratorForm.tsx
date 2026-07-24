import React, { useState } from 'react';
import { Sparkles, Loader2, AtSign, Plus, Check, X } from 'lucide-react';
import type { ContentVoice, ContentLanguage, TagEntry } from '../../services/contentService';
import { addAndPersistTag } from '../../services/linkedinTagService';
import { AccentButton } from '../../components/ui/AccentButton';
import { Field, inputClass } from '../../components/ui/Field';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';

interface PostGeneratorFormProps {
  brief: string;
  setBrief: (b: string) => void;
  voice: ContentVoice;
  setVoice: (v: ContentVoice) => void;
  language: ContentLanguage;
  setLanguage: (l: ContentLanguage) => void;
  loading: boolean;
  onGenerate: () => void;
  tagBook?: TagEntry[];
  selectedTags?: TagEntry[];
  setSelectedTags?: (tags: TagEntry[]) => void;
  onTagAdded?: (tag: TagEntry) => void;
}

export const PostGeneratorForm: React.FC<PostGeneratorFormProps> = ({
  brief,
  setBrief,
  voice,
  setVoice,
  language,
  setLanguage,
  loading,
  onGenerate,
  tagBook = [],
  selectedTags = [],
  setSelectedTags,
  onTagAdded,
}) => {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddUrl, setQuickAddUrl] = useState('');
  const [quickAddName, setQuickAddName] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');

  const handleToggleTag = (tag: TagEntry) => {
    if (!setSelectedTags) return;
    const exists = selectedTags.some((t) => t.alias === tag.alias);
    if (exists) {
      setSelectedTags(selectedTags.filter((t) => t.alias !== tag.alias));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddUrl.trim()) return;

    setAddingTag(true);
    setQuickAddError('');

    try {
      const newTag = await addAndPersistTag(quickAddUrl, quickAddName);
      if (setSelectedTags) {
        const exists = selectedTags.some((t) => t.alias === newTag.alias);
        if (!exists) {
          setSelectedTags([...selectedTags, newTag]);
        }
      }
      if (onTagAdded) {
        onTagAdded(newTag);
      }
      setQuickAddUrl('');
      setQuickAddName('');
      setShowQuickAdd(false);
    } catch (err: any) {
      setQuickAddError(err.message || 'Erreur lors de l’ajout du tag');
    } finally {
      setAddingTag(false);
    }
  };

  return (
    <div className="space-y-5 p-6 rounded-surface border border-line-strong bg-surface shadow-hover">
      <div className="flex items-center gap-2 pb-3 border-b border-line-strong">
        <Sparkles size={15} strokeWidth={2} className="text-[#D4C4A8]" />
        <h2 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
          Nouveau brief de publication
        </h2>
      </div>

      <Field label="Sujet / Brief">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Ex : Nous venons de signer un partenariat avec la ville de Lyon..."
          rows={4}
          className={`${inputClass} resize-y`}
        />
      </Field>

      {/* Pre-Generation Tag Selector UI */}
      <div className="space-y-2 pt-2 border-t border-line-strong">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
            <AtSign size={13} className="text-[#D4C4A8]" />
            Comptes à taguer dans le post :
          </label>
          <button
            type="button"
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className="text-[11px] text-[#D4C4A8] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus size={12} />
            Ajouter un compte LinkedIn
          </button>
        </div>

        {/* Quick Add Form */}
        {showQuickAdd && (
          <form onSubmit={handleQuickAddSubmit} className="p-3 bg-base border border-line-strong rounded-control space-y-2">
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <input
                type="text"
                value={quickAddUrl}
                onChange={(e) => setQuickAddUrl(e.target.value)}
                placeholder="Lien ou handle (ex: linkedin.com/company/seiki ou @seiki)"
                className={`${inputClass} text-xs py-1`}
                required
              />
              <input
                type="text"
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                placeholder="Nom (optionnel)"
                className={`${inputClass} text-xs py-1 w-36`}
              />
              <div className="flex items-center gap-1">
                <button
                  type="submit"
                  disabled={addingTag}
                  className="px-2.5 py-1 text-xs bg-[#D4C4A8] text-surface font-semibold rounded-control hover:opacity-90 transition-opacity flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  {addingTag ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Ajouter
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="p-1 text-ink-soft hover:text-ink cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {quickAddError && <p className="text-[11px] text-danger">{quickAddError}</p>}
          </form>
        )}

        {/* Tag Chips */}
        <div className="flex flex-wrap gap-1.5">
          {tagBook.length === 0 && !showQuickAdd && (
            <span className="text-xs text-ink-faint italic">Aucun compte enregistré pour le moment.</span>
          )}
          {tagBook.map((tag) => {
            const isSelected = selectedTags.some((t) => t.alias === tag.alias);
            return (
              <button
                key={tag.alias}
                type="button"
                onClick={() => handleToggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-control border transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#D4C4A8]/20 border-[#D4C4A8] text-ink font-medium shadow-sm'
                    : 'bg-base border-line-strong text-ink-soft hover:border-line-focus'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#D4C4A8]' : 'bg-transparent border border-ink-faint'}`} />
                @{tag.alias} ({tag.name})
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div className="flex gap-4 flex-wrap items-center">
          <Field label="Voix">
            <Select value={voice} onValueChange={(val) => setVoice(val as ContentVoice)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Choisir la voix" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seiki">Seiki (entreprise)</SelectItem>
                <SelectItem value="jaafar">Jaafar (personnel)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Langue">
            <Select value={language} onValueChange={(val) => setLanguage(val as ContentLanguage)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Choisir la langue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <AccentButton
          variant="primary"
          onClick={onGenerate}
          disabled={loading}
          icon={
            loading ? (
              <Loader2 size={15} strokeWidth={2} className="animate-spin" />
            ) : (
              <Sparkles size={15} strokeWidth={2} />
            )
          }
        >
          {loading ? 'Génération...' : 'Générer'}
        </AccentButton>
      </div>
    </div>
  );
};
