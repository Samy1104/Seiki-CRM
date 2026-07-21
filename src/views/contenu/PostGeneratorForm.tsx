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
      className="space-y-5 p-6 rounded-2xl border border-[var(--border-subtle)] shadow-lg"
      style={{ background: 'var(--bg-panel)' }}
    >
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-subtle)]">
        <Sparkles size={15} className="text-[var(--gold)]" />
        <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-[var(--text-primary)]">
          Nouveau brief de publication
        </h2>
      </div>

      <div>
        <label
          className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-2"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Sujet / Brief
        </label>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Ex : Nous venons de signer un partenariat avec la ville de Lyon pour mesurer les flux piétons du centre-ville..."
          rows={4}
          className="w-full rounded-xl p-3.5 text-sm bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#c8b89a] transition-all duration-200"
          style={{ resize: 'vertical', fontFamily: 'var(--font-body)' }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div className="flex gap-4 flex-wrap items-center">
          <div>
            <label
              className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-1.5"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Voix
            </label>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value as ContentVoice)}
              className="rounded-xl py-2 px-3 text-xs bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[#c8b89a] cursor-pointer transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <option value="seiki" className="bg-[var(--color-surface)]">Seiki (entreprise)</option>
              <option value="jaafar" className="bg-[var(--color-surface)]">Jaafar (personnel)</option>
            </select>
          </div>

          <div>
            <label
              className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-1.5"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Langue
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as ContentLanguage)}
              className="rounded-xl py-2 px-3 text-xs bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[#c8b89a] cursor-pointer transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <option value="fr" className="bg-[var(--color-surface)]">Français</option>
              <option value="en" className="bg-[var(--color-surface)]">English</option>
            </select>
          </div>
        </div>

        <Button
          onClick={onGenerate}
          disabled={loading}
          className="bg-[var(--gold)] text-black font-semibold text-xs tracking-wider uppercase hover:bg-[var(--gold)]/90 transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Génération...</span>
            </>
          ) : (
            <>
              <Sparkles size={15} />
              <span>Générer</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

