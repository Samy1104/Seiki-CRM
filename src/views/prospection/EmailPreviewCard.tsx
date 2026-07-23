import React, { useState } from 'react';
import { Mail, ChevronDown, ChevronUp, AlertTriangle, Zap, Check, Send, Edit3, Trash2, Loader2 } from 'lucide-react';
import { emailsService, type GeneratedEmail } from '../../services/emailsService';
import { confirmAction } from '../../utils/confirmAction';
import { AccentButton } from '../../components/ui/AccentButton';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

interface EmailPreviewCardProps {
  email: GeneratedEmail;
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
  onUpdate: () => void;
}

export const EmailPreviewCard: React.FC<EmailPreviewCardProps> = ({ email, showToast, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCorps, setEditedCorps] = useState(email.corps_du_mail);
  const [editedSujet, setEditedSujet] = useState(email.sujet);

  const handleApproveAndSend = async () => {
    setIsSending(true);
    try {
      const { scheduledAt } = await emailsService.approveAndSchedule(email.id);
      const scheduledDate = new Date(scheduledAt);
      const isToday = scheduledDate.toDateString() === new Date().toDateString();

      if (!isToday) {
        showToast(
          `Quota du jour atteint — email planifié pour le ${scheduledDate.toLocaleDateString('fr-FR')}`,
          'info'
        );
        onUpdate();
        return;
      }

      try {
        await emailsService.sendEmail(email.id);
        showToast(`Email envoyé à ${email.lead?.contact_name || 'le prospect'} !`, 'success');
        onUpdate();
      } catch (sendErr) {
        try {
          await emailsService.updateGeneratedEmail(email.id, { statut_envoi: 'draft' });
        } catch (rollbackErr) {
          console.error('Rollback to draft failed after send failure:', rollbackErr);
          showToast(
            "Échec d'envoi ET du retour en brouillon — cet email est bloqué en statut 'approuvé', contactez un admin",
            'error'
          );
        }
        throw sendErr;
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await emailsService.updateGeneratedEmail(email.id, {
        sujet: editedSujet,
        corps_du_mail: editedCorps,
      });
      showToast('Email modifié', 'success');
      setIsEditing(false);
    } catch {
      showToast('Erreur sauvegarde', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmAction('Supprimer cet email généré ?')) return;
    try {
      await emailsService.deleteGeneratedEmail(email.id);
      onUpdate();
    } catch {
      showToast('Erreur suppression', 'error');
    }
  };

  return (
    <div className="rounded-surface border border-line-strong bg-surface overflow-hidden transition-all shadow-hover mb-3">
      <div
        className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-hover transition-colors font-ui"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Mail size={16} strokeWidth={2} className="text-[#D4C4A8] shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <strong className="text-ink font-semibold">{email.lead?.contact_name || '—'}</strong>
              {email.lead?.company_name && (
                <span className="text-xs text-ink-soft bg-base px-2 py-0.5 rounded-control border border-line-strong">
                  {email.lead.company_name}
                </span>
              )}
              {email.lead?.poste && (
                <span className="text-xs text-ink-faint truncate">({email.lead.poste})</span>
              )}
            </div>
            <div className="text-xs text-ink-soft truncate mt-0.5">
              {email.sujet}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {email.statut_envoi === 'failed' && (
            <span className="text-xs text-danger font-semibold bg-danger/10 px-2.5 py-1 rounded-control border border-danger/20 flex items-center gap-1">
              <AlertTriangle size={12} strokeWidth={2} /> Échec d'envoi
            </span>
          )}
          <div className="text-ink-faint">
            {expanded ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-4 border-t border-line-strong bg-base space-y-4 font-ui">
          {email.icebreaker && (
            <div className="p-3 rounded-control border border-line-focus bg-[#D4C4A8]/10 text-xs text-ink flex items-center gap-2">
              <Zap size={14} strokeWidth={2} className="text-[#D4C4A8] shrink-0" />
              <span><strong>Icebreaker :</strong> {email.icebreaker}</span>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-4">
              <Field label="Sujet">
                <input
                  className={inputClass}
                  value={editedSujet}
                  onChange={(e) => setEditedSujet(e.target.value)}
                />
              </Field>
              <Field label="Corps">
                <textarea
                  className={`${inputClass} resize-y`}
                  rows={8}
                  value={editedCorps}
                  onChange={(e) => setEditedCorps(e.target.value)}
                />
              </Field>
              <div className="flex items-center gap-2 pt-1">
                <AccentButton
                  variant="primary"
                  onClick={handleSaveEdit}
                  icon={<Check size={14} strokeWidth={2.5} />}
                >
                  Sauvegarder
                </AccentButton>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-ink-soft whitespace-pre-line leading-relaxed bg-surface p-4 rounded-control border border-line-strong">
              {email.corps_du_mail}
            </div>
          )}

          {!isEditing && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <AccentButton
                variant="primary"
                onClick={handleApproveAndSend}
                disabled={isSending}
                icon={
                  isSending ? (
                    <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <Send size={14} strokeWidth={2} />
                  )
                }
              >
                {isSending ? 'Envoi...' : email.statut_envoi === 'failed' ? 'Réessayer l\'envoi' : 'Approuver & Envoyer'}
              </AccentButton>
              <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                <Edit3 size={13} strokeWidth={2} className="text-[#D4C4A8]" /> Modifier
              </Button>
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 size={13} strokeWidth={2} /> Supprimer
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
