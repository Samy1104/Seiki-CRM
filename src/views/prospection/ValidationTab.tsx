import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Send, Loader2 } from 'lucide-react';
import { emailsService, type GeneratedEmail } from '../../services/emailsService';
import { settingsService } from '../../services/settingsService';
import { EmailPreviewCard } from './EmailPreviewCard';
import { AccentButton } from '../../components/ui/AccentButton';

interface ValidationTabProps {
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}

export const ValidationTab: React.FC<ValidationTabProps> = ({ showToast }) => {
  const [drafts, setDrafts] = useState<GeneratedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const [quota, setQuota] = useState<number | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await emailsService.getGeneratedEmails(['draft', 'failed']);
      setDrafts(data);
    } catch {
      showToast('Erreur chargement de la file de validation', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  useEffect(() => {
    settingsService.getProspectionSettings().then((s) => setQuota(s.daily_send_quota));
  }, []);

  const handleFlush = async () => {
    setFlushing(true);
    try {
      const result = await emailsService.flushSendQueue();
      if (result.skipped) {
        showToast(`Rien à envoyer : ${result.skipped}`, 'info');
      } else {
        showToast(`${result.sent}/${result.processed} emails envoyés`, result.failed > 0 ? 'info' : 'success');
      }
      loadDrafts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi du lot', 'error');
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-line-strong">
        <h2 className="text-xs font-display font-semibold tracking-[0.25em] uppercase text-ink">
          File de validation
        </h2>
        <AccentButton
          variant="primary"
          onClick={handleFlush}
          disabled={flushing}
          icon={
            flushing ? (
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            ) : (
              <Send size={14} strokeWidth={2} />
            )
          }
        >
          {flushing ? 'Envoi...' : `Envoyer le lot du jour ${quota !== null ? `(quota: ${quota}/j)` : ''}`}
        </AccentButton>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm font-ui text-ink-soft flex items-center justify-center gap-2">
          <Loader2 size={18} strokeWidth={2} className="animate-spin text-[#D4C4A8]" /> Chargement...
        </div>
      ) : drafts.length === 0 ? (
        <div className="p-8 rounded-surface border border-line-strong bg-surface text-center font-ui space-y-2">
          <Mail size={32} strokeWidth={1.5} className="mx-auto text-ink-faint opacity-50" />
          <p className="text-sm text-ink-soft max-w-md mx-auto">
            Aucun email en attente ou en échec — tout lead ajouté avec un email génère automatiquement son 1er mail ici.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((email) => (
            <EmailPreviewCard
              key={email.id}
              email={email}
              showToast={showToast}
              onUpdate={() => setDrafts((prev) => prev.filter((e) => e.id !== email.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
};
