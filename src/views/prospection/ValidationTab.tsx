import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Send, Loader } from 'lucide-react';
import { emailsService, type GeneratedEmail } from '../../services/emailsService';
import { settingsService } from '../../services/settingsService';
import { EmailPreviewCard } from './EmailPreviewCard';

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
    <div>
      <div className="pros-section-header">
        <h2>File de validation</h2>
        <button className="btn-secondary-sm" onClick={handleFlush} disabled={flushing}>
          {flushing ? <Loader size={13} className="spin" /> : <Send size={13} />}
          Envoyer le lot du jour {quota !== null ? `(quota: ${quota}/j)` : ''}
        </button>
      </div>

      {loading ? (
        <div className="pros-loading">
          <Loader size={20} className="spin" /> Chargement...
        </div>
      ) : drafts.length === 0 ? (
        <div className="pros-empty">
          <Mail size={28} style={{ opacity: 0.4 }} />
          <p>Aucun email en attente ou en échec — tout lead ajouté avec un email génère automatiquement son 1er mail ici.</p>
        </div>
      ) : (
        <div className="gen-review-list">
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
