import { useState } from 'react';
import { linkedinService, type LinkedinAccount, type ScheduledPost } from '../services/linkedinService';
import type { LinkedInPost } from '../services/contentService';
import { useToast } from '../context/ToastContext';

export function useLinkedInAccounts() {
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<LinkedinAccount[]>([]);
  const [queue, setQueue] = useState<ScheduledPost[]>([]);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scheduling, setScheduling] = useState(false);

  const loadAccounts = () => linkedinService.listAccounts().then(setAccounts).catch(() => {});
  const loadQueue = () => linkedinService.listScheduledPosts().then(setQueue).catch(() => {});

  const handleSchedule = async (post: LinkedInPost, onSuccess: () => void) => {
    if (!targetAccountId) {
      showToast('Choisis un compte LinkedIn connecté.', 'error');
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      showToast('Choisis une date et une heure.', 'error');
      return;
    }
    setScheduling(true);
    try {
      let imagePath: string | null = null;
      if (imageFile) {
        imagePath = await linkedinService.uploadImage(imageFile);
      }
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      await linkedinService.schedulePost({
        hook: post.hook,
        corps: post.corps,
        hashtags: post.hashtags,
        imagePath,
        targetAccountId,
        scheduledAt: scheduledDateTime,
      });
      showToast('Post programmé.', 'success');
      setImageFile(null);
      setScheduledDate('');
      setScheduledTime('09:00');
      onSuccess();
      loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la programmation', 'error');
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await linkedinService.cancelScheduledPost(id);
      loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur lors de l'annulation", 'error');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await linkedinService.retryScheduledPost(id);
      loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la relance', 'error');
    }
  };

  return {
    accounts,
    queue,
    targetAccountId,
    setTargetAccountId,
    scheduledDate,
    setScheduledDate,
    scheduledTime,
    setScheduledTime,
    imageFile,
    setImageFile,
    scheduling,
    loadAccounts,
    loadQueue,
    handleSchedule,
    handleCancel,
    handleRetry,
  };
}
