import React from 'react';
import { Copy, Check, GraduationCap, Loader2, AtSign } from 'lucide-react';
import type { LinkedInPost, TagEntry } from '../../services/contentService';
import type { MentionField } from '../../hooks/useTagBook';

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
    <div
      className="p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4"
      style={{ background: 'var(--bg-panel)' }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Aperçu (éditable)</h2>
        <div className="flex gap-4">
          <button
            onClick={handleLearn}
            disabled={learning}
            className="text-xs flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
            title="Enregistre tes corrections pour améliorer les prochaines générations dans cette voix"
          >
            {learning ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={14} />}
            <span>Valider et enregistrer</span>
          </button>
          <button
            onClick={handleCopy}
            className="text-xs flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Copié' : 'Copier'}</span>
          </button>
        </div>
      </div>

      {/* Hook Textarea */}
      <div className="relative">
        <label className="block text-xs mb-1 font-medium text-[var(--text-secondary)]">Accroche (Hook)</label>
        <textarea
          ref={hookRef}
          value={post.hook}
          onChange={(e) => handleFieldChange('hook', e)}
          onBlur={() => setTimeout(() => setMention((m) => (m?.field === 'hook' ? null : m)), 150)}
          rows={2}
          className="w-full rounded-xl p-3 text-sm bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
          style={{ resize: 'vertical' }}
        />
        {mention?.field === 'hook' && mentionMatches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] overflow-hidden shadow-modal">
            {mentionMatches.map((t) => (
              <button
                key={t.alias}
                onClick={() => insertMention(t)}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors"
              >
                <AtSign size={12} className="text-[var(--gold)]" />
                <span className="font-semibold text-[var(--gold)]">@{t.alias}</span>
                <span className="text-xs text-[var(--text-secondary)]">{t.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Corps Textarea */}
      <div className="relative">
        <label className="block text-xs mb-1 font-medium text-[var(--text-secondary)]">Corps du post</label>
        <textarea
          ref={corpsRef}
          value={post.corps}
          onChange={(e) => handleFieldChange('corps', e)}
          onBlur={() => setTimeout(() => setMention((m) => (m?.field === 'corps' ? null : m)), 150)}
          rows={8}
          className="w-full rounded-xl p-3 text-sm bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]/50 transition-colors"
          style={{ resize: 'vertical' }}
        />
        {mention?.field === 'corps' && mentionMatches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] overflow-hidden shadow-modal">
            {mentionMatches.map((t) => (
              <button
                key={t.alias}
                onClick={() => insertMention(t)}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors"
              >
                <AtSign size={12} className="text-[var(--gold)]" />
                <span className="font-semibold text-[var(--gold)]">@{t.alias}</span>
                <span className="text-xs text-[var(--text-secondary)]">{t.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hashtags Input */}
      <div>
        <label className="block text-xs mb-1 font-medium text-[var(--text-secondary)]">Hashtags</label>
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
          className="w-full rounded-xl p-3 text-sm bg-black/20 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none"
          placeholder="#hashtag1 #hashtag2"
        />
      </div>
    </div>
  );
};
