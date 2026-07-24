import React, { useState } from 'react';
import { Copy, Check, GraduationCap, Loader2, PenSquare, AtSign } from 'lucide-react';
import type { LinkedInPost, TagEntry } from '../../services/contentService';
import type { MentionField } from '../../hooks/useTagBook';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';
import { TagAutoCompleteCombobox } from '../../components/ui/TagAutoCompleteCombobox';
import { QuickAddTagModal } from '../../components/ui/QuickAddTagModal';
import { formatPostForLinkedIn, formatPostForCleanDisplay } from '../../utils/linkedinMentionFormatter';
import { useToast } from '../../context/ToastContext';

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
  tagBook?: TagEntry[];
  onTagAdded?: (tag: TagEntry) => void;
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
  tagBook,
  onTagAdded,
}) => {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddQuery, setQuickAddQuery] = useState('');
  const [copiedWithLinkedInTags, setCopiedWithLinkedInTags] = useState(false);
  const { showToast } = useToast();

  const handleFieldChange = (field: MentionField, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPost({ ...post, [field]: value });
    detectMention(field, value, e.target.selectionStart ?? value.length);
  };

  const handleOpenQuickAdd = (query: string) => {
    setQuickAddQuery(query);
    setIsQuickAddOpen(true);
  };

  const handleTagCreated = (newTag: TagEntry) => {
    onTagAdded?.(newTag);
    insertMention(newTag);
  };

  const activeTagBook = tagBook && tagBook.length > 0 ? tagBook : mentionMatches;

  const handleCopyLinkedInFormat = () => {
    const formattedHook = formatPostForLinkedIn(post.hook, activeTagBook);
    const formattedCorps = formatPostForLinkedIn(post.corps, activeTagBook);
    const formattedHashtags = post.hashtags.map((h) => `#${h}`).join(' ');
    const fullTextWithTags = `${formattedHook}\n\n${formattedCorps}${
      formattedHashtags ? `\n\n${formattedHashtags}` : ''
    }`;

    navigator.clipboard.writeText(fullTextWithTags).catch(() => {});
    setCopiedWithLinkedInTags(true);
    showToast('Post copié avec les balises de tags LinkedIn !', 'success');
    setTimeout(() => setCopiedWithLinkedInTags(false), 2000);
  };

  return (
    <div className="p-6 rounded-surface border border-line-strong bg-surface space-y-5 shadow-hover">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-line-strong">
        <div className="flex items-center gap-2">
          <PenSquare size={15} strokeWidth={2} className="text-[#D4C4A8]" />
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
              <Loader2 size={13} strokeWidth={2} className="animate-spin text-[#D4C4A8]" />
            ) : (
              <GraduationCap size={13} strokeWidth={2} className="text-[#D4C4A8]" />
            )}
            <span>Valider &amp; apprendre</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyLinkedInFormat}
            title="Copier le post au format de mention officiel LinkedIn @[Nom](urn:li:...)"
          >
            {copiedWithLinkedInTags ? (
              <Check size={13} strokeWidth={2.5} className="text-success" />
            ) : (
              <AtSign size={13} strokeWidth={2} className="text-[#D4C4A8]" />
            )}
            <span>{copiedWithLinkedInTags ? 'Copié !' : 'Copier avec tags LinkedIn'}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
          >
            {copied ? (
              <Check size={13} strokeWidth={2.5} className="text-success" />
            ) : (
              <Copy size={13} strokeWidth={2} className="text-[#D4C4A8]" />
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
            onBlur={() => setTimeout(() => setMention((m) => (m?.field === 'hook' ? null : m)), 200)}
            rows={2}
            className={`${inputClass} resize-y`}
          />
        </Field>
        {mention?.field === 'hook' && (
          <TagAutoCompleteCombobox
            filterQuery={mention.query}
            tagBook={activeTagBook}
            onSelectTag={(tag) => insertMention(tag)}
            onOpenQuickAdd={handleOpenQuickAdd}
          />
        )}
      </div>

      {/* Corps Textarea */}
      <div className="relative">
        <Field label="Corps du post">
          <textarea
            ref={corpsRef}
            value={post.corps}
            onChange={(e) => handleFieldChange('corps', e)}
            onBlur={() => setTimeout(() => setMention((m) => (m?.field === 'corps' ? null : m)), 200)}
            rows={8}
            className={`${inputClass} resize-y`}
          />
        </Field>
        {mention?.field === 'corps' && (
          <TagAutoCompleteCombobox
            filterQuery={mention.query}
            tagBook={activeTagBook}
            onSelectTag={(tag) => insertMention(tag)}
            onOpenQuickAdd={handleOpenQuickAdd}
          />
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

      {/* LinkedIn Tagging Info Box */}
      <div className="p-3 rounded-control border border-[#D4C4A8]/30 bg-[#D4C4A8]/10 text-ink text-xs font-ui space-y-1">
        <p className="font-semibold text-[#D4C4A8] flex items-center gap-1.5">
          <AtSign size={13} /> Astuce pour le tag bleu sur LinkedIn :
        </p>
        <p className="text-ink-soft leading-relaxed">
          • <strong>Publication via API (Buffer/Zapier/Seiki API)</strong> : Utilisez <code className="text-[#D4C4A8] font-semibold">Copier avec tags LinkedIn</code> — les balises URN <code className="text-ink font-mono text-[11px]">@[Nom](urn:li:...)</code> créent automatiquement le tag bleu interactif.<br/>
          • <strong>Collage manuel sur LinkedIn.com</strong> : Collez le post, puis effacez et retapez le <code className="text-[#D4C4A8] font-semibold">@</code> devant le nom. LinkedIn affichera immédiatement le menu bleu pour cliquer et valider le tag en 1 clic !
        </p>
      </div>

      {/* On-the-Fly Quick Add Tag Modal */}
      <QuickAddTagModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        initialQuery={quickAddQuery}
        onTagCreated={handleTagCreated}
      />
    </div>
  );
};
