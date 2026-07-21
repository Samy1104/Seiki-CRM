import React from 'react';
import { Copy, Check, GraduationCap, Loader2, AtSign, PenSquare } from 'lucide-react';
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
      className="p-6 rounded-2xl border border-[var(--border-subtle)] space-y-5 shadow-lg"
      style={{ background: 'var(--bg-panel)' }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <PenSquare size={15} className="text-[var(--gold)]" />
          <h2 className="text-xs font-semibold tracking-[0.25em] uppercase text-[var(--text-primary)]">
            Aperçu &amp; Éditeur en direct
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap" style={{ fontFamily: 'var(--font-body)' }}>
          <button
            onClick={handleLearn}
            disabled={learning}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-black/30 hover:border-[#c8b89a]/40 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50"
            title="Enregistre vos corrections pour améliorer les prochaines générations"
          >
            {learning ? <Loader2 size={13} className="animate-spin text-[var(--gold)]" /> : <GraduationCap size={13} className="text-[#c8b89a]" />}
            <span>Valider &amp; apprendre</span>
          </button>
          <button
            onClick={handleCopy}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-black/30 hover:border-[#c8b89a]/40 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} className="text-[#c8b89a]" />}
            <span>{copied ? 'Copié !' : 'Copier'}</span>
          </button>
        </div>
      </div>

      {/* Hook Textarea */}
      <div className="relative">
        <label
          className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-1.5"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Accroche (Hook)
        </label>
        <textarea
          ref={hookRef}
          value={post.hook}
          onChange={(e) => handleFieldChange('hook', e)}
          onBlur={() => setTimeout(() => setMention((m) => (m?.field === 'hook' ? null : m)), 150)}
          rows={2}
          className="w-full rounded-xl p-3.5 text-sm bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[#c8b89a] transition-all duration-200"
          style={{ resize: 'vertical', fontFamily: 'var(--font-body)' }}
        />
        {mention?.field === 'hook' && mentionMatches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-[#c8b89a]/40 bg-[var(--bg-panel)] overflow-hidden shadow-modal">
            {mentionMatches.map((t) => (
              <button
                key={t.alias}
                onClick={() => insertMention(t)}
                className="w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors border-b border-[var(--border-subtle)] last:border-none"
              >
                <AtSign size={13} className="text-[var(--gold)]" />
                <span className="font-semibold text-[#c8b89a]">@{t.alias}</span>
                <span className="text-xs text-[var(--text-secondary)]">({t.name})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Corps Textarea */}
      <div className="relative">
        <label
          className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-1.5"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Corps du post
        </label>
        <textarea
          ref={corpsRef}
          value={post.corps}
          onChange={(e) => handleFieldChange('corps', e)}
          onBlur={() => setTimeout(() => setMention((m) => (m?.field === 'corps' ? null : m)), 150)}
          rows={8}
          className="w-full rounded-xl p-3.5 text-sm bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[#c8b89a] transition-all duration-200"
          style={{ resize: 'vertical', fontFamily: 'var(--font-body)' }}
        />
        {mention?.field === 'corps' && mentionMatches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-[#c8b89a]/40 bg-[var(--bg-panel)] overflow-hidden shadow-modal">
            {mentionMatches.map((t) => (
              <button
                key={t.alias}
                onClick={() => insertMention(t)}
                className="w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2 hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition-colors border-b border-[var(--border-subtle)] last:border-none"
              >
                <AtSign size={13} className="text-[var(--gold)]" />
                <span className="font-semibold text-[#c8b89a]">@{t.alias}</span>
                <span className="text-xs text-[var(--text-secondary)]">({t.name})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hashtags Input */}
      <div>
        <label
          className="block text-[11px] font-medium tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-1.5"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Hashtags
        </label>
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
          className="w-full rounded-xl p-3 text-sm bg-black/40 border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[#c8b89a] transition-all duration-200"
          style={{ fontFamily: 'var(--font-body)' }}
          placeholder="#hashtag1 #hashtag2"
        />
      </div>
    </div>
  );
};

