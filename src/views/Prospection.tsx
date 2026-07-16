import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Mail, RefreshCw, Check, Edit3, Send, ChevronDown, ChevronUp,
  AlertCircle, Loader, Trash2, Zap, FileEdit
} from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/Select';
import { emailsService, type GeneratedEmail } from '../services/emailsService';
import { prospectionService } from '../services/prospectionService';
import { templatesService, type EmailTemplate } from '../services/templatesService';
import { leadsService, type Lead } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { ProspectionModeToggle } from '../components/ProspectionModeToggle';
import './prospection.css';

// ── Onglets de la vue ──────────────────────────────────────────────────────────
type Tab = 'validation' | 'templates' | 'followup';

// ── Composant principal ────────────────────────────────────────────────────────
export const Prospection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('validation');
  const { showToast } = useToast();
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  useEffect(() => {
    settingsService.getProspectionSettings().then((s) => setMode(s.prospection_mode));
  }, []);

  const handleModeChange = async (newMode: 'manual' | 'auto') => {
    const previousMode = mode;
    setMode(newMode);
    try {
      await settingsService.updateProspectionSettings({ prospection_mode: newMode });
      showToast(`Mode ${newMode === 'auto' ? 'automatique' : 'vérification humaine'} activé`, 'success');
    } catch {
      setMode(previousMode);
      showToast('Erreur changement de mode', 'error');
    }
  };

  return (
    <div className="prospection-view">
      {/* Header */}
      <div className="prospection-header">
        <div className="prospection-title">
          <Sparkles size={20} style={{ color: 'var(--purple)' }} />
          <h1>Prospection IA</h1>
          <span className="prospection-badge">Templates + fusion</span>
        </div>
        <ProspectionModeToggle mode={mode} onChange={handleModeChange} />
        <p className="prospection-subtitle">
          Générez et envoyez des emails ultra-personnalisés en quelques clics.
        </p>
      </div>

      {/* Tabs */}
      <div className="prospection-tabs">
        <button
          className={`pros-tab ${activeTab === 'validation' ? 'active' : ''}`}
          onClick={() => setActiveTab('validation')}
        >
          <Mail size={14} /> Validation
        </button>
        <button
          className={`pros-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileEdit size={14} /> Templates
        </button>
        <button
          className={`pros-tab ${activeTab === 'followup' ? 'active' : ''}`}
          onClick={() => setActiveTab('followup')}
        >
          <RefreshCw size={14} /> Relances
        </button>
      </div>

      {/* Contenu selon l'onglet actif */}
      <div className="prospection-body">
        {activeTab === 'validation' && <ValidationTab showToast={showToast} />}
        {activeTab === 'templates' && <TemplatesTab showToast={showToast} />}
        {activeTab === 'followup' && <FollowUpTab showToast={showToast} />}
      </div>
    </div>
  );
};

// ── Tab Validation ──────────────────────────────────────────────────────────────

const ValidationTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error' | 'info') => void }> = ({ showToast }) => {
  const [drafts, setDrafts] = useState<GeneratedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const [quota, setQuota] = useState<number | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await emailsService.getGeneratedEmails('draft');
      setDrafts(data);
    } catch {
      showToast('Erreur chargement de la file de validation', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

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
        <div className="pros-loading"><Loader size={20} className="spin" /> Chargement...</div>
      ) : drafts.length === 0 ? (
        <div className="pros-empty">
          <Mail size={28} style={{ opacity: 0.4 }} />
          <p>Aucun draft en attente — tout lead ajouté avec un email génère automatiquement son 1er mail ici.</p>
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

// ── Tab Templates ──────────────────────────────────────────────────────────────

const SEGMENTS: EmailTemplate['segment'][] = ['All', 'Media', 'Retail', 'Instit'];
const STEPS: { key: EmailTemplate['step']; label: string }[] = [
  { key: 'initial', label: '1er email' },
  { key: 'relance_1', label: 'Relance 1' },
  { key: 'relance_2', label: 'Relance 2' },
];
const VARIABLES: { value: string; label: string }[] = [
  { value: '{{contact_name}}', label: 'Contact' },
  { value: '{{company_name}}', label: 'Entreprise' },
  { value: '{{poste}}', label: 'Poste' },
  { value: '{{segment}}', label: 'Segment' },
];

const TemplatesTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error' | 'info') => void }> = ({ showToast }) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [segment, setSegment] = useState<EmailTemplate['segment']>('All');
  const [step, setStep] = useState<EmailTemplate['step']>('initial');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewLeadId, setPreviewLeadId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, l] = await Promise.all([templatesService.getTemplates(), leadsService.getLeads()]);
      setTemplates(t);
      setLeads(l);
    } catch {
      showToast('Erreur chargement des templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const existing = templates.find((t) => t.segment === segment && t.step === step);
    setSubject(existing?.subject || '');
    // D'anciens templates ont été enregistrés avec des "\n" littéraux (texte)
    // au lieu de vrais retours à la ligne — on les normalise à l'affichage.
    setBody((existing?.body || '').replace(/\\n/g, '\n'));
  }, [segment, step, templates]);

  const insertVariable = (variable: string) => {
    const textarea = bodyRef.current;
    if (!textarea) { setBody((prev) => prev + variable); return; }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setBody((prev) => prev.slice(0, start) + variable + prev.slice(end));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await templatesService.upsertTemplate(segment, step, subject, body);
      showToast('Template sauvegardé ✓', 'success');
      load();
    } catch {
      showToast('Erreur sauvegarde template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const previewLead = leads.find((l) => l.id === previewLeadId);
  const preview = previewLead ? templatesService.renderTemplate({ subject, body }, previewLead) : null;

  if (loading) return <div className="pros-loading"><Loader size={20} className="spin" /> Chargement...</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3" style={{ width: '100%' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Select value={segment} onValueChange={val => setSegment(val as EmailTemplate['segment'])}>
            <SelectTrigger className="gen-select">
              <SelectValue placeholder={segment} />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Select value={step} onValueChange={val => setStep(val as EmailTemplate['step'])}>
            <SelectTrigger className="gen-select">
              <SelectValue placeholder={step} />
            </SelectTrigger>
            <SelectContent>
              {STEPS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="gen-field-group">
        <label className="gen-label">Sujet</label>
        <input className="gen-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>

      <div className="gen-field-group">
        <label className="gen-label">Corps</label>
        <div className="flex gap-2 flex-wrap mb-2">
          {VARIABLES.map((v) => (
            <button
              key={v.value}
              type="button"
              className="text-xs px-2 py-1 rounded-full bg-brand-bg-panel border border-brand-border text-brand-text-secondary hover:text-white"
              onClick={() => insertVariable(v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <textarea ref={bodyRef} className="gen-textarea" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      <button className="btn-primary-sm" onClick={handleSave} disabled={saving} style={{ alignSelf: 'flex-start' }}>
        {saving ? <Loader size={13} className="spin" /> : <Check size={13} />} Sauvegarder
      </button>

      <div className="gen-field-group">
        <label className="gen-label">Aperçu sur un lead</label>
        <Select value={previewLeadId} onValueChange={val => setPreviewLeadId(val)}>
          <SelectTrigger className="gen-select">
            <SelectValue placeholder="-- Choisir un lead --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">-- Choisir un lead --</SelectItem>
            {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.contact_name} — {l.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {preview && (
          <div className="mt-3 p-4 rounded-xl bg-brand-bg-panel border border-brand-border">
            <div className="font-semibold text-brand-text">{preview.subject}</div>
            <div className="mt-2 text-brand-text-secondary whitespace-pre-line">{preview.body}</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Tab Relances ──────────────────────────────────────────────────────────────

const FollowUpTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error' | 'info') => void }> = ({ showToast }) => {
  const [candidates, setCandidates] = useState<Awaited<ReturnType<typeof prospectionService.getFollowUpCandidates>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    prospectionService.getFollowUpCandidates()
      .then((data) => { if (!cancelled) setCandidates(data); })
      .catch(() => { if (!cancelled) showToast('Erreur chargement relances', 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showToast]);

  if (loading) return <div className="pros-loading"><Loader size={20} className="spin" /> Analyse des relances...</div>;

  const actionLabels = {
    follow_up_1: { label: '1ère relance', color: 'var(--gold)' },
    follow_up_2: { label: '2ème relance', color: 'var(--purple)' },
    archive: { label: 'À archiver', color: 'var(--text-muted)' },
    wait: { label: 'Attente', color: 'var(--text-secondary)' },
  };

  const handleGenerateFollowUp = async (candidate: (typeof candidates)[number]) => {
    if (candidate.recommendedAction !== 'follow_up_1' && candidate.recommendedAction !== 'follow_up_2') return;
    const step = candidate.recommendedAction === 'follow_up_1' ? 'relance_1' : 'relance_2';
    try {
      await prospectionService.createFollowUpDraft(candidate.lead, step);
      showToast(`Relance générée pour ${candidate.lead.contact_name}`, 'success');
      setCandidates((prev) => prev.filter((c) => c.lead.id !== candidate.lead.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur génération relance', 'error');
    }
  };

  return (
    <div>
      <div className="pros-section-header">
        <h2>Relances intelligentes</h2>
        <span className="pros-info-badge">
          <AlertCircle size={12} /> Calculé sur les 30 derniers jours
        </span>
      </div>

      {candidates.length === 0 ? (
        <div className="pros-empty">
          <Check size={32} style={{ color: 'var(--green)', opacity: 0.6 }} />
          <p>Aucune relance nécessaire — tous les leads sont à jour !</p>
        </div>
      ) : (
        <div className="followup-list">
          {candidates.map((candidate) => {
            const { lead, daysSinceLastEmail, hasOpened, followUpCount, recommendedAction } = candidate;
            const action = actionLabels[recommendedAction];
            return (
              <div key={lead.id} className="followup-row">
                <div className="followup-info">
                  <strong>{lead.contact_name}</strong>
                  <span className="followup-company">{lead.company_name}</span>
                </div>
                <div className="followup-stats">
                  <span className="followup-days">{daysSinceLastEmail}j sans réponse</span>
                  {hasOpened && <span className="followup-opened">✓ A ouvert</span>}
                  {followUpCount > 0 && <span className="followup-count">{followUpCount} relance(s)</span>}
                </div>
                <span
                  className="followup-action-badge"
                  style={{ color: action.color, borderColor: action.color }}
                >
                  {action.label}
                </span>
                {(recommendedAction === 'follow_up_1' || recommendedAction === 'follow_up_2') && (
                  <button className="btn-ghost-sm" onClick={() => handleGenerateFollowUp(candidate)}>
                    Générer la relance
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Composant EmailPreviewCard ────────────────────────────────────────────────

const EmailPreviewCard: React.FC<{
  email: GeneratedEmail;
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
  onUpdate: () => void;
}> = ({ email, showToast, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCorps, setEditedCorps] = useState(email.corps_du_mail);
  const [editedSujet, setEditedSujet] = useState(email.sujet);

  const handleApproveAndSend = async () => {
    setIsSending(true);
    try {
      // Route through schedule_send() so this respects the daily quota —
      // an immediate send only happens if the quota-aware scheduler actually
      // grants today's date; otherwise the email stays approved/queued for
      // its assigned day.
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
        // approveAndSchedule succeeded but sendEmail failed (network error,
        // Resend down, etc). Roll back to 'draft' so the email stays visible
        // and retryable in the review list instead of silently disappearing
        // (getGeneratedEmails only fetches statut_envoi === 'draft').
        await emailsService.updateGeneratedEmail(email.id, { statut_envoi: 'draft' }).catch(() => {});
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
    if (!confirm('Supprimer cet email généré ?')) return;
    try {
      await emailsService.deleteGeneratedEmail(email.id);
      onUpdate();
    } catch {
      showToast('Erreur suppression', 'error');
    }
  };

  return (
    <div className={`email-preview-card ${expanded ? 'expanded' : ''}`}>
      {/* Header */}
      <div className="epc-header" onClick={() => setExpanded((v) => !v)}>
        <div className="epc-prospect">
          <strong>{email.lead?.contact_name || '—'}</strong>
          <span className="epc-company">{email.lead?.company_name}</span>
          {email.lead?.poste && <span className="epc-poste">{email.lead.poste}</span>}
        </div>
        <div className="epc-subject">
          <Mail size={12} style={{ color: 'var(--purple)', flexShrink: 0 }} />
          <span>{email.sujet}</span>
        </div>
        <div className="epc-chevron">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Body expandé */}
      {expanded && (
        <div className="epc-body">
          {/* Icebreaker */}
          {email.icebreaker && (
            <div className="epc-icebreaker">
              <Zap size={12} style={{ color: 'var(--gold)' }} />
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

          {/* Actions */}
          {!isEditing && (
            <div className="epc-actions">
              <button className="btn-primary-sm" onClick={handleApproveAndSend} disabled={isSending}>
                {isSending ? <Loader size={12} className="spin" /> : <Send size={12} />}
                {isSending ? 'Envoi...' : 'Approuver & Envoyer'}
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

export default Prospection;
