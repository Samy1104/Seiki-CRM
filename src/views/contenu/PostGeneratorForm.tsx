import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { ContentVoice, ContentLanguage } from '../../services/contentService';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

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
    <div className="space-y-5 p-6 rounded-surface border border-line-strong bg-surface shadow-hover">
      <div className="flex items-center gap-2 pb-3 border-b border-line-strong">
        <Sparkles size={15} className="text-amber" />
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

      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div className="flex gap-4 flex-wrap items-center">
          <Field label="Voix">
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value as ContentVoice)}
              className={`${inputClass} py-2 px-3 text-xs w-auto cursor-pointer`}
            >
              <option value="seiki" className="bg-surface text-ink">Seiki (entreprise)</option>
              <option value="jaafar" className="bg-surface text-ink">Jaafar (personnel)</option>
            </select>
          </Field>

          <Field label="Langue">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as ContentLanguage)}
              className={`${inputClass} py-2 px-3 text-xs w-auto cursor-pointer`}
            >
              <option value="fr" className="bg-surface text-ink">Français</option>
              <option value="en" className="bg-surface text-ink">English</option>
            </select>
          </Field>
        </div>

        <Button
          variant="primary"
          onClick={onGenerate}
          disabled={loading}
          className="uppercase tracking-wider text-xs"
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
