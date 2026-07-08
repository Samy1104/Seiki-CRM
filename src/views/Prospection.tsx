import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Plus, Play, Pause, BarChart3, Mail,
  RefreshCw, Check, X, Edit3, Send, ChevronDown, ChevronUp,
  AlertCircle, Loader, Eye, Trash2, Users, Zap, FileEdit
} from 'lucide-react';
import { campaignsService, type Campaign, type CampaignMetrics, type GeneratedEmail } from '../services/campaignsService';
import { prospectionService, type ProspectionLead } from '../services/prospectionService';
import { templatesService, type EmailTemplate } from '../services/templatesService';
import { leadsService, type Lead } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabaseClient';
import { ProspectionModeToggle } from '../components/ProspectionModeToggle';
import './prospection.css';

// ── Onglets de la vue ──────────────────────────────────────────────────────────
type Tab = 'campaigns' | 'generation' | 'templates' | 'followup';

// ── Composant principal ────────────────────────────────────────────────────────
export const Prospection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('campaigns');
  const { showToast } = useToast();
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');

  useEffect(() => {
    settingsService.getProspectionSettings().then((s) => setMode(s.prospection_mode));
  }, []);

  const handleModeChange = async (newMode: 'manual' | 'auto') => {
    setMode(newMode);
    try {
      await settingsService.updateProspectionSettings({ prospection_mode: newMode });
      showToast(`Mode ${newMode === 'auto' ? 'automatique' : 'vérification humaine'} activé`, 'success');
    } catch {
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
          className={`pros-tab ${activeTab === 'campaigns' ? 'active' : ''}`}
          onClick={() => setActiveTab('campaigns')}
        >
          <BarChart3 size={14} /> Campagnes
        </button>
        <button
          className={`pros-tab ${activeTab === 'generation' ? 'active' : ''}`}
          onClick={() => setActiveTab('generation')}
        >
          <Sparkles size={14} /> Génération IA
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
        {activeTab === 'campaigns' && <CampaignsTab showToast={showToast} />}
        {activeTab === 'generation' && <GenerationTab showToast={showToast} />}
        {activeTab === 'templates' && <TemplatesTab showToast={showToast} />}
        {activeTab === 'followup' && <FollowUpTab showToast={showToast} />}
      </div>
    </div>
  );
};

// ── Tab Campagnes ──────────────────────────────────────────────────────────────

const CampaignsTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error' | 'info') => void }> = ({ showToast }) => {
  const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [quota, setQuota] = useState<number | null>(null);

  useEffect(() => {
    settingsService.getProspectionSettings().then((s) => setQuota(s.daily_send_quota));
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const data = await campaignsService.getCampaigns();
      setCampaigns(data);
    } catch (err) {
      showToast('Erreur chargement des campagnes', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const [unassignedCount, setUnassignedCount] = useState({ draft: 0, approved: 0, sent: 0 });

  const loadUnassigned = useCallback(async () => {
    const [draft, approved, sent] = await Promise.all([
      campaignsService.getUnassignedGeneratedEmails('draft'),
      campaignsService.getUnassignedGeneratedEmails('approved'),
      campaignsService.getUnassignedGeneratedEmails('sent'),
    ]);
    setUnassignedCount({ draft: draft.length, approved: approved.length, sent: sent.length });
  }, []);

  useEffect(() => { loadUnassigned(); }, [loadUnassigned]);

  const handleFlush = async () => {
    setFlushing(true);
    try {
      const result = await campaignsService.flushSendQueue();
      if (result.skipped) {
        showToast(`Rien à envoyer : ${result.skipped}`, 'info');
      } else {
        showToast(`${result.sent}/${result.processed} emails envoyés`, result.failed > 0 ? 'info' : 'success');
      }
      loadCampaigns();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi du lot', 'error');
    } finally {
      setFlushing(false);
    }
  };

  const handleStatusToggle = async (campaign: CampaignMetrics) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    try {
      await campaignsService.updateCampaign(campaign.id, { status: newStatus });
      showToast(`Campagne ${newStatus === 'active' ? 'activée' : 'mise en pause'}`, 'success');
      loadCampaigns();
    } catch {
      showToast('Erreur mise à jour statut', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette campagne ? Les emails générés seront également supprimés.')) return;
    try {
      await campaignsService.deleteCampaign(id);
      showToast('Campagne supprimée', 'success');
      loadCampaigns();
    } catch {
      showToast('Erreur suppression', 'error');
    }
  };

  return (
    <div>
      <div className="pros-section-header">
        <h2>Campagnes actives</h2>
        <div className="flex gap-2">
          <button className="btn-secondary-sm" onClick={handleFlush} disabled={flushing}>
            {flushing ? <Loader size={13} className="spin" /> : <Send size={13} />}
            Envoyer le lot du jour {quota !== null ? `(quota: ${quota}/j)` : ''}
          </button>
          <button className="btn-primary-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={13} /> Nouvelle campagne
          </button>
        </div>
      </div>

      {loading ? (
        <div className="pros-loading"><Loader size={20} className="spin" /> Chargement...</div>
      ) : campaigns.length === 0 ? (
        <div className="pros-empty">
          <Sparkles size={32} style={{ color: 'var(--purple)', opacity: 0.5 }} />
          <p>Aucune campagne. Créez votre première campagne de prospection IA.</p>
          <button className="btn-primary-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={13} /> Créer une campagne
          </button>
        </div>
      ) : (
        <div className="campaigns-grid">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onToggle={() => handleStatusToggle(c)}
              onDelete={() => handleDelete(c.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-4 p-4 rounded-xl bg-brand-bg-panel border border-brand-border">
        <div className="font-semibold text-brand-text mb-2">Flux automatique (sans campagne)</div>
        <div className="flex gap-6 text-brand-text-secondary text-sm">
          <span>{unassignedCount.draft} en attente</span>
          <span>{unassignedCount.approved} planifiés</span>
          <span>{unassignedCount.sent} envoyés</span>
        </div>
      </div>

      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); loadCampaigns(); showToast('Campagne créée !', 'success'); }}
        />
      )}
    </div>
  );
};

// ── Tab Génération IA ──────────────────────────────────────────────────────────

const GenerationTab: React.FC<{ showToast: (m: string, t?: 'success' | 'error' | 'info') => void }> = ({ showToast }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<ProspectionLead[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'select' | 'review'>('select');
  const [subView, setSubView] = useState<'auto' | 'manual'>('auto');
  const [autoDrafts, setAutoDrafts] = useState<GeneratedEmail[]>([]);
  const [autoLoading, setAutoLoading] = useState(true);

  const loadAutoDrafts = useCallback(async () => {
    setAutoLoading(true);
    try {
      const drafts = await campaignsService.getUnassignedGeneratedEmails('draft');
      setAutoDrafts(drafts);
    } catch {
      showToast('Erreur chargement de la file de validation', 'error');
    } finally {
      setAutoLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadAutoDrafts(); }, [loadAutoDrafts]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [camps, prLeads] = await Promise.all([
          campaignsService.getCampaigns(),
          prospectionService.getLeadsReadyForProspection(),
        ]);
        setCampaigns(camps);
        setLeads(prLeads);
      } catch (err) {
        showToast('Erreur chargement des données', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [showToast]);

  const toggleLead = (id: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedLeads(new Set(leads.map((l) => l.id)));
  };

  const clearAll = () => setSelectedLeads(new Set());

  const handleGenerate = async () => {
    if (!selectedCampaign) { showToast('Sélectionne une campagne', 'error'); return; }
    if (selectedLeads.size === 0) { showToast('Sélectionne au moins un lead', 'error'); return; }

    setIsGenerating(true);
    setProgress({ current: 0, total: selectedLeads.size });
    const leadIds = Array.from(selectedLeads);
    const templates = await templatesService.getTemplates();
    const generated: GeneratedEmail[] = [];
    const failedLeads: string[] = [];

    for (let i = 0; i < leadIds.length; i++) {
      const lead = leads.find((l) => l.id === leadIds[i]);
      setProgress({ current: i + 1, total: leadIds.length });
      if (!lead) { failedLeads.push(leadIds[i]); continue; }

      const template = templatesService.resolveTemplate(templates, lead.segment, 'initial');
      if (!template) { failedLeads.push(leadIds[i]); continue; }

      const rendered = templatesService.renderTemplate(template, lead);
      const { data, error } = await supabase
        .from('generated_emails')
        .insert([{
          lead_id: lead.id,
          campaign_id: selectedCampaign,
          step: 'initial',
          sujet: rendered.subject,
          corps_du_mail: rendered.body,
          statut_envoi: 'draft',
          model_used: 'template',
        }])
        .select(`*, lead:leads!lead_id(contact_name, company_name, email, poste, segment)`)
        .single();

      if (error || !data) failedLeads.push(leadIds[i]);
      else generated.push(data as GeneratedEmail);
    }

    setGeneratedEmails(generated);
    if (failedLeads.length > 0) {
      showToast(`${generated.length} emails générés, ${failedLeads.length} échecs (template manquant pour le segment)`, 'info');
    } else {
      showToast(`${generated.length} emails générés avec succès !`, 'success');
    }
    setViewMode('review');
    setIsGenerating(false);
  };

  const handleReload = async () => {
    if (!selectedCampaign) return;
    const emails = await campaignsService.getGeneratedEmails(selectedCampaign, 'draft');
    setGeneratedEmails(emails);
    setViewMode('review');
  };

  if (loading) return <div className="pros-loading"><Loader size={20} className="spin" /> Chargement...</div>;

  return (
    <div>
      <div className="pros-section-header">
        <h2>{subView === 'auto' ? 'File de validation (auto-pipeline)' : viewMode === 'select' ? 'Génération manuelle' : `${generatedEmails.length} emails générés`}</h2>
        <div className="flex gap-2">
          <button className={`btn-ghost-sm ${subView === 'auto' ? 'active' : ''}`} onClick={() => setSubView('auto')}>Auto ({autoDrafts.length})</button>
          <button className={`btn-ghost-sm ${subView === 'manual' ? 'active' : ''}`} onClick={() => setSubView('manual')}>Manuelle</button>
        </div>
        {subView === 'manual' && viewMode === 'review' && (
          <button className="btn-secondary-sm" onClick={() => setViewMode('select')}>
            ← Retour à la sélection
          </button>
        )}
      </div>

      {subView === 'auto' && (
        autoLoading ? (
          <div className="pros-loading"><Loader size={20} className="spin" /> Chargement...</div>
        ) : autoDrafts.length === 0 ? (
          <div className="pros-empty">
            <Mail size={28} style={{ opacity: 0.4 }} />
            <p>Aucun draft en attente — tout lead ajouté avec un email génère automatiquement son 1er mail ici.</p>
          </div>
        ) : (
          <div className="gen-review-list">
            {autoDrafts.map((email) => (
              <EmailPreviewCard
                key={email.id}
                email={email}
                showToast={showToast}
                onUpdate={() => setAutoDrafts((prev) => prev.filter((e) => e.id !== email.id))}
                queueMode
              />
            ))}
          </div>
        )
      )}

      {subView === 'manual' && (
      <>
      {viewMode === 'select' && (
        <>
          {/* Sélection campagne */}
          <div className="gen-field-group">
            <label className="gen-label">Campagne *</label>
            <select
              className="gen-select"
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
            >
              <option value="">-- Choisir une campagne --</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.objective})</option>
              ))}
            </select>
          </div>

          {/* Liste des leads */}
          <div className="gen-leads-section">
            <div className="gen-leads-header">
              <span>{leads.length} leads éligibles</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-ghost-sm" onClick={selectAll}>Tout sélectionner</button>
                <button className="btn-ghost-sm" onClick={clearAll}>Désélectionner</button>
              </div>
            </div>

            <div className="gen-leads-list">
              {leads.length === 0 ? (
                <div className="pros-empty">
                  <Users size={28} style={{ opacity: 0.4 }} />
                  <p>Aucun lead éligible (email manquant ou déjà en séquence complétée).</p>
                </div>
              ) : (
                leads.map((lead) => (
                  <label key={lead.id} className={`gen-lead-row ${selectedLeads.has(lead.id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedLeads.has(lead.id)}
                      onChange={() => toggleLead(lead.id)}
                    />
                    <div className="gen-lead-info">
                      <span className="gen-lead-name">{lead.contact_name}</span>
                      <span className="gen-lead-company">{lead.company_name}</span>
                      {lead.poste && <span className="gen-lead-poste">{lead.poste}</span>}
                    </div>
                    <div className="gen-lead-meta">
                      <span className={`tag-segment seg-${lead.segment.toLowerCase()}`}>{lead.segment}</span>
                      {lead.enrichi_contexte && (
                        <span title="Contexte enrichi disponible" style={{ color: 'var(--green)', fontSize: '10px' }}>✦ enrichi</span>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="gen-actions-bar">
            <span className="gen-count">{selectedLeads.size} sélectionné(s)</span>
            {isGenerating ? (
              <div className="gen-progress">
                <Loader size={14} className="spin" />
                <span>Génération {progress.current}/{progress.total}...</span>
                <div className="gen-progress-bar">
                  <div className="gen-progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-ghost-sm" onClick={handleReload}>
                  <Eye size={13} /> Voir les drafts existants
                </button>
                <button
                  className="btn-primary-sm"
                  onClick={handleGenerate}
                  disabled={selectedLeads.size === 0 || !selectedCampaign}
                >
                  <Sparkles size={13} />
                  Générer {selectedLeads.size > 0 ? `${selectedLeads.size} email(s)` : ''}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {viewMode === 'review' && (
        <div className="gen-review-list">
          {generatedEmails.length === 0 ? (
            <div className="pros-empty">
              <Mail size={28} style={{ opacity: 0.4 }} />
              <p>Aucun email en draft pour cette campagne.</p>
            </div>
          ) : (
            generatedEmails.map((email) => (
              <EmailPreviewCard
                key={email.id}
                email={email}
                showToast={showToast}
                onUpdate={() => {
                  setGeneratedEmails((prev) =>
                    prev.filter((e) => e.id !== email.id)
                  );
                }}
              />
            ))
          )}
        </div>
      )}
      </>
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
const VARIABLES = ['{{contact_name}}', '{{company_name}}', '{{poste}}', '{{segment}}'];

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
    setBody(existing?.body || '');
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
      <div className="flex gap-3">
        <select className="gen-select" value={segment} onChange={(e) => setSegment(e.target.value as EmailTemplate['segment'])}>
          {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="gen-select" value={step} onChange={(e) => setStep(e.target.value as EmailTemplate['step'])}>
          {STEPS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
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
              key={v}
              type="button"
              className="text-xs px-2 py-1 rounded-full bg-brand-bg-panel border border-brand-border text-brand-text-secondary hover:text-white"
              onClick={() => insertVariable(v)}
            >
              {v}
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
        <select className="gen-select" value={previewLeadId} onChange={(e) => setPreviewLeadId(e.target.value)}>
          <option value="">-- Choisir un lead --</option>
          {leads.map((l) => <option key={l.id} value={l.id}>{l.contact_name} — {l.company_name}</option>)}
        </select>
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

// ── Composant CampaignCard ────────────────────────────────────────────────────

const CampaignCard: React.FC<{
  campaign: CampaignMetrics;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ campaign, onToggle, onDelete }) => {
  const statusConfig = {
    draft: { label: 'Brouillon', color: 'var(--text-muted)' },
    active: { label: 'Active', color: 'var(--green)' },
    paused: { label: 'En pause', color: 'var(--gold)' },
    completed: { label: 'Terminée', color: 'var(--purple)' },
  };

  const s = statusConfig[campaign.status];

  return (
    <div className="campaign-card">
      <div className="campaign-card-header">
        <div className="campaign-card-title">
          <span className="campaign-status-dot" style={{ background: s.color }} />
          <h3>{campaign.name}</h3>
        </div>
        <div className="campaign-card-actions">
          {campaign.status !== 'completed' && (
            <button
              className="btn-icon"
              onClick={onToggle}
              title={campaign.status === 'active' ? 'Mettre en pause' : 'Activer'}
            >
              {campaign.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
            </button>
          )}
          <button className="btn-icon danger" onClick={onDelete} title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="campaign-card-meta">
        <span className="campaign-objective">{campaign.objective}</span>
        {campaign.target_segment && (
          <span className={`tag-segment seg-${campaign.target_segment.toLowerCase()}`}>
            {campaign.target_segment}
          </span>
        )}
        <span className="campaign-tone">Ton : {campaign.tone}</span>
      </div>

      <div className="campaign-metrics">
        <div className="metric-item">
          <span className="metric-value">{campaign.total_sent || 0}</span>
          <span className="metric-label">Envoyés</span>
        </div>
        <div className="metric-item">
          <span className="metric-value" style={{ color: 'var(--gold)' }}>
            {campaign.open_rate != null ? `${campaign.open_rate}%` : '—'}
          </span>
          <span className="metric-label">Ouvertures</span>
        </div>
        <div className="metric-item">
          <span className="metric-value" style={{ color: 'var(--green)' }}>
            {campaign.reply_rate != null ? `${campaign.reply_rate}%` : '—'}
          </span>
          <span className="metric-label">Réponses</span>
        </div>
        <div className="metric-item">
          <span className="metric-value" style={{ color: 'var(--purple)' }}>
            {campaign.total_draft || 0}
          </span>
          <span className="metric-label">En draft</span>
        </div>
      </div>
    </div>
  );
};

// ── Composant EmailPreviewCard ────────────────────────────────────────────────

const EmailPreviewCard: React.FC<{
  email: GeneratedEmail;
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
  onUpdate: () => void;
  queueMode?: boolean;
}> = ({ email, showToast, onUpdate, queueMode = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCorps, setEditedCorps] = useState(email.corps_du_mail);
  const [editedSujet, setEditedSujet] = useState(email.sujet);

  const handleApproveAndSend = async () => {
    setIsSending(true);
    try {
      await campaignsService.approveEmail(email.id);
      try {
        await campaignsService.sendEmail(email.id);
        showToast(`Email envoyé à ${email.lead?.contact_name || 'le prospect'} !`, 'success');
        onUpdate();
      } catch (sendErr) {
        // approveEmail succeeded but sendEmail failed (network error, Resend
        // down, etc). Roll back to 'draft' so the email stays visible and
        // retryable in the review list instead of silently disappearing
        // (getGeneratedEmails only fetches statut_envoi === 'draft').
        await campaignsService.updateGeneratedEmail(email.id, { statut_envoi: 'draft' }).catch(() => {});
        throw sendErr;
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleApproveAndQueue = async () => {
    setIsSending(true);
    try {
      const { scheduledAt } = await campaignsService.approveAndSchedule(email.id);
      const date = new Date(scheduledAt).toLocaleDateString('fr-FR');
      showToast(`Email approuvé, planifié pour le ${date}`, 'success');
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur planification', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await campaignsService.updateGeneratedEmail(email.id, {
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
      await campaignsService.deleteGeneratedEmail(email.id);
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
              {queueMode ? (
                <button className="btn-primary-sm" onClick={handleApproveAndQueue} disabled={isSending}>
                  {isSending ? <Loader size={12} className="spin" /> : <Check size={12} />}
                  {isSending ? 'Planification...' : 'Approuver'}
                </button>
              ) : (
                <button className="btn-primary-sm" onClick={handleApproveAndSend} disabled={isSending}>
                  {isSending ? <Loader size={12} className="spin" /> : <Send size={12} />}
                  {isSending ? 'Envoi...' : 'Approuver & Envoyer'}
                </button>
              )}
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

// ── Modal Création Campagne ───────────────────────────────────────────────────

const CreateCampaignModal: React.FC<{
  onClose: () => void;
  onCreated: () => void;
}> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    name: '',
    objective: 'Prise de RDV',
    target_segment: 'All' as Campaign['target_segment'],
    tone: 'professionnel' as Campaign['tone'],
    description: '',
    system_prompt: '',
    status: 'draft' as Campaign['status'],
  });
  const [saving, setSaving] = useState(false);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await campaignsService.createCampaign({
        ...form,
        created_by: null,
        sequence_id: null,
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nouvelle campagne IA</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="gen-field-group">
            <label className="gen-label">Nom de la campagne *</label>
            <input
              className="gen-input"
              placeholder="ex: Prospection Directeurs Marketing — Q3 2026"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              required
            />
          </div>
          <div className="gen-field-group">
            <label className="gen-label">Objectif</label>
            <input
              className="gen-input"
              placeholder="ex: Prise de RDV démo, Présentation offre..."
              value={form.objective}
              onChange={(e) => update('objective', e.target.value)}
            />
          </div>
          <div className="gen-field-row">
            <div className="gen-field-group">
              <label className="gen-label">Segment cible</label>
              <select className="gen-select" value={form.target_segment || 'All'} onChange={(e) => update('target_segment', e.target.value)}>
                <option value="All">Tous</option>
                <option value="Media">Media</option>
                <option value="Retail">Retail</option>
                <option value="Instit">Instit</option>
              </select>
            </div>
            <div className="gen-field-group">
              <label className="gen-label">Ton</label>
              <select className="gen-select" value={form.tone} onChange={(e) => update('tone', e.target.value)}>
                <option value="professionnel">Professionnel</option>
                <option value="décontracté">Décontracté</option>
                <option value="direct">Direct</option>
                <option value="consultatif">Consultatif</option>
              </select>
            </div>
          </div>
          <div className="gen-field-group">
            <label className="gen-label">Prompt personnalisé (optionnel)</label>
            <textarea
              className="gen-textarea"
              rows={4}
              placeholder="Laisse vide pour utiliser le prompt Seiki par défaut. Sinon, décris ici comment le LLM doit rédiger les emails pour cette campagne..."
              value={form.system_prompt}
              onChange={(e) => update('system_prompt', e.target.value)}
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost-sm" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary-sm" disabled={saving || !form.name.trim()}>
              {saving ? <Loader size={13} className="spin" /> : <Plus size={13} />}
              Créer la campagne
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Prospection;
