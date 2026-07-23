import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { ContentVoice, ContentLanguage } from '../../services/contentService';
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
        <Sparkles size={15} strokeWidth={2} className="text-amber" />
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
