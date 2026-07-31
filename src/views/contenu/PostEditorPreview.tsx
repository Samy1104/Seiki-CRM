import React from 'react';
import { Copy, Check, GraduationCap, Loader2, PenSquare } from 'lucide-react';
import type { LinkedInPost } from '../../services/contentService';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

interface PostEditorPreviewProps {
  post: LinkedInPost;
  setPost: (p: LinkedInPost) => void;
  originalPost: LinkedInPost | null;
  copied: boolean;
  learning: boolean;
  handleCopy: () => void;
  handleLearn: () => void;
}

export const PostEditorPreview: React.FC<PostEditorPreviewProps> = ({
  post,
  setPost,
  copied,
  learning,
  handleCopy,
  handleLearn,
}) => {
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
      <Field label="Accroche (Hook)">
        <textarea
          value={post.hook}
          onChange={(e) => setPost({ ...post, hook: e.target.value })}
          rows={2}
          className={`${inputClass} resize-y`}
        />
      </Field>

      {/* Corps Textarea */}
      <Field label="Corps du post">
        <textarea
          value={post.corps}
          onChange={(e) => setPost({ ...post, corps: e.target.value })}
          rows={8}
          className={`${inputClass} resize-y`}
        />
      </Field>

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
