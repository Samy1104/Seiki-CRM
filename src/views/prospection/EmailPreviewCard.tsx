import React, { useState } from 'react';
import { Mail, ChevronDown, ChevronUp, AlertTriangle, Zap, Check, Send, Edit3, Trash2, Loader2 } from 'lucide-react';
import { emailsService, type GeneratedEmail } from '../../services/emailsService';
import { templatesService, type EmailTemplate } from '../../services/templatesService';
import type { Lead } from '../../services/leadsService';
import { detectMissingVariables } from '../../utils/templateVariableChecker';
import { confirmAction } from '../../utils/confirmAction';
import { AccentButton } from '../../components/ui/AccentButton';
import { Button } from '../../components/ui/Button';
import { Field, inputClass } from '../../components/ui/Field';

interface EmailPreviewCardProps {
  email: GeneratedEmail;
  templates?: EmailTemplate[];
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
  onUpdate: () => void;
}

export const EmailPreviewCard: React.FC<EmailPreviewCardProps> = ({ email, templates = [], showToast, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingNow, setIsSendingNow] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Live render from latest template and latest lead data
  const segment = (email.lead?.segment || 'Media') as EmailTemplate['segment'];
  const step = 'initial';
  const matchingTemplate = templatesService.resolveTemplate(templates, segment, step);

  const liveRendered = matchingTemplate && email.lead
    ? templatesService.renderTemplate(matchingTemplate, email.lead as unknown as Lead)
    : { subject: email.sujet, body: email.corps_du_mail };

  const isManual = email.model_used === 'manual';
  const displaySubject = isManual ? email.sujet : liveRendered.subject;
  const displayBody = isManual ? email.corps_du_mail : liveRendered.body;

  const [editedCorps, setEditedCorps] = useState(displayBody);
  const [editedSujet, setEditedSujet] = useState(displaySubject);

  const missingVars = detectMissingVariables(email, templates);

  const handleStartEdit = () => {
    setEditedSujet(displaySubject);
    setEditedCorps(displayBody);
    setIsEditing(true);
  };

  const handleApprove = async () => {
    setIsSending(true);
    try {
      if (!isManual) {
        await emailsService.updateGeneratedEmail(email.id, {
          sujet: displaySubject,
          corps_du_mail: displayBody,
        });
      }
      await emailsService.approveAndSchedule(email.id);
      showToast(
        email.statut_envoi === 'failed'
          ? `Remis en file d'envoi pour ${email.lead?.contact_name || 'le prospect'}.`
          : `Approuvé — sera envoyé automatiquement selon la planification (${email.lead?.contact_name || 'le prospect'}).`,
        'success'
      );
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur approbation', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendNow = async () => {
    setIsSendingNow(true);
    try {
      if (!isManual) {
        await emailsService.updateGeneratedEmail(email.id, {
          sujet: displaySubject,
          corps_du_mail: displayBody,
        });
      }
      await emailsService.sendNow(email.id);
      showToast(`Email envoyé immédiatement à ${email.lead?.contact_name || 'ce prospect'}.`, 'success');
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi immédiat', 'error');
    } finally {
      setIsSendingNow(false);
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
      onUpdate();
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
        className="py-2.5 px-3.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-hover transition-colors font-ui"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Mail size={15} strokeWidth={2} className="text-[#D4C4A8] shrink-0" />
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <strong className="text-sm text-ink font-semibold">{email.lead?.company_name || '—'}</strong>
            {email.lead?.contact_name && (
              <span className="text-xs text-ink-soft bg-base px-2 py-0.5 rounded-control border border-line-strong">
                {email.lead.contact_name}
              </span>
            )}
            {email.lead?.poste && (
              <span className="text-xs text-ink-faint truncate">({email.lead.poste})</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {missingVars.length > 0 && (
            <span className="text-xs text-amber-400 font-semibold bg-amber-400/10 px-2.5 py-1 rounded-control border border-amber-400/30 flex items-center gap-1">
              <AlertTriangle size={12} strokeWidth={2} /> Variable(s) manquante(s) ({missingVars.join(', ')})
            </span>
          )}
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
          {missingVars.length > 0 && (
            <div className="p-3.5 rounded-control border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle size={16} strokeWidth={2} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 font-semibold">Information manquante pour le template</strong>
                <p className="mt-0.5 text-amber-200/90 leading-relaxed">
                  L'email utilise la/les variable(s) <strong className="text-amber-300">{missingVars.join(', ')}</strong> mais cette donnée n'est pas renseignée pour ce lead.
                </p>
              </div>
            </div>
          )}
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
              <div className="text-xs font-bold text-ink mb-2 pb-1.5 border-b border-line-strong">
                Sujet : {displaySubject}
              </div>
              {displayBody}
            </div>
          )}

          {!isEditing && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <AccentButton
                variant="primary"
                onClick={handleApprove}
                disabled={isSending || isSendingNow}
                icon={
                  isSending ? (
                    <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <Check size={14} strokeWidth={2} />
                  )
                }
              >
                {isSending ? 'Approbation...' : email.statut_envoi === 'failed' ? 'Remettre en file' : 'Approuver'}
              </AccentButton>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendNow}
                disabled={isSending || isSendingNow}
              >
                {isSendingNow ? (
                  <Loader2 size={13} strokeWidth={2} className="animate-spin text-[#D4C4A8]" />
                ) : (
                  <Send size={13} strokeWidth={2} className="text-[#D4C4A8]" />
                )}
                Envoyer maintenant
              </Button>
              <Button variant="secondary" size="sm" onClick={handleStartEdit}>
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
