import { useState } from 'react';
import { contentService, type ContentVoice, type ContentLanguage, type LinkedInPost } from '../services/contentService';
import { useToast } from '../context/ToastContext';

export function useLinkedInContent() {
  const { showToast } = useToast();

  const [brief, setBrief] = useState('');
  const [voice, setVoice] = useState<ContentVoice>('seiki');
  const [language, setLanguage] = useState<ContentLanguage>('fr');
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState<LinkedInPost | null>(null);
  const [originalPost, setOriginalPost] = useState<LinkedInPost | null>(null);
  const [copied, setCopied] = useState(false);
  const [learning, setLearning] = useState(false);

  const handleGenerate = async () => {
    if (!brief.trim()) {
      showToast('Décris le sujet du post avant de générer.', 'error');
      return;
    }
    setLoading(true);
    setCopied(false);
    try {
      const result = await contentService.generateLinkedInPost(brief, voice, language);
      setPost(result.post);
      setOriginalPost(result.post);
      if (result.validationWarnings.length > 0) {
        showToast(`Post généré avec des réserves de style : ${result.validationWarnings.join(' ')}`, 'info');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la génération', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fullText = post
    ? `${post.hook}\n\n${post.corps}\n\n${post.hashtags.map((h) => `#${h}`).join(' ')}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const postsAreEqual = (a: LinkedInPost, b: LinkedInPost) =>
    a.hook === b.hook && a.corps === b.corps && a.hashtags.join(' ') === b.hashtags.join(' ');

  const handleLearn = async () => {
    if (!post || !originalPost) return;
    if (postsAreEqual(post, originalPost)) {
      showToast('Aucune modification à apprendre.', 'info');
      return;
    }
    setLearning(true);
    try {
      await contentService.learnFromEdit(voice, originalPost, post);
      setOriginalPost(post);
      showToast('Style mis à jour à partir de tes corrections.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur lors de l'apprentissage", 'error');
    } finally {
      setLearning(false);
    }
  };

  const resetPost = () => {
    if (originalPost) {
      setPost(originalPost);
    }
  };

  return {
    brief,
    setBrief,
    voice,
    setVoice,
    language,
    setLanguage,
    loading,
    post,
    setPost,
    originalPost,
    copied,
    learning,
    fullText,
    handleGenerate,
    handleCopy,
    handleLearn,
    resetPost,
    postsAreEqual,
  };
}
