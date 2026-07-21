import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, Loader } from 'lucide-react';
import { templatesService, type EmailTemplate } from '../../services/templatesService';
import { leadsService, type Lead } from '../../services/leadsService';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/Select';

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

interface TemplatesTabProps {
  showToast: (m: string, t?: 'success' | 'error' | 'info') => void;
}

export const TemplatesTab: React.FC<TemplatesTabProps> = ({ showToast }) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [segment, setSegment] = useState<EmailTemplate['segment']>('All');
  const [step, setStep] = useState<EmailTemplate['step']>('initial');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewLeadId, setPreviewLeadId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const existing = templates.find((t) => t.segment === segment && t.step === step);
    setSubject(existing?.subject || '');
    setBody((existing?.body || '').replace(/\\n/g, '\n'));
  }, [segment, step, templates]);

  const insertVariable = (variable: string) => {
    const textarea = bodyRef.current;
    if (!textarea) {
      setBody((prev) => prev + variable);
      return;
    }
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

  if (loading) {
    return (
      <div className="pros-loading">
        <Loader size={20} className="spin" /> Chargement...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3" style={{ width: '100%' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Select value={segment} onValueChange={(val) => setSegment(val as EmailTemplate['segment'])}>
            <SelectTrigger className="gen-select">
              <SelectValue placeholder={segment} />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Select value={step} onValueChange={(val) => setStep(val as EmailTemplate['step'])}>
            <SelectTrigger className="gen-select">
              <SelectValue placeholder={step} />
            </SelectTrigger>
            <SelectContent>
              {STEPS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
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
        <Select value={previewLeadId} onValueChange={(val) => setPreviewLeadId(val)}>
          <SelectTrigger className="gen-select">
            <SelectValue placeholder="-- Choisir un lead --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">-- Choisir un lead --</SelectItem>
            {leads.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.contact_name} — {l.company_name}
              </SelectItem>
            ))}
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
