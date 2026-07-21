import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { ContentVoice, ContentLanguage } from '../../services/contentService';
import { Button } from '../../components/ui/Button';

interface PostGeneratorFormProps {
  brief: string;
  setBrief: (b: string) => void;
  voice: ContentVoice;
  setVoice: (v: ContentVoice) => void;
  language: ContentLanguage;
  setLanguage: (l: ContentLanguage) => void;
  loading: boolean;
  onGenerate: () => void;
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
}) => {
  return (
    <div
      className="space-y-4 p-6 rounded-2xl border border-[var(--border-subtle)]"
      style={{ background: 'var(--bg-panel)' }}
    >
      <div>
        <label className="block text-sm mb-2 font-medium text-[var(--text-secondary)]">Brief</label>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Ex : Nous venons de signer un partenariat avec la ville de Lyon pour mesurer les flux piétons du centre-ville..."
          rows={4}
          className="w-full rounded-xl p-3 text-sm bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
          style={{ resize: 'vertical' }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-xs mb-1 text-[var(--text-secondary)]">Voix</label>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value as ContentVoice)}
              className="rounded-xl p-2 text-xs bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none cursor-pointer"
            >
              <option value="seiki" className="bg-[var(--color-surface)]">Seiki (entreprise)</option>
              <option value="jaafar" className="bg-[var(--color-surface)]">Jaafar (personnel)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1 text-[var(--text-secondary)]">Langue</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as ContentLanguage)}
              className="rounded-xl p-2 text-xs bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none cursor-pointer"
            >
              <option value="fr" className="bg-[var(--color-surface)]">Français</option>
              <option value="en" className="bg-[var(--color-surface)]">English</option>
            </select>
          </div>
        </div>

        <Button
          onClick={onGenerate}
          disabled={loading}
          className="bg-[var(--gold)] text-black font-semibold hover:bg-[var(--gold)]/90"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Génération...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Générer</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
