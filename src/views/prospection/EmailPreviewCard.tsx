import React, { useState } from 'react';
import { Mail, ChevronDown, ChevronUp, AlertTriangle, Zap, Check, Send, Edit3, Trash2, Loader } from 'lucide-react';
import { emailsService, type GeneratedEmail } from '../../services/emailsService';
import { confirmAction } from '../../utils/confirmAction';

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
    <div className={`email-preview-card ${expanded ? 'expanded' : ''}`}>
      <div className="epc-header" onClick={() => setExpanded((v) => !v)}>
        <div className="epc-prospect">
          <strong>{email.lead?.contact_name || '—'}</strong>
          <span className="epc-company">{email.lead?.company_name}</span>
          {email.lead?.poste && <span className="epc-poste">{email.lead.poste}</span>}
        </div>
        <div className="epc-subject">
          <Mail size={12} style={{ color: 'var(--color-amber)', flexShrink: 0 }} />
          <span>{email.sujet}</span>
        </div>
        {email.statut_envoi === 'failed' && (
          <span className="epc-failed-badge">
            <AlertTriangle size={12} /> Échec d'envoi
          </span>
        )}
        <div className="epc-chevron">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {expanded && (
        <div className="epc-body">
          {email.icebreaker && (
            <div className="epc-icebreaker">
              <Zap size={12} style={{ color: 'var(--color-amber)' }} />
              <span><strong>Icebreaker :</strong> {email.icebreaker}</span>
            </div>
          )}

          {isEditing ? (
            <div className="epc-edit-form">
              <div>
                <label className="gen-label">Sujet</label>
                <input
                  className="epc-input"
                  value={editedSujet}
                  onChange={(e) => setEditedSujet(e.target.value)}
                />
              </div>
              <div>
                <label className="gen-label">Corps</label>
                <textarea
                  className="epc-textarea"
                  rows={10}
                  value={editedCorps}
                  onChange={(e) => setEditedCorps(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary-sm" onClick={handleSaveEdit}>
                  <Check size={12} /> Sauvegarder
                </button>
                <button className="btn-ghost-sm" onClick={() => setIsEditing(false)}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="epc-corps">
              {email.corps_du_mail.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}

          {!isEditing && (
            <div className="epc-actions">
              <button className="btn-primary-sm" onClick={handleApproveAndSend} disabled={isSending}>
                {isSending ? <Loader size={12} className="spin" /> : <Send size={12} />}
                {isSending ? 'Envoi...' : email.statut_envoi === 'failed' ? 'Réessayer l\'envoi' : 'Approuver & Envoyer'}
              </button>
              <button className="btn-ghost-sm" onClick={() => setIsEditing(true)}>
                <Edit3 size={12} /> Modifier
              </button>
              <button className="btn-ghost-sm danger" onClick={handleDelete}>
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
