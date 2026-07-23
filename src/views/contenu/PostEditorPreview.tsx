import React from 'react';
import { Copy, Check, GraduationCap, Loader2, AtSign, PenSquare } from 'lucide-react';
import type { LinkedInPost, TagEntry } from '../../services/contentService';
import type { MentionField } from '../../hooks/useTagBook';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

interface PostEditorPreviewProps {
  post: LinkedInPost;
  setPost: (p: LinkedInPost) => void;
  originalPost: LinkedInPost | null;
  copied: boolean;
  learning: boolean;
  mention: { field: MentionField; query: string } | null;
  setMention: React.Dispatch<React.SetStateAction<{ field: MentionField; query: string } | null>>;
  mentionMatches: TagEntry[];
  hookRef: React.RefObject<HTMLTextAreaElement | null>;
  corpsRef: React.RefObject<HTMLTextAreaElement | null>;
  detectMention: (field: MentionField, value: string, cursor: number) => void;
  insertMention: (tag: TagEntry) => void;
  handleCopy: () => void;
  handleLearn: () => void;
}

export const PostEditorPreview: React.FC<PostEditorPreviewProps> = ({
  post,
  setPost,
  copied,
  learning,
  mention,
  setMention,
  mentionMatches,
  hookRef,
  corpsRef,
  detectMention,
  insertMention,
  handleCopy,
  handleLearn,
}) => {
  const handleFieldChange = (field: MentionField, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPost({ ...post, [field]: value });
    detectMention(field, value, e.target.selectionStart ?? value.length);
  };

  return (
    <div className="p-6 rounded-surface border border-line-strong bg-surface space-y-5 shadow-hover">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-line-strong">
        <div className="flex items-center gap-2">
          <PenSquare size={15} strokeWidth={2} className="text-amber" />
          <h2 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
            Aperçu &amp; Éditeur en direct
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap font-ui">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLearn}
            disabled={learning}
            title="Enregistre vos corrections pour améliorer les prochaines générations"
          >
            {learning ? (
              <Loader2 size={13} strokeWidth={2} className="animate-spin text-amber" />
            ) : (
              <GraduationCap size={13} strokeWidth={2} className="text-amber" />
            )}
            <span>Valider &amp; apprendre</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
          >
            {copied ? (
              <Check size={13} strokeWidth={2.5} className="text-success" />
            ) : (
              <Copy size={13} strokeWidth={2} className="text-amber" />
            )}
            <span>{copied ? 'Copié !' : 'Copier'}</span>
          </Button>
        </div>
      </div>

      {/* Hook Textarea */}
      <div className="relative">
        <Field label="Accroche (Hook)">
          <textarea
            ref={hookRef}
            value={post.hook}
            onChange={(e) => handleFieldChange('hook', e)}
            onBlur={() => setTimeout(() => setMention((m) => (m?.field === 'hook' ? null : m)), 150)}
            rows={2}
            className={`${inputClass} resize-y`}
          />
        </Field>
        {mention?.field === 'hook' && mentionMatches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-overlay border border-line-focus bg-elevated overflow-hidden shadow-modal">
            {mentionMatches.map((t) => (
              <button
                key={t.alias}
                onClick={() => insertMention(t)}
                className="w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2 hover:bg-hover text-ink transition-colors border-b border-line-strong last:border-none cursor-pointer"
              >
                <AtSign size={13} strokeWidth={2} className="text-amber" />
                <span className="font-semibold text-amber">@{t.alias}</span>
                <span className="text-xs text-ink-soft">({t.name})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Corps Textarea */}
      <div className="relative">
        <Field label="Corps du post">
          <textarea
            ref={corpsRef}
            value={post.corps}
            onChange={(e) => handleFieldChange('corps', e)}
            onBlur={() => setTimeout(() => setMention((m) => (m?.field === 'corps' ? null : m)), 150)}
            rows={8}
            className={`${inputClass} resize-y`}
          />
        </Field>
        {mention?.field === 'corps' && mentionMatches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-overlay border border-line-focus bg-elevated overflow-hidden shadow-modal">
            {mentionMatches.map((t) => (
              <button
                key={t.alias}
                onClick={() => insertMention(t)}
                className="w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2 hover:bg-hover text-ink transition-colors border-b border-line-strong last:border-none cursor-pointer"
              >
                <AtSign size={13} strokeWidth={2} className="text-amber" />
                <span className="font-semibold text-amber">@{t.alias}</span>
                <span className="text-xs text-ink-soft">({t.name})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hashtags Input */}
      <Field label="Hashtags">
        <input
          value={post.hashtags.map((h) => `#${h}`).join(' ')}
          onChange={(e) =>
            setPost({
              ...post,
              hashtags: e.target.value
                .split(/\s+/)
                .filter(Boolean)
                .map((h) => h.replace(/^#/, '')),
            })
          }
          className={inputClass}
          placeholder="#hashtag1 #hashtag2"
        />
      </Field>
    </div>
  );
};
