import { useState } from 'react';
import { contentService, type TagEntry, type LinkedInPost } from '../services/contentService';
import { useToast } from '../context/ToastContext';

export type MentionField = 'hook' | 'corps';

export function useTagBook() {
  const { showToast } = useToast();

  const [tagBook, setTagBook] = useState<TagEntry[]>([]);
  const [newTagAlias, setNewTagAlias] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagUrn, setNewTagUrn] = useState('');
  const [savingTag, setSavingTag] = useState(false);
  const [mention, setMention] = useState<{ field: MentionField; query: string } | null>(null);

  const loadTagBook = () => contentService.getTagBook().then(setTagBook).catch(() => {});

  const detectMention = (field: MentionField, value: string, cursor: number) => {
    const uptoCursor = value.slice(0, cursor);
    const match = uptoCursor.match(/@([a-zA-Z0-9_-]*)$/);
    setMention(match ? { field, query: match[1] } : null);
  };

  const insertMention = (
    tag: TagEntry,
    post: LinkedInPost,
    setPost: (p: LinkedInPost) => void,
    fieldRefs: Record<MentionField, React.RefObject<HTMLTextAreaElement | null>>
  ) => {
    if (!post || !mention) return;
    const field = mention.field;
    const el = fieldRefs[field].current;
    const value = post[field];
    const cursor = el?.selectionStart ?? value.length;
    const uptoCursor = value.slice(0, cursor);
    const match = uptoCursor.match(/@([a-zA-Z0-9_-]*)$/);
    const start = match ? cursor - match[0].length : cursor;
    const mentionText = `@[${tag.name}](${tag.urn})`;
    const newValue = value.slice(0, start) + mentionText + ' ' + value.slice(cursor);
    setPost({ ...post, [field]: newValue });
    setMention(null);
    requestAnimationFrame(() => {
      const newCursor = start + mentionText.length + 1;
      el?.focus();
      el?.setSelectionRange(newCursor, newCursor);
    });
  };

  const mentionMatches = mention
    ? tagBook
        .filter(
          (t) =>
            t.alias.toLowerCase().includes(mention.query.toLowerCase()) ||
            t.name.toLowerCase().includes(mention.query.toLowerCase())
        )
        .slice(0, 6)
    : [];

  const handleAddTag = async () => {
    if (!newTagAlias.trim() || !newTagName.trim() || !newTagUrn.trim()) {
      showToast('Alias, nom et URN sont requis.', 'error');
      return;
    }
    if (!/^urn:li:(organization|person):.+/.test(newTagUrn.trim())) {
      showToast('URN invalide (doit commencer par urn:li:organization: ou urn:li:person:).', 'error');
      return;
    }
    if (tagBook.some((t) => t.alias.toLowerCase() === newTagAlias.trim().toLowerCase())) {
      showToast('Cet alias existe déjà.', 'error');
      return;
    }
    setSavingTag(true);
    try {
      const updated = [...tagBook, { alias: newTagAlias.trim(), name: newTagName.trim(), urn: newTagUrn.trim() }];
      await contentService.saveTagBook(updated);
      setTagBook(updated);
      setNewTagAlias('');
      setNewTagName('');
      setNewTagUrn('');
      showToast('Compte ajouté.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur lors de l'ajout", 'error');
    } finally {
      setSavingTag(false);
    }
  };

  const handleDeleteTag = async (alias: string) => {
    const updated = tagBook.filter((t) => t.alias !== alias);
    try {
      await contentService.saveTagBook(updated);
      setTagBook(updated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la suppression', 'error');
    }
  };

  return {
    tagBook,
    newTagAlias,
    setNewTagAlias,
    newTagName,
    setNewTagName,
    newTagUrn,
    setNewTagUrn,
    savingTag,
    mention,
    setMention,
    mentionMatches,
    loadTagBook,
    detectMention,
    insertMention,
    handleAddTag,
    handleDeleteTag,
  };
}
